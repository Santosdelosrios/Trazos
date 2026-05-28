-- ============================================================
-- Script de validación: simula el saldo post-migración 028
-- sin tocar datos, y reporta divergencias contra el saldo vigente.
--
-- Es read-only. Seguro de correr en producción.
--
-- USO:
--   psql ... -f supabase/scripts/validar_migracion_027.sql
--   SELECT * FROM validar_migracion_finanzas();             -- toda la base
--   SELECT * FROM validar_migracion_finanzas('<maestra>');  -- una sola
--
-- Se instala como dos funciones SQL en el schema public:
--   simular_saldo_post_migracion(alumno_id) → (deuda, creditos_restantes)
--   validar_migracion_finanzas(maestra_id?) → tabla con divergencias
--
-- Para limpiar:
--   DROP FUNCTION simular_saldo_post_migracion(uuid);
--   DROP FUNCTION validar_migracion_finanzas(uuid);
--
-- Traducción que simula:
--   por_clase / cuenta_corriente → migrados ambos a por_clase
--     cargos:  clase_alumnos × tarifa_efectiva  (por_clase)
--              movimientos_cuenta(clase_descontada) × |monto|  (cuenta_corriente)
--     cobros:  pagos(estado IN pagado,parcial) (por_clase)
--              movimientos_cuenta(pago_ingresado) × monto  (cuenta_corriente)
--
--   bolsa_creditos → pack
--     cargos:  movimientos(clase_descontada): creditos_consumidos=|creditos|,
--              monto = tarifa_efectiva (×|creditos|)
--     cobros:  movimientos(pago_ingresado): creditos_otorgados=creditos,
--              monto = movimientos.monto
--     comparación: creditos_restantes (saldo viejo está en créditos, no plata)
--
--   abono_mensual → idéntico
--     cargos:  COUNT(DISTINCT periodo de pagos) × monto_mensual
--              (replica el bug del COUNT(DISTINCT periodo), a propósito,
--               para que el backfill no introduzca cambios contables.
--               El fix se aplica gradualmente a partir del swap.)
--     cobros:  pagos(estado IN pagado,parcial)
-- ============================================================

-- ============================================================
-- simular_saldo_post_migracion(alumno_id)
-- ============================================================

