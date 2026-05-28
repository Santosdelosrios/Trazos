-- ============================================================
-- Migración 028: Backfill de finanzas + swap del trigger de saldo
--
-- ⚠️  ATENCIÓN: ESTA MIGRACIÓN ES EL PUNTO DE NO RETORNO.
--
-- A partir de su aplicación:
--   1. Los triggers que actualizaban alumnos.saldo_actual desde
--      pagos / movimientos_cuenta SE DROPPEAN.
--   2. saldo_actual se actualiza únicamente desde cargos / cobros.
--   3. Cualquier código de la app que siga escribiendo en pagos/
--      movimientos_cuenta NO ACTUALIZA el saldo. La UI quedará con
--      saldos congelados al momento del backfill hasta que se
--      refactorice ese código a escribir en cargos/cobros.
--
-- POR ESO ESTA MIGRACIÓN DEBE COORDINARSE CON EL DESPLIEGUE DEL
-- REFACTOR DE: cierreClase.ts, finanzas/actions.ts, FormNuevoPago.tsx.
-- Sugerencia: aplicar migración + deploy del código en la misma
-- ventana, en orden:
--   1) merge del PR de código con dual-write (escribe a ambas)
--   2) aplicar 028
--   3) merge del PR de código solo-nuevo (deja de escribir en pagos)
--   4) (en una migración 029 posterior, drop de pagos/movimientos)
--
-- Idempotencia: si los cargos ya están cargados, la migración aborta
-- con error en lugar de duplicar. Para re-correr hay que truncar
-- cargos/cobros/imputaciones primero (devops manual).
-- ============================================================

BEGIN;

-- ============================================================
-- 0. Guardia de idempotencia
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.cargos LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.cobros LIMIT 1) THEN
    RAISE EXCEPTION 'Backfill abortado: cargos/cobros no están vacías. '
                    'Si querés re-correr, primero TRUNCATE cargos, cobros, '
                    'imputaciones RESTART IDENTITY CASCADE.';
  END IF;
END $$;

-- ============================================================
-- 1. Columnas nuevas en alumnos
--
-- creditos_actual:        cache de creditos_restantes (para pack)
-- monto_abono_mensual:    sube de abonos.monto_mensual (campo en
--                          alumnos en lugar de tabla aparte)
-- tope_clases_mes:         sube de abonos.tope_clases_mes
-- ============================================================

ALTER TABLE public.alumnos
  ADD COLUMN IF NOT EXISTS creditos_actual      int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_abono_mensual  numeric(10,2),
  ADD COLUMN IF NOT EXISTS tope_clases_mes      smallint;

COMMENT ON COLUMN public.alumnos.creditos_actual IS
  'Clases del pack que aún no se consumieron. Solo relevante para modelo pack/bolsa_creditos.';
COMMENT ON COLUMN public.alumnos.monto_abono_mensual IS
  'Monto fijo mensual cuando modelo_cobro = abono_mensual. Reemplaza la tabla abonos.';
COMMENT ON COLUMN public.alumnos.tope_clases_mes IS
  'Cantidad máxima de clases incluidas en el abono mensual. NULL = sin tope.';

-- Importar desde abonos activos
UPDATE public.alumnos a
   SET monto_abono_mensual = ab.monto_mensual,
       tope_clases_mes     = ab.tope_clases_mes
  FROM public.abonos ab
 WHERE ab.alumno_id = a.id AND ab.activo = true;

-- ============================================================
-- 2. Backfill de CARGOS, por modelo viejo
-- (procesamos antes de cambiar modelo_cobro)
-- ============================================================

-- ----------------------------------------------------------
-- 2.a por_clase: 1 cargo por cada clase_alumnos × tarifa_efectiva
--
-- La tarifa efectiva se evalúa una sola vez por alumno (snapshot
-- al momento del backfill), no por clase. Esto es consistente con
-- el saldo viejo (que también usaba la tarifa activa actual). Es la
-- mejor aproximación disponible sin un histórico de tarifas por
-- clase.
-- ----------------------------------------------------------

WITH tarifa_efectiva AS (
  SELECT
    a.id          AS alumno_id,
    a.maestra_id,
    COALESCE(
      a.tarifa_override,
      (SELECT t.valor_hora FROM public.tarifas t
         WHERE t.maestra_id = a.maestra_id AND t.activa = true
         ORDER BY t.vigente_desde DESC LIMIT 1),
      0
    ) AS tarifa
  FROM public.alumnos a
  WHERE a.modelo_cobro = 'por_clase'
)
INSERT INTO public.cargos
  (maestra_id, alumno_id, fecha, concepto, monto, clase_id, descripcion, created_at)
