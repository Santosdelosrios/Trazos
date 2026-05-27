-- ============================================================
-- Migración 019: PR-3 — Medio de pago + comprobante + soft delete + imputaciones
--
-- Bloques:
--   1. medio_pago_enum + columnas en pagos
--   2. Soft delete en pagos y gastos (deleted_at + updated_at)
--   3. Vistas pagos_activos / gastos_activos con filtro real
--   4. Tabla imputaciones_pago (cobro parcial → clases específicas)
--   5. Refactor de funciones SQL para respetar soft delete
--
-- Todo aditivo, nullable, backward-compatible.
-- ============================================================

-- 1. Medio de pago -------------------------------------------------

DO $$ BEGIN
  CREATE TYPE medio_pago_enum AS ENUM (
    'efectivo',
    'transferencia',
    'mercadopago',
    'otro'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS medio_pago      medio_pago_enum,
  ADD COLUMN IF NOT EXISTS comprobante_url text;

COMMENT ON COLUMN public.pagos.medio_pago IS
  'Cómo se cobró. Required cuando estado pasa a pagado/parcial; nullable para pagos pendientes.';
COMMENT ON COLUMN public.pagos.comprobante_url IS
  'Path en Supabase Storage (bucket comprobantes-pagos). NULL si no se adjuntó.';

-- 2. Soft delete -----------------------------------------------------

ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Reuso la función trg_set_updated_at creada en 017_familias.sql
DROP TRIGGER IF EXISTS trg_pagos_updated_at ON public.pagos;
CREATE TRIGGER trg_pagos_updated_at
  BEFORE UPDATE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_gastos_updated_at ON public.gastos;
CREATE TRIGGER trg_gastos_updated_at
  BEFORE UPDATE ON public.gastos
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- Índices para queries que filtran por deleted_at
CREATE INDEX IF NOT EXISTS idx_pagos_activos
  ON public.pagos(maestra_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gastos_activos
  ON public.gastos(maestra_id) WHERE deleted_at IS NULL;

-- 3. Vistas *_activos (recreadas con filtro real) -------------------

DROP VIEW IF EXISTS public.pagos_activos;
CREATE VIEW public.pagos_activos AS
  SELECT * FROM public.pagos WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.gastos_activos AS
  SELECT * FROM public.gastos WHERE deleted_at IS NULL;

COMMENT ON VIEW public.pagos_activos IS
  'Pagos no eliminados. Las queries de listado deben usar esta vista.';
COMMENT ON VIEW public.gastos_activos IS
  'Gastos no eliminados. Las queries de listado deben usar esta vista.';

-- 4. Tabla imputaciones_pago ---------------------------------------
--
-- Cobro parcial: cuando la maestra recibe un monto menor al saldo
-- total, "imputa" a clases específicas (FIFO por default, modificable).
-- Una imputación = "este pago cubre esta clase por este monto".
--
-- Reglas:
--   - SUM(imputaciones.monto_imputado WHERE pago_id = X) ≤ pagos.monto
--   - Múltiples imputaciones por pago (cuando cubre varias clases)
--   - Si se soft-deletea el pago, las imputaciones quedan implícitamente
--     ignoradas (los joins parten de pagos_activos).

CREATE TABLE IF NOT EXISTS public.imputaciones_pago (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pago_id         uuid NOT NULL REFERENCES public.pagos(id) ON DELETE CASCADE,
  clase_id        uuid NOT NULL REFERENCES public.clases(id) ON DELETE CASCADE,
  monto_imputado  numeric(10,2) NOT NULL CHECK (monto_imputado > 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imputaciones_pago    ON public.imputaciones_pago(pago_id);
CREATE INDEX IF NOT EXISTS idx_imputaciones_clase   ON public.imputaciones_pago(clase_id);

ALTER TABLE public.imputaciones_pago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imputaciones_own_maestra" ON public.imputaciones_pago;
CREATE POLICY "imputaciones_own_maestra" ON public.imputaciones_pago
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.pagos p
       WHERE p.id = imputaciones_pago.pago_id
         AND p.maestra_id = auth.uid()
    )
  );

COMMENT ON TABLE public.imputaciones_pago IS
  'Trazabilidad de cobro parcial: qué pago cubre qué clase y por cuánto.';

-- 5. Refactor de funciones SQL para respetar soft delete -----------
--
-- Cualquier función que sumaba pagos sin filtro de deleted_at se
-- recrea acá filtrando. Mantenemos misma firma y semántica.
--
-- Importante: Postgres rechaza CREATE OR REPLACE FUNCTION cuando los
-- OUT parameters (los que define RETURNS TABLE) cambian de tipo o
-- nombre, incluso si la nueva firma es "igual" a la teórica. Para
-- evitar el error 42P13 cuando la función ya existe en la DB con una
-- firma ligeramente distinta (típico cuando se parcheó manualmente),
-- la dropeamos primero. CASCADE arrastra triggers que dependan de
-- ella (los recreamos abajo).

DROP FUNCTION IF EXISTS public.recalcular_saldo(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.resumen_financiero_mes(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.obtener_metricas_negocio(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.calcular_saldo_alumno(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.saldos_por_familia(uuid) CASCADE;

-- 5.a recalcular_saldo (de 015) — actualiza alumnos.saldo_actual
CREATE OR REPLACE FUNCTION public.recalcular_saldo(
  p_alumno_id uuid,
  p_maestra_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_modelo  modelo_cobro_enum;
  v_tarifa  numeric;
  v_saldo   numeric := 0;
BEGIN
  SELECT modelo_cobro INTO v_modelo
    FROM public.alumnos WHERE id = p_alumno_id;

  IF v_modelo IS NULL THEN RETURN 0; END IF;

  CASE v_modelo

    WHEN 'por_clase' THEN
      SELECT COALESCE(
        (SELECT tarifa_override FROM public.alumnos WHERE id = p_alumno_id),
        (SELECT valor_hora FROM public.tarifas
          WHERE maestra_id = p_maestra_id AND activa = true
          ORDER BY vigente_desde DESC LIMIT 1),
        0
      ) INTO v_tarifa;

      SELECT
        (COUNT(ca.*) * v_tarifa)
        - COALESCE(
            (SELECT SUM(p.monto) FROM public.pagos p
              WHERE p.alumno_id = p_alumno_id
                AND p.maestra_id = p_maestra_id
                AND p.estado IN ('pagado', 'parcial')
                AND p.deleted_at IS NULL),
            0)
        INTO v_saldo
      FROM public.clase_alumnos ca
      JOIN public.clases c ON c.id = ca.clase_id
      WHERE ca.alumno_id = p_alumno_id AND c.maestra_id = p_maestra_id;

    WHEN 'bolsa_creditos' THEN
      SELECT COALESCE(SUM(creditos), 0) INTO v_saldo
        FROM public.movimientos_cuenta
       WHERE alumno_id = p_alumno_id AND maestra_id = p_maestra_id;

    WHEN 'abono_mensual' THEN
      SELECT
        (COUNT(DISTINCT p.periodo)
          * COALESCE(
              (SELECT ab.monto_mensual FROM public.abonos ab
                WHERE ab.alumno_id = p_alumno_id AND ab.activo = true LIMIT 1),
              0))
        - COALESCE(SUM(CASE WHEN p.estado IN ('pagado','parcial') THEN p.monto ELSE 0 END), 0)
        INTO v_saldo
      FROM public.pagos p
      WHERE p.alumno_id = p_alumno_id
        AND p.maestra_id = p_maestra_id
        AND p.periodo IS NOT NULL
        AND p.deleted_at IS NULL;

    WHEN 'cuenta_corriente' THEN
      SELECT COALESCE(SUM(monto), 0) * -1 INTO v_saldo
        FROM public.movimientos_cuenta
       WHERE alumno_id = p_alumno_id AND maestra_id = p_maestra_id;

  END CASE;

  UPDATE public.alumnos SET saldo_actual = COALESCE(v_saldo, 0)
   WHERE id = p_alumno_id;

  RETURN COALESCE(v_saldo, 0);
END;
$$;

-- Trigger en pagos: dispara también con UPDATE de deleted_at (soft delete)
-- → ya está cubierto porque trg_pagos_saldo escucha AFTER INSERT OR UPDATE OR DELETE.

-- 5.b resumen_financiero_mes (de 005) — filtra deleted
CREATE OR REPLACE FUNCTION public.resumen_financiero_mes(p_maestra_id uuid)
RETURNS TABLE(
  ingresos_mes numeric,
  gastos_mes numeric,
  ganancia_neta numeric,
  pagos_pendientes bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH ingresos AS (
    SELECT COALESCE(SUM(monto), 0) AS total
    FROM public.pagos
    WHERE maestra_id = p_maestra_id
      AND estado = 'pagado'
      AND deleted_at IS NULL
      AND fecha_pago >= date_trunc('month', CURRENT_DATE)
  ),
  gastos AS (
    SELECT COALESCE(SUM(monto), 0) AS total
    FROM public.gastos
    WHERE maestra_id = p_maestra_id
      AND deleted_at IS NULL
      AND fecha >= date_trunc('month', CURRENT_DATE)
  ),
  pendientes AS (
    SELECT COUNT(*) AS total
    FROM public.pagos
    WHERE maestra_id = p_maestra_id
      AND estado = 'pendiente'
      AND deleted_at IS NULL
  )
  SELECT
    ingresos.total,
    gastos.total,
    ingresos.total - gastos.total,
    pendientes.total
  FROM ingresos, gastos, pendientes;
$$;

-- 5.c obtener_metricas_negocio (de 007) — filtra deleted
CREATE OR REPLACE FUNCTION public.obtener_metricas_negocio(p_maestra_id uuid)
RETURNS TABLE (
  horas_mes bigint,
  alumno_estrella text,
  materia_top text
) AS $$
DECLARE
  v_horas bigint;
  v_alumno text;
  v_materia text;
BEGIN
  SELECT COUNT(*) INTO v_horas
  FROM public.clases
  WHERE maestra_id = p_maestra_id
    AND fecha >= date_trunc('month', CURRENT_DATE);

  SELECT (a.nombre || ' ' || a.apellido) INTO v_alumno
  FROM public.pagos p
  JOIN public.alumnos a ON p.alumno_id = a.id
  WHERE p.maestra_id = p_maestra_id
    AND p.estado = 'pagado'
    AND p.deleted_at IS NULL
  GROUP BY a.id, a.nombre, a.apellido
  ORDER BY SUM(p.monto) DESC
  LIMIT 1;

  SELECT materia INTO v_materia
  FROM public.clases
  WHERE maestra_id = p_maestra_id
    AND fecha >= date_trunc('month', CURRENT_DATE)
  GROUP BY materia
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  RETURN QUERY SELECT
    COALESCE(v_horas, 0),
    COALESCE(v_alumno, '—'),
    COALESCE(v_materia, '—');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.d calcular_saldo_alumno (de 015) — filtra deleted en todos los subselects
CREATE OR REPLACE FUNCTION public.calcular_saldo_alumno(
  p_alumno_id uuid,
  p_maestra_id uuid
)
RETURNS TABLE(
  clases_dictadas bigint,
  total_facturado numeric,
  total_cobrado numeric,
  saldo_pendiente numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_modelo modelo_cobro_enum;
  v_clases bigint;
BEGIN
  SELECT modelo_cobro INTO v_modelo
    FROM public.alumnos WHERE id = p_alumno_id;

  SELECT COUNT(*) INTO v_clases
    FROM public.clase_alumnos ca
    JOIN public.clases c ON c.id = ca.clase_id
   WHERE ca.alumno_id = p_alumno_id AND c.maestra_id = p_maestra_id;

  PERFORM public.recalcular_saldo(p_alumno_id, p_maestra_id);

  CASE v_modelo

    WHEN 'por_clase' THEN
      RETURN QUERY
        SELECT v_clases,
          (SELECT saldo_actual + COALESCE(SUM(p.monto),0)
             FROM public.pagos p
            WHERE p.alumno_id = p_alumno_id AND p.maestra_id = p_maestra_id
              AND p.estado IN ('pagado','parcial')
              AND p.deleted_at IS NULL),
          COALESCE((SELECT SUM(p.monto) FROM public.pagos p
            WHERE p.alumno_id = p_alumno_id AND p.maestra_id = p_maestra_id
              AND p.estado IN ('pagado','parcial')
              AND p.deleted_at IS NULL), 0),
          (SELECT saldo_actual FROM public.alumnos WHERE id = p_alumno_id);

    WHEN 'bolsa_creditos' THEN
      RETURN QUERY
        SELECT v_clases,
          COALESCE((SELECT SUM(creditos) FROM public.movimientos_cuenta
            WHERE alumno_id = p_alumno_id AND maestra_id = p_maestra_id
              AND creditos > 0), 0)::numeric,
          v_clases::numeric,
          (SELECT saldo_actual FROM public.alumnos WHERE id = p_alumno_id);

    WHEN 'abono_mensual' THEN
      RETURN QUERY
        SELECT v_clases,
          (SELECT COUNT(DISTINCT periodo) *
            COALESCE((SELECT monto_mensual FROM public.abonos
              WHERE alumno_id = p_alumno_id AND activo = true LIMIT 1), 0)
            FROM public.pagos WHERE alumno_id = p_alumno_id
              AND maestra_id = p_maestra_id AND periodo IS NOT NULL
              AND deleted_at IS NULL),
          COALESCE((SELECT SUM(monto) FROM public.pagos
            WHERE alumno_id = p_alumno_id AND maestra_id = p_maestra_id
              AND estado IN ('pagado','parcial')
              AND deleted_at IS NULL), 0),
          (SELECT saldo_actual FROM public.alumnos WHERE id = p_alumno_id);

    WHEN 'cuenta_corriente' THEN
      RETURN QUERY
        SELECT v_clases,
          COALESCE((SELECT SUM(ABS(monto)) FROM public.movimientos_cuenta
            WHERE alumno_id = p_alumno_id AND maestra_id = p_maestra_id
              AND monto < 0), 0),
          COALESCE((SELECT SUM(monto) FROM public.movimientos_cuenta
            WHERE alumno_id = p_alumno_id AND maestra_id = p_maestra_id
              AND monto > 0), 0),
          (SELECT saldo_actual FROM public.alumnos WHERE id = p_alumno_id);

  END CASE;
END;
$$;

-- 5.e saldos_por_familia (de 017) — filtra deleted en ultimo_pago
CREATE OR REPLACE FUNCTION public.saldos_por_familia(p_maestra_id uuid)
RETURNS TABLE(
  familia_id           uuid,
  nombre               text,
  responsable_nombre   text,
  responsable_telefono text,
  cant_alumnos         bigint,
  saldo_total          numeric,
  ultimo_pago          date,
  ultima_clase         timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH miembros AS (
    SELECT a.id, a.familia_id, a.saldo_actual, a.modelo_cobro
      FROM public.alumnos a
     WHERE a.maestra_id = p_maestra_id
       AND a.familia_id IS NOT NULL
  ),
  saldos AS (
    SELECT
      m.familia_id,
      COUNT(*) AS cant_alumnos,
      COALESCE(SUM(
        CASE WHEN m.modelo_cobro IN ('por_clase','abono_mensual','cuenta_corriente')
             THEN m.saldo_actual
             ELSE 0
        END
      ), 0) AS saldo_total
    FROM miembros m
    GROUP BY m.familia_id
  ),
  ultimo_pago AS (
    SELECT a.familia_id, MAX(p.fecha_pago) AS fecha
      FROM public.pagos p
      JOIN public.alumnos a ON a.id = p.alumno_id
     WHERE p.maestra_id = p_maestra_id
       AND a.familia_id IS NOT NULL
       AND p.estado IN ('pagado','parcial')
       AND p.deleted_at IS NULL
     GROUP BY a.familia_id
  ),
  ultima_clase AS (
    SELECT a.familia_id, MAX(c.fecha) AS fecha
      FROM public.clases c
      JOIN public.clase_alumnos ca ON ca.clase_id = c.id
      JOIN public.alumnos a ON a.id = ca.alumno_id
     WHERE c.maestra_id = p_maestra_id
       AND a.familia_id IS NOT NULL
     GROUP BY a.familia_id
  )
  SELECT
    f.id,
    f.nombre,
    f.responsable_nombre,
    f.responsable_telefono,
    COALESCE(s.cant_alumnos, 0),
    COALESCE(s.saldo_total, 0),
    up.fecha,
    uc.fecha
  FROM public.familias f
  LEFT JOIN saldos       s  ON s.familia_id  = f.id
  LEFT JOIN ultimo_pago  up ON up.familia_id = f.id
  LEFT JOIN ultima_clase uc ON uc.familia_id = f.id
  WHERE f.maestra_id = p_maestra_id
    AND f.deleted_at IS NULL
  ORDER BY f.nombre;
$$;

-- 6. RPC nueva: clases_pendientes_imputacion(alumno_id) -------------
--
-- Devuelve las clases del alumno que aún no están totalmente cubiertas
-- por imputaciones de pagos. Usada por el modal "Confirmar pago" para
-- mostrar la lista FIFO de clases candidatas a imputar.

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
SECURITY DEFINER
AS $$
  WITH clases_alumno AS (
    SELECT
      c.id AS clase_id,
      c.fecha,
      c.tema,
      COALESCE(
        (SELECT p.monto FROM public.pagos p
          WHERE p.clase_id = c.id AND p.alumno_id = p_alumno_id
            AND p.deleted_at IS NULL
          ORDER BY p.created_at LIMIT 1),
        0
      ) AS monto_total
    FROM public.clase_alumnos ca
    JOIN public.clases c ON c.id = ca.clase_id
    WHERE ca.alumno_id = p_alumno_id
      AND c.maestra_id = auth.uid()
  ),
  imputado AS (
    SELECT
      ip.clase_id,
      SUM(ip.monto_imputado) AS total
    FROM public.imputaciones_pago ip
    JOIN public.pagos p ON p.id = ip.pago_id
    WHERE p.alumno_id = p_alumno_id
      AND p.deleted_at IS NULL
    GROUP BY ip.clase_id
  )
  SELECT
    ca.clase_id,
    ca.fecha,
    ca.tema,
    ca.monto_total,
    COALESCE(i.total, 0),
    GREATEST(ca.monto_total - COALESCE(i.total, 0), 0)
  FROM clases_alumno ca
  LEFT JOIN imputado i ON i.clase_id = ca.clase_id
  WHERE ca.monto_total > 0
    AND ca.monto_total - COALESCE(i.total, 0) > 0
  ORDER BY ca.fecha ASC;  -- FIFO: las más viejas primero
$$;

REVOKE EXECUTE ON FUNCTION public.clases_pendientes_imputacion(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.clases_pendientes_imputacion(uuid) TO authenticated;

-- 7. Recreación de triggers de saldo --------------------------------
--
-- El DROP FUNCTION ... CASCADE de la sección 5 borró en cadena:
--   - public.trg_recalcular_saldo() (trigger function que llama a recalcular_saldo)
--   - los 3 triggers que la usan en pagos / movimientos_cuenta / clase_alumnos
--
-- Sin ellos, alumnos.saldo_actual deja de actualizarse al modificar
-- las tablas fuente. Replicamos acá exactamente lo que definió 015,
-- agregando la lectura de deleted_at para que el soft delete también
-- recalcule.

CREATE OR REPLACE FUNCTION public.trg_recalcular_saldo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alumno_id  uuid;
  v_maestra_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'movimientos_cuenta' THEN
    v_alumno_id  := COALESCE(NEW.alumno_id, OLD.alumno_id);
    v_maestra_id := COALESCE(NEW.maestra_id, OLD.maestra_id);

  ELSIF TG_TABLE_NAME = 'pagos' THEN
    v_alumno_id  := COALESCE(NEW.alumno_id, OLD.alumno_id);
    v_maestra_id := COALESCE(NEW.maestra_id, OLD.maestra_id);

  ELSIF TG_TABLE_NAME = 'clase_alumnos' THEN
    v_alumno_id := COALESCE(NEW.alumno_id, OLD.alumno_id);
    SELECT c.maestra_id INTO v_maestra_id
      FROM public.clases c
     WHERE c.id = COALESCE(NEW.clase_id, OLD.clase_id);
  END IF;

  IF v_alumno_id IS NOT NULL AND v_maestra_id IS NOT NULL THEN
    PERFORM public.recalcular_saldo(v_alumno_id, v_maestra_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers en movimientos_cuenta
DROP TRIGGER IF EXISTS trg_mov_saldo ON public.movimientos_cuenta;
CREATE TRIGGER trg_mov_saldo
  AFTER INSERT OR UPDATE OR DELETE ON public.movimientos_cuenta
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_saldo();

-- Triggers en pagos: el UPDATE captura también el soft delete
-- (cuando deleted_at pasa de NULL a un timestamp).
DROP TRIGGER IF EXISTS trg_pagos_saldo ON public.pagos;
CREATE TRIGGER trg_pagos_saldo
  AFTER INSERT OR UPDATE OR DELETE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_saldo();

-- Triggers en clase_alumnos (afecta modelo por_clase)
DROP TRIGGER IF EXISTS trg_clase_alumnos_saldo ON public.clase_alumnos;
CREATE TRIGGER trg_clase_alumnos_saldo
  AFTER INSERT OR DELETE ON public.clase_alumnos
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_saldo();

-- 8. Permisos para las funciones recreadas --------------------------
-- DROP FUNCTION limpia los GRANT existentes, así que los repongo.

REVOKE EXECUTE ON FUNCTION public.recalcular_saldo(uuid, uuid)   FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.recalcular_saldo(uuid, uuid)   TO authenticated;

REVOKE EXECUTE ON FUNCTION public.calcular_saldo_alumno(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.calcular_saldo_alumno(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.saldos_por_familia(uuid)       FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.saldos_por_familia(uuid)       TO authenticated;