CREATE OR REPLACE FUNCTION public.simular_saldo_post_migracion(
  p_alumno_id uuid
)
RETURNS TABLE(
  deuda               numeric,
  creditos_restantes  int,
  total_cargado       numeric,
  total_cobrado       numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_modelo      text;
  v_maestra_id  uuid;
  v_tarifa      numeric;
  v_monto_abono numeric;
BEGIN
  SELECT modelo_cobro::text, maestra_id
    INTO v_modelo, v_maestra_id
    FROM public.alumnos
   WHERE id = p_alumno_id;

  IF v_modelo IS NULL THEN
    RETURN QUERY SELECT 0::numeric, 0, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  -- Tarifa efectiva (override del alumno, o tarifa activa de la maestra)
  SELECT COALESCE(
    (SELECT tarifa_override FROM public.alumnos WHERE id = p_alumno_id),
    (SELECT valor_hora FROM public.tarifas
       WHERE maestra_id = v_maestra_id AND activa = true
       ORDER BY vigente_desde DESC LIMIT 1),
    0
  ) INTO v_tarifa;

  CASE v_modelo

    -- ----------------------------------------------------------
    -- por_clase: deuda = clases × tarifa − pagos cobrados
    -- ----------------------------------------------------------
    WHEN 'por_clase' THEN
      RETURN QUERY
      WITH cg AS (
        SELECT COUNT(ca.*) * v_tarifa AS total
          FROM public.clase_alumnos ca
          JOIN public.clases c ON c.id = ca.clase_id
         WHERE ca.alumno_id = p_alumno_id
           AND c.maestra_id = v_maestra_id
      ),
      cb AS (
        SELECT COALESCE(SUM(monto), 0) AS total
          FROM public.pagos
         WHERE alumno_id = p_alumno_id
           AND maestra_id = v_maestra_id
           AND estado IN ('pagado', 'parcial')
           AND deleted_at IS NULL
      )
      SELECT cg.total - cb.total, 0, cg.total, cb.total
        FROM cg, cb;

    -- ----------------------------------------------------------
    -- cuenta_corriente → migra a por_clase
    -- Cargos y cobros vienen de movimientos_cuenta.
    -- ----------------------------------------------------------
    WHEN 'cuenta_corriente' THEN
      RETURN QUERY
      WITH cg AS (
        SELECT COALESCE(SUM(ABS(monto)), 0) AS total
          FROM public.movimientos_cuenta
         WHERE alumno_id = p_alumno_id
           AND maestra_id = v_maestra_id
           AND monto < 0  -- clase_descontada o cualquier cargo
      ),
      cb AS (
        SELECT COALESCE(SUM(monto), 0) AS total
          FROM public.movimientos_cuenta
         WHERE alumno_id = p_alumno_id
           AND maestra_id = v_maestra_id
           AND monto > 0  -- pago_ingresado
      )
      SELECT cg.total - cb.total, 0, cg.total, cb.total
        FROM cg, cb;

    -- ----------------------------------------------------------
    -- bolsa_creditos → pack
    -- Saldo viejo está en CRÉDITOS, no en pesos. La comparación
    -- clave es creditos_restantes. El monto es informativo.
    -- ----------------------------------------------------------
    WHEN 'bolsa_creditos' THEN
      RETURN QUERY
      WITH cg AS (
        SELECT
          COALESCE(SUM(ABS(creditos)), 0)::int   AS cred,
          COALESCE(SUM(ABS(creditos)), 0) * v_tarifa AS monto
        FROM public.movimientos_cuenta
        WHERE alumno_id = p_alumno_id
          AND maestra_id = v_maestra_id
          AND creditos < 0
      ),
      cb AS (
        SELECT
          COALESCE(SUM(creditos), 0)::int  AS cred,
          COALESCE(SUM(monto), 0)          AS monto
        FROM public.movimientos_cuenta
        WHERE alumno_id = p_alumno_id
          AND maestra_id = v_maestra_id
          AND creditos > 0
      )
      SELECT cg.monto - cb.monto, cb.cred - cg.cred, cg.monto, cb.monto
        FROM cg, cb;

    -- ----------------------------------------------------------
    -- abono_mensual: COUNT(DISTINCT periodo) × monto_mensual
    -- Replica el bug a propósito (el backfill no cambia números).
    -- ----------------------------------------------------------
    WHEN 'abono_mensual' THEN
      SELECT COALESCE(
        (SELECT monto_mensual FROM public.abonos
          WHERE alumno_id = p_alumno_id AND activo = true LIMIT 1),
        0
      ) INTO v_monto_abono;

      RETURN QUERY
      WITH cg AS (
        SELECT COUNT(DISTINCT periodo) * v_monto_abono AS total
          FROM public.pagos
         WHERE alumno_id = p_alumno_id
           AND maestra_id = v_maestra_id
           AND periodo IS NOT NULL
           AND deleted_at IS NULL
      ),
      cb AS (
        SELECT COALESCE(SUM(monto), 0) AS total
          FROM public.pagos
         WHERE alumno_id = p_alumno_id
           AND maestra_id = v_maestra_id
           AND estado IN ('pagado', 'parcial')
           AND deleted_at IS NULL
      )
      SELECT cg.total - cb.total, 0, cg.total, cb.total
        FROM cg, cb;

    ELSE
      RETURN QUERY SELECT 0::numeric, 0, 0::numeric, 0::numeric;
  END CASE;
END;
$$;

-- Solo admin/service_role. Estas son herramientas de devops, no de UI.
REVOKE EXECUTE ON FUNCTION public.simular_saldo_post_migracion(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- validar_migracion_finanzas(maestra_id?)
--
-- Devuelve UNA fila por alumno donde el saldo nuevo difiera del viejo
-- en más de $0.01 (o, para bolsa_creditos, donde difieran los créditos).
--
-- Si maestra_id es NULL, valida toda la base.
--
-- status:
--   OK         → no aparece (filtrado)
--   WARN       → divergencia chica (≤ tarifa, posible rounding)
--   ERROR      → divergencia grande, requiere investigación
-- ============================================================

CREATE OR REPLACE FUNCTION public.validar_migracion_finanzas(
  p_maestra_id uuid DEFAULT NULL
)
RETURNS TABLE(
  status              text,
  alumno_id           uuid,
  alumno_nombre       text,
  modelo_cobro        text,
  saldo_viejo         numeric,
  saldo_nuevo         numeric,
  diff                numeric,
  creditos_viejo      int,
  creditos_nuevo      int,
  diff_creditos       int,
  total_cargado_new   numeric,
  total_cobrado_new   numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_tarifa numeric;
BEGIN
  RETURN QUERY
  WITH alumnos_scope AS (
    SELECT a.id, a.maestra_id, a.modelo_cobro::text AS modelo,
           (a.nombre || ' ' || a.apellido) AS nombre,
           a.saldo_actual,
           COALESCE(
             (SELECT valor_hora FROM public.tarifas
               WHERE maestra_id = a.maestra_id AND activa = true
               ORDER BY vigente_desde DESC LIMIT 1),
             0
           ) AS tarifa
      FROM public.alumnos a
     WHERE (p_maestra_id IS NULL OR a.maestra_id = p_maestra_id)
  ),
  simulado AS (
    SELECT
      a.id          AS alumno_id,
      a.modelo,
      a.nombre,
      a.maestra_id,
      a.saldo_actual,
      a.tarifa,
      s.deuda,
      s.creditos_restantes,
      s.total_cargado,
      s.total_cobrado
    FROM alumnos_scope a,
         LATERAL public.simular_saldo_post_migracion(a.id) s
  ),
  comparado AS (
    SELECT
      s.alumno_id,
      s.modelo,
      s.nombre,
      s.tarifa,
      -- Comparación según modelo
      CASE s.modelo
        WHEN 'bolsa_creditos' THEN s.saldo_actual  -- en créditos
        ELSE s.saldo_actual                         -- en pesos
      END AS saldo_viejo,
      CASE s.modelo
        WHEN 'bolsa_creditos' THEN s.creditos_restantes::numeric
        ELSE s.deuda
      END AS saldo_nuevo,
      s.saldo_actual::int AS creditos_viejo,
      s.creditos_restantes AS creditos_nuevo,
      s.total_cargado,
      s.total_cobrado
    FROM simulado s
  )
  SELECT
    CASE
      WHEN c.modelo = 'bolsa_creditos' AND ABS(c.creditos_viejo - c.creditos_nuevo) = 0
        THEN 'OK'
      WHEN c.modelo = 'bolsa_creditos'
        THEN CASE WHEN ABS(c.creditos_viejo - c.creditos_nuevo) <= 1 THEN 'WARN' ELSE 'ERROR' END
      WHEN ABS(c.saldo_viejo - c.saldo_nuevo) < 0.01 THEN 'OK'
      WHEN ABS(c.saldo_viejo - c.saldo_nuevo) <= COALESCE(c.tarifa, 0)
        THEN 'WARN'
      ELSE 'ERROR'
    END AS status,
    c.alumno_id,
    c.nombre,
    c.modelo,
    c.saldo_viejo,
    c.saldo_nuevo,
    c.saldo_nuevo - c.saldo_viejo AS diff,
    c.creditos_viejo,
    c.creditos_nuevo,
    c.creditos_nuevo - c.creditos_viejo AS diff_creditos,
    c.total_cargado,
    c.total_cobrado
  FROM comparado c
  WHERE
    (c.modelo = 'bolsa_creditos' AND c.creditos_viejo <> c.creditos_nuevo)
    OR (c.modelo <> 'bolsa_creditos' AND ABS(c.saldo_viejo - c.saldo_nuevo) >= 0.01)
  ORDER BY
    CASE
      WHEN c.modelo = 'bolsa_creditos' AND ABS(c.creditos_viejo - c.creditos_nuevo) > 1 THEN 0
      WHEN ABS(c.saldo_viejo - c.saldo_nuevo) > COALESCE(c.tarifa, 0) THEN 0
      ELSE 1
    END,
    ABS(c.saldo_viejo - c.saldo_nuevo) DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validar_migracion_finanzas(uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.validar_migracion_finanzas(uuid) IS
  'Compara saldo_actual viejo vs saldo simulado por el backfill 028. Devuelve solo divergencias. Read-only.';

-- ============================================================
-- Resumen agregado por maestra (útil para chequeo macro)
-- ============================================================

CREATE OR REPLACE FUNCTION public.resumen_validacion_finanzas(
  p_maestra_id uuid DEFAULT NULL
)
RETURNS TABLE(
  maestra_id        uuid,
  total_alumnos     bigint,
  ok                bigint,
  warn              bigint,
  error             bigint,
  suma_diff_abs     numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH base AS (
    SELECT a.maestra_id, a.id AS alumno_id
      FROM public.alumnos a
     WHERE (p_maestra_id IS NULL OR a.maestra_id = p_maestra_id)
  ),
  divergencias AS (
    SELECT v.alumno_id, v.status, ABS(v.diff) AS diff_abs
      FROM base b
      JOIN public.validar_migracion_finanzas(p_maestra_id) v ON v.alumno_id = b.alumno_id
  )
  SELECT
    b.maestra_id,
    COUNT(*)                                                        AS total_alumnos,
    COUNT(*) FILTER (WHERE d.alumno_id IS NULL)                     AS ok,
    COUNT(*) FILTER (WHERE d.status = 'WARN')                       AS warn,
    COUNT(*) FILTER (WHERE d.status = 'ERROR')                      AS error,
    COALESCE(SUM(d.diff_abs), 0)                                    AS suma_diff_abs
  FROM base b
  LEFT JOIN divergencias d ON d.alumno_id = b.alumno_id
  GROUP BY b.maestra_id
  ORDER BY error DESC, warn DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.resumen_validacion_finanzas(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Cómo interpretar los resultados
-- ============================================================
--
-- Status:
--   OK    → alumno no aparece. Migración va a producir el mismo saldo.
--   WARN  → diferencia menor a 1 tarifa (o 1 crédito en bolsa).
--           Suele ser:
--             - rounding en pagos parciales
--             - tarifa cambió desde el último recálculo cacheado
--             - alumno con tarifa_override que no se aplicó por error
--           Inspeccionar pero generalmente seguro de migrar.
--   ERROR → diferencia grande. Investigar antes del backfill. Posibles causas:
--             - pagos.monto editado a mano que no coincide con tarifa × clases
--             - alumno cambió de modelo en el medio (cuenta corriente que tuvo
--               pagos viejos con periodo, etc.)
--             - movimientos_cuenta con datos inconsistentes
--
-- Workflow sugerido:
--   1. SELECT * FROM resumen_validacion_finanzas();
--      → ver cuántos alumnos están OK/WARN/ERROR por maestra.
--   2. SELECT * FROM validar_migracion_finanzas() WHERE status = 'ERROR';
--      → investigar uno a uno los ERROR.
--   3. Decidir caso por caso: ajustar a mano, ajustar el backfill, o aceptar.
--   4. Cuando solo queden OK/WARN, proceder con migración 028.
-- ============================================================