SELECT
  te.maestra_id,
  te.alumno_id,
  c.fecha::date,
  'clase',
  te.tarifa,
  c.id,
  COALESCE(c.tema, 'Clase'),
  c.created_at
FROM tarifa_efectiva te
JOIN public.clase_alumnos ca ON ca.alumno_id = te.alumno_id
JOIN public.clases        c  ON c.id = ca.clase_id
WHERE c.maestra_id = te.maestra_id
  AND te.tarifa > 0;  -- alumnos sin tarifa quedan sin cargos (mismo saldo viejo: 0)

-- ----------------------------------------------------------
-- 2.b cuenta_corriente: cargos desde movimientos_cuenta(monto<0)
-- (la tarifa NO aplica acá; el monto viene del movimiento, que es
-- lo que la maestra efectivamente cargó.)
-- ----------------------------------------------------------

INSERT INTO public.cargos
  (maestra_id, alumno_id, fecha, concepto, monto, clase_id, descripcion, created_at)
SELECT
  m.maestra_id,
  m.alumno_id,
  m.created_at::date,
  CASE WHEN m.tipo_movimiento = 'clase_descontada'
       THEN 'clase'::concepto_cargo_enum
       ELSE 'ajuste'::concepto_cargo_enum
  END,
  ABS(m.monto),
  -- referencia_id puede apuntar a clases.id o no, intentamos resolverlo
  CASE WHEN EXISTS (SELECT 1 FROM public.clases WHERE id = m.referencia_id)
       THEN m.referencia_id
       ELSE NULL
  END,
  COALESCE(m.descripcion, 'Cargo cuenta corriente'),
  m.created_at
FROM public.movimientos_cuenta m
JOIN public.alumnos a ON a.id = m.alumno_id
WHERE a.modelo_cobro = 'cuenta_corriente'
  AND m.monto < 0;

-- ----------------------------------------------------------
-- 2.c bolsa_creditos → pack: cargos por movimientos clase_descontada
-- ----------------------------------------------------------

WITH tarifa_efectiva AS (
  SELECT
    a.id          AS alumno_id,
    a.maestra_id,
    COALESCE(
      a.tarifa_override,
      (SELECT t.valor_hora FROM public.tarifas t
         WHERE t.maestra_id = a.maestra_id AND t.activa = true
         ORDER BY t.vigente_desde DESC LIMIT 1),
      0
    ) AS tarifa
  FROM public.alumnos a
  WHERE a.modelo_cobro = 'bolsa_creditos'
)
INSERT INTO public.cargos
  (maestra_id, alumno_id, fecha, concepto, monto, creditos_consumidos,
   clase_id, descripcion, created_at)
SELECT
  m.maestra_id,
  m.alumno_id,
  m.created_at::date,
  'clase',
  te.tarifa * ABS(m.creditos),
  ABS(m.creditos),
  CASE WHEN EXISTS (SELECT 1 FROM public.clases WHERE id = m.referencia_id)
       THEN m.referencia_id
       ELSE NULL
  END,
  COALESCE(m.descripcion, 'Clase (pack)'),
  m.created_at
FROM public.movimientos_cuenta m
JOIN tarifa_efectiva te ON te.alumno_id = m.alumno_id
WHERE m.creditos < 0;

-- ----------------------------------------------------------
-- 2.d abono_mensual: 1 cargo por (alumno, periodo) que tenga pagos
--
-- Replica el comportamiento (con bug) de la fórmula vieja
-- (COUNT(DISTINCT periodo) × monto_mensual). Después del swap, el
-- cierre lazy va a empezar a generar cargos por meses con CLASES
-- (no con pagos), corrigiendo el bug naturalmente.
-- ----------------------------------------------------------

INSERT INTO public.cargos
  (maestra_id, alumno_id, fecha, concepto, monto, periodo, descripcion, created_at)
SELECT
  p.maestra_id,
  p.alumno_id,
  (p.periodo || '-01')::date,
  'abono_mensual',
  COALESCE(
    (SELECT ab.monto_mensual FROM public.abonos ab
       WHERE ab.alumno_id = p.alumno_id AND ab.activo = true LIMIT 1),
    0
  ),
  p.periodo,
  'Abono mensual ' || p.periodo,
  MIN(p.created_at)
FROM public.pagos p
JOIN public.alumnos a ON a.id = p.alumno_id
WHERE a.modelo_cobro = 'abono_mensual'
  AND p.periodo IS NOT NULL
  AND p.deleted_at IS NULL
GROUP BY p.maestra_id, p.alumno_id, p.periodo
HAVING COALESCE(
  (SELECT ab.monto_mensual FROM public.abonos ab
     WHERE ab.alumno_id = p.alumno_id AND ab.activo = true LIMIT 1),
  0) > 0;

-- ============================================================
-- 3. Backfill de COBROS
-- ============================================================

