-- ============================================================
-- Migration: Batch RPC for student balances (Solves N+1 query performance bottleneck)
-- ============================================================

CREATE OR REPLACE FUNCTION public.calcular_saldos_maestra(p_maestra_id uuid)
RETURNS TABLE(
  alumno_id uuid,
  saldo_pendiente numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH tarifa_activa AS (
    SELECT COALESCE(
      (SELECT valor_hora FROM public.tarifas
       WHERE maestra_id = p_maestra_id AND activa = true
       ORDER BY vigente_desde DESC LIMIT 1),
      0
    ) AS valor
  ),
  clases_count AS (
    SELECT ca.alumno_id, COUNT(*) AS total
    FROM public.clase_alumnos ca
    JOIN public.clases c ON c.id = ca.clase_id
    WHERE c.maestra_id = p_maestra_id
    GROUP BY ca.alumno_id
  ),
  cobrado AS (
    SELECT p.alumno_id, COALESCE(SUM(p.monto), 0) AS total
    FROM public.pagos p
    WHERE p.maestra_id = p_maestra_id
      AND p.estado IN ('pagado', 'parcial')
    GROUP BY p.alumno_id
  )
  SELECT
    a.id AS alumno_id,
    (COALESCE(cc.total, 0) * ta.valor) - COALESCE(cb.total, 0) AS saldo_pendiente
  FROM public.alumnos a
  CROSS JOIN tarifa_activa ta
  LEFT JOIN clases_count cc ON cc.alumno_id = a.id
  LEFT JOIN cobrado cb ON cb.alumno_id = a.id
  WHERE a.maestra_id = p_maestra_id;
$$;

REVOKE EXECUTE ON FUNCTION public.calcular_saldos_maestra(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calcular_saldos_maestra(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.calcular_saldos_maestra(uuid) TO authenticated;
