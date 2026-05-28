-- ============================================================
-- Migración 029: Vistas de compatibilidad para la UI
--
-- Después de 028, las tablas pagos/movimientos_cuenta siguen existiendo
-- pero ya no son la fuente de verdad. Esta migración:
--
--   1. Reemplaza la vista pagos_activos para que ahora deriva de
--      cargos + cobros + imputaciones, conservando la SHAPE vieja
--      (id, alumno_id, maestra_id, monto, estado, fecha_pago,
--       created_at, deleted_at, periodo, clase_id, medio_pago,
--       comprobante_url, nota, origen).
--
--   2. Cada row de la vista es un CARGO. El estado se deriva:
--        - sin imputaciones:                'pendiente'
--        - imputaciones suman parcial:      'parcial'
--        - imputaciones cubren el monto:    'pagado'
--      Esto preserva el modelo mental de "un pago tiene estado"
--      que usa la UI hoy.
--
--   3. Los cobros sin imputación a ningún cargo no aparecen en
--      pagos_activos (no tienen "estado pendiente"). Se exponen
--      aparte en cobros_libres_activos para que las pages que
--      muestran saldo a favor puedan listarlos.
--
-- La vista es read-only. Los INSERT/UPDATE/DELETE deben hacerse
-- sobre cargos / cobros / imputaciones directamente.
-- ============================================================

-- Drop view vieja (puntea a la tabla pagos legacy)
DROP VIEW IF EXISTS public.pagos_activos;

CREATE VIEW public.pagos_activos AS
  WITH imputado AS (
    SELECT
      i.cargo_id,
      SUM(i.monto_imputado)                                AS total_imputado,
      MAX(cb.fecha)                                         AS ultima_fecha_cobro,
      -- Si todas las imputaciones del cargo apuntan a un mismo
      -- cobro, exponemos su medio/comprobante/nota; si son varias,
      -- dejamos NULL (la UI tendrá que mostrar "varios cobros").
      CASE WHEN COUNT(DISTINCT i.cobro_id) = 1
           THEN MAX(cb.medio_pago::text)::medio_pago_enum
           ELSE NULL END                                    AS medio_pago,
      CASE WHEN COUNT(DISTINCT i.cobro_id) = 1
           THEN MAX(cb.comprobante_url) ELSE NULL END       AS comprobante_url,
      CASE WHEN COUNT(DISTINCT i.cobro_id) = 1
           THEN MAX(cb.nota) ELSE NULL END                  AS nota_cobro
    FROM public.imputaciones i
    JOIN public.cobros cb ON cb.id = i.cobro_id AND cb.deleted_at IS NULL
    GROUP BY i.cargo_id
  )
  SELECT
    c.id,
    c.maestra_id,
    c.alumno_id,
    c.clase_id,
    c.monto,
    CASE
      WHEN imp.total_imputado IS NULL                  THEN 'pendiente'
      WHEN imp.total_imputado >= c.monto - 0.005       THEN 'pagado'
      ELSE                                                  'parcial'
    END::estado_pago                                       AS estado,
    imp.ultima_fecha_cobro                                 AS fecha_pago,
    c.periodo,
    COALESCE(imp.medio_pago, NULL)                         AS medio_pago,
    COALESCE(imp.comprobante_url, NULL)                    AS comprobante_url,
    COALESCE(imp.nota_cobro, c.descripcion)                AS nota,
    -- pago_origen_enum (definido en 018) tiene: manual, auto_clase,
    -- abono_excedente. Lo derivamos del concepto+descripción del cargo
    -- para mantener la semántica de la columna `origen` que la UI
    -- usaba para los badges "Auto" / "Excedente".
    CASE
      WHEN c.concepto = 'abono_mensual'         THEN 'auto_clase'
      WHEN c.descripcion ILIKE '%excedente%'    THEN 'abono_excedente'
      ELSE                                           'manual'
    END::pago_origen_enum                                  AS origen,
    c.deleted_at,
    c.created_at,
    c.updated_at
  FROM public.cargos c
  LEFT JOIN imputado imp ON imp.cargo_id = c.id
  WHERE c.deleted_at IS NULL;

COMMENT ON VIEW public.pagos_activos IS
  'Vista compat: cada row es un cargo. El estado se deriva de las imputaciones de cobros. Read-only.';

-- ============================================================
-- cobros_libres_activos: cobros sin imputación total a ningún cargo
-- (representa "saldo a favor" del alumno)
-- ============================================================

CREATE OR REPLACE VIEW public.cobros_libres_activos AS
  WITH imp_cobro AS (
    SELECT cobro_id, SUM(monto_imputado) AS total_imputado
      FROM public.imputaciones
     GROUP BY cobro_id
  )
  SELECT
    cb.id,
    cb.maestra_id,
    cb.alumno_id,
    cb.fecha,
    cb.monto,
    cb.monto - COALESCE(ic.total_imputado, 0) AS monto_libre,
    cb.medio_pago,
    cb.comprobante_url,
    cb.nota,
    cb.origen,
    cb.creditos_otorgados,
    cb.created_at
  FROM public.cobros cb
  LEFT JOIN imp_cobro ic ON ic.cobro_id = cb.id
  WHERE cb.deleted_at IS NULL
    AND cb.monto - COALESCE(ic.total_imputado, 0) > 0;

COMMENT ON VIEW public.cobros_libres_activos IS
  'Cobros con monto no imputado a ningún cargo (saldo a favor del alumno).';