-- ----------------------------------------------------------
-- 3.a por_clase, cuenta_corriente, abono_mensual:
--     cobros desde pagos(estado IN pagado, parcial)
--     (cuenta_corriente tiene dual-write: pagos Y movimientos.
--      Tomamos pagos porque trae medio_pago/comprobante.)
-- ----------------------------------------------------------

INSERT INTO public.cobros
  (maestra_id, alumno_id, fecha, monto, medio_pago, comprobante_url,
   nota, origen, created_at)
SELECT
  p.maestra_id,
  p.alumno_id,
  COALESCE(p.fecha_pago, p.created_at::date),
  p.monto,
  p.medio_pago,
  p.comprobante_url,
  p.nota,
  'importado',
  p.created_at
FROM public.pagos p
JOIN public.alumnos a ON a.id = p.alumno_id
WHERE p.estado IN ('pagado', 'parcial')
  AND p.deleted_at IS NULL
  AND a.modelo_cobro IN ('por_clase', 'cuenta_corriente', 'abono_mensual');

-- ----------------------------------------------------------
-- 3.b bolsa_creditos → pack: cobros desde movimientos pago_ingresado
--     (bolsa_creditos también dual-writea, tomamos movimientos
--      porque trae la info de créditos.)
-- ----------------------------------------------------------

INSERT INTO public.cobros
  (maestra_id, alumno_id, fecha, monto, creditos_otorgados,
   nota, origen, created_at)
SELECT
  m.maestra_id,
  m.alumno_id,
  m.created_at::date,
  m.monto,
  m.creditos,
  COALESCE(m.descripcion, 'Pack importado'),
  'pack',
  m.created_at
FROM public.movimientos_cuenta m
JOIN public.alumnos a ON a.id = m.alumno_id
WHERE a.modelo_cobro = 'bolsa_creditos'
  AND m.tipo_movimiento = 'pago_ingresado'
  AND m.monto > 0;

-- ============================================================
-- 4. Migrar modelo_cobro
--   cuenta_corriente → por_clase  (funcionalmente idénticos)
--   bolsa_creditos    → se mantiene (renombre simbólico a 'pack' es
--                       en la UI; el valor del enum sigue por compat)
-- ============================================================

UPDATE public.alumnos
   SET modelo_cobro = 'por_clase'
 WHERE modelo_cobro = 'cuenta_corriente';

-- ============================================================
-- 5. Swap del trigger de saldo
-- ============================================================

-- Drop triggers viejos (los que actualizaban saldo desde pagos /
-- movimientos / clase_alumnos)
DROP TRIGGER IF EXISTS trg_pagos_saldo          ON public.pagos;
DROP TRIGGER IF EXISTS trg_mov_saldo            ON public.movimientos_cuenta;
DROP TRIGGER IF EXISTS trg_clase_alumnos_saldo  ON public.clase_alumnos;

-- Drop función vieja recalcular_saldo (firma de 2 args)
DROP FUNCTION IF EXISTS public.recalcular_saldo(uuid, uuid) CASCADE;

-- Función nueva: recalcular_saldo(alumno_id) — 1 solo arg, lee de
-- cargos/cobros, escribe en alumnos.saldo_actual + creditos_actual.
CREATE OR REPLACE FUNCTION public.recalcular_saldo(p_alumno_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deuda    numeric;
  v_creditos int;
BEGIN
  SELECT s.deuda, s.creditos_restantes
    INTO v_deuda, v_creditos
    FROM public.saldo_alumno_v2(p_alumno_id) s;

  UPDATE public.alumnos
     SET saldo_actual    = COALESCE(v_deuda, 0),
         creditos_actual = COALESCE(v_creditos, 0)
   WHERE id = p_alumno_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalcular_saldo(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.recalcular_saldo(uuid) TO authenticated;

-- Trigger function genérica
CREATE OR REPLACE FUNCTION public.trg_recalcular_saldo_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alumno_id uuid;
BEGIN
  v_alumno_id := COALESCE(NEW.alumno_id, OLD.alumno_id);
  IF v_alumno_id IS NOT NULL THEN
    PERFORM public.recalcular_saldo(v_alumno_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers nuevos: cargos y cobros mantienen saldo_actual sincronizado
DROP TRIGGER IF EXISTS trg_cargos_saldo ON public.cargos;
CREATE TRIGGER trg_cargos_saldo
  AFTER INSERT OR UPDATE OR DELETE ON public.cargos
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_saldo_v2();

DROP TRIGGER IF EXISTS trg_cobros_saldo ON public.cobros;
CREATE TRIGGER trg_cobros_saldo
  AFTER INSERT OR UPDATE OR DELETE ON public.cobros
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_saldo_v2();

-- ============================================================
-- 6. Recalcular saldos para todos los alumnos
-- (los triggers nuevos no se dispararon durante el backfill bulk
--  porque los creamos recién; lo hacemos manual ahora.)
-- ============================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.alumnos LOOP
    PERFORM public.recalcular_saldo(r.id);
  END LOOP;
END $$;

-- ============================================================
-- 7. Rename de funciones _v2 → nombres finales
--
-- saldo_alumno_v2                 → saldo_alumno
-- clases_pendientes_imputacion_v2 → reemplaza la v1 vieja (que leía
--                                   de pagos) con shape compatible.
-- ============================================================

ALTER FUNCTION public.saldo_alumno_v2(uuid) RENAME TO saldo_alumno;

-- La vieja clases_pendientes_imputacion (de 019) leía de pagos.
-- Hay que dropearla y reemplazarla con una que lea de cargos pero
-- exponga la misma shape que el código de la app espera.
DROP FUNCTION IF EXISTS public.clases_pendientes_imputacion(uuid);
DROP FUNCTION IF EXISTS public.clases_pendientes_imputacion_v2(uuid);

CREATE OR REPLACE FUNCTION public.clases_pendientes_imputacion(
  p_alumno_id uuid
)
RETURNS TABLE(
  clase_id        uuid,
  fecha           timestamptz,
  tema            text,
  monto_total     numeric,
  monto_imputado  numeric,
  pendiente       numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH imputado AS (
    SELECT cargo_id, COALESCE(SUM(monto_imputado), 0) AS total
      FROM public.imputaciones
     GROUP BY cargo_id
  )
  SELECT
    c.clase_id,
    c.fecha::timestamptz,
    c.descripcion,
    c.monto,
    COALESCE(i.total, 0),
    GREATEST(c.monto - COALESCE(i.total, 0), 0)
  FROM public.cargos c
  LEFT JOIN imputado i ON i.cargo_id = c.id
  WHERE c.alumno_id = p_alumno_id
    AND c.maestra_id = auth.uid()
    AND c.concepto = 'clase'
    AND c.clase_id IS NOT NULL
    AND c.deleted_at IS NULL
    AND c.monto - COALESCE(i.total, 0) > 0
  ORDER BY c.fecha ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.clases_pendientes_imputacion(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.clases_pendientes_imputacion(uuid) TO authenticated;

-- ============================================================
-- 8. Compatibilidad: calcular_saldo_alumno(alumno_id, maestra_id)
--
-- La app la consume con la shape vieja:
--   (clases_dictadas, total_facturado, total_cobrado, saldo_pendiente)
--
-- La preservamos como wrapper sobre saldo_alumno() + COUNT de
-- clase_alumnos. Cuando todo el código se refactorice a usar
-- saldo_alumno() directo, se puede deprecar.
-- ============================================================

DROP FUNCTION IF EXISTS public.calcular_saldo_alumno(uuid, uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.calcular_saldo_alumno(
  p_alumno_id  uuid,
  p_maestra_id uuid
)
RETURNS TABLE(
  clases_dictadas bigint,
  total_facturado numeric,
  total_cobrado   numeric,
  saldo_pendiente numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH n AS (
    SELECT COUNT(*)::bigint AS total
      FROM public.clase_alumnos ca
      JOIN public.clases c ON c.id = ca.clase_id
     WHERE ca.alumno_id = p_alumno_id
       AND c.maestra_id = p_maestra_id
  )
  SELECT n.total, s.total_cargado, s.total_cobrado, s.deuda
    FROM n, public.saldo_alumno(p_alumno_id) s;
$$;

REVOKE EXECUTE ON FUNCTION public.calcular_saldo_alumno(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.calcular_saldo_alumno(uuid, uuid) TO authenticated;

-- ============================================================
-- 9. calcular_saldos_maestra: ya leía de alumnos.saldo_actual.
-- Sigue funcionando porque ahora ese campo es la deuda nueva.
-- saldos_por_familia idem.
-- (no requieren cambio explícito acá)
-- ============================================================

-- ============================================================
-- 10. Notas para migración 029 (cleanup, en release posterior):
--
--   - Drop tabla abonos (los datos ya están en alumnos.monto_abono_mensual
--     y alumnos.tope_clases_mes).
--   - Drop tabla pagos y vista pagos_activos.
--   - Drop tabla movimientos_cuenta.
--   - Drop tabla imputaciones_pago (reemplazada por imputaciones).
--   - Drop enum estado_pago, tipo_movimiento_enum, pago_origen_enum.
--   - Remover valores 'cuenta_corriente' y 'bolsa_creditos' de
--     modelo_cobro_enum (requiere recrear el enum — operación
--     pesada que debe hacerse cuando no haya filas con esos valores).
-- ============================================================

COMMIT;
