-- ============================================================
-- Migración 026: PR-9 — RPC para el reporte de cierre de mes
--
-- Devuelve un jsonb con todo el dataset agregado de un mes:
--   - resumen: { ingresos, gastos, neto, cant_pagos, cant_gastos }
--   - top_alumnos: [{nombre, total, cant_clases}] (top 5 facturado)
--   - top_familias: [{nombre, total}] (top 3 familias por facturado)
--   - gastos_por_categoria: [{nombre, total, cant}]
--   - comparativo: { ingresos_anterior, neto_anterior, var_ingresos_pct, var_neto_pct }
--
-- Un solo round-trip evita N+1 al armar el PDF.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reporte_mes(
  p_maestra_id uuid,
  p_anio       int,
  p_mes        int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inicio        date := make_date(p_anio, p_mes, 1);
  v_fin           date := (make_date(p_anio, p_mes, 1) + interval '1 month' - interval '1 day')::date;
  v_inicio_prev   date := (v_inicio - interval '1 month')::date;
  v_fin_prev      date := (v_inicio - interval '1 day')::date;

  v_ingresos      numeric;
  v_gastos        numeric;
  v_cant_pagos    int;
  v_cant_gastos   int;
  v_ingresos_prev numeric;
  v_gastos_prev   numeric;
  v_top_alumnos   jsonb;
  v_top_familias  jsonb;
  v_gastos_cat    jsonb;
BEGIN
  -- Resumen del mes
  SELECT COALESCE(SUM(monto), 0), COUNT(*)
    INTO v_ingresos, v_cant_pagos
    FROM public.pagos
   WHERE maestra_id = p_maestra_id
     AND deleted_at IS NULL
     AND estado = 'pagado'
     AND fecha_pago >= v_inicio
     AND fecha_pago <= v_fin;

  SELECT COALESCE(SUM(monto), 0), COUNT(*)
    INTO v_gastos, v_cant_gastos
    FROM public.gastos
   WHERE maestra_id = p_maestra_id
     AND deleted_at IS NULL
     AND fecha >= v_inicio
     AND fecha <= v_fin;

  -- Mes anterior (para comparativa)
  SELECT COALESCE(SUM(monto), 0) INTO v_ingresos_prev
    FROM public.pagos
   WHERE maestra_id = p_maestra_id
     AND deleted_at IS NULL
     AND estado = 'pagado'
     AND fecha_pago >= v_inicio_prev
     AND fecha_pago <= v_fin_prev;

  SELECT COALESCE(SUM(monto), 0) INTO v_gastos_prev
    FROM public.gastos
   WHERE maestra_id = p_maestra_id
     AND deleted_at IS NULL
     AND fecha >= v_inicio_prev
     AND fecha <= v_fin_prev;

  -- Top 5 alumnos por facturado
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_top_alumnos
  FROM (
    SELECT
      (a.nombre || ' ' || a.apellido) AS nombre,
      SUM(p.monto) AS total,
      COUNT(DISTINCT p.clase_id) FILTER (WHERE p.clase_id IS NOT NULL) AS cant_clases
    FROM public.pagos p
    JOIN public.alumnos a ON a.id = p.alumno_id
    WHERE p.maestra_id = p_maestra_id
      AND p.deleted_at IS NULL
      AND p.estado = 'pagado'
      AND p.fecha_pago >= v_inicio
      AND p.fecha_pago <= v_fin
    GROUP BY a.id, a.nombre, a.apellido
    ORDER BY SUM(p.monto) DESC
    LIMIT 5
  ) t;

  -- Top 3 familias
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_top_familias
  FROM (
    SELECT
      f.nombre AS nombre,
      SUM(p.monto) AS total
    FROM public.pagos p
    JOIN public.alumnos a ON a.id = p.alumno_id
    JOIN public.familias f ON f.id = a.familia_id
    WHERE p.maestra_id = p_maestra_id
      AND p.deleted_at IS NULL
      AND p.estado = 'pagado'
      AND p.fecha_pago >= v_inicio
      AND p.fecha_pago <= v_fin
      AND f.deleted_at IS NULL
    GROUP BY f.id, f.nombre
    ORDER BY SUM(p.monto) DESC
    LIMIT 3
  ) t;

  -- Gastos por categoría
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_gastos_cat
  FROM (
    SELECT
      COALESCE(c.nombre, '(sin categoría)') AS nombre,
      SUM(g.monto) AS total,
      COUNT(*) AS cant
    FROM public.gastos g
    LEFT JOIN public.categorias_gasto_custom c ON c.id = g.categoria_id
    WHERE g.maestra_id = p_maestra_id
      AND g.deleted_at IS NULL
      AND g.fecha >= v_inicio
      AND g.fecha <= v_fin
    GROUP BY c.id, c.nombre
    ORDER BY SUM(g.monto) DESC
  ) t;

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object(
      'anio',  p_anio,
      'mes',   p_mes,
      'desde', v_inicio,
      'hasta', v_fin
    ),
    'resumen', jsonb_build_object(
      'ingresos',     v_ingresos,
      'gastos',       v_gastos,
      'neto',         v_ingresos - v_gastos,
      'cant_pagos',   v_cant_pagos,
      'cant_gastos',  v_cant_gastos
    ),
    'comparativo', jsonb_build_object(
      'ingresos_anterior', v_ingresos_prev,
      'gastos_anterior',   v_gastos_prev,
      'neto_anterior',     v_ingresos_prev - v_gastos_prev,
      'var_ingresos_pct',
        CASE WHEN v_ingresos_prev > 0
             THEN ROUND(((v_ingresos - v_ingresos_prev) / v_ingresos_prev) * 100)::int
             ELSE NULL END,
      'var_neto_pct',
        CASE WHEN v_ingresos_prev - v_gastos_prev <> 0
             THEN ROUND((((v_ingresos - v_gastos) - (v_ingresos_prev - v_gastos_prev))
                         / NULLIF(ABS(v_ingresos_prev - v_gastos_prev), 0)) * 100)::int
             ELSE NULL END
    ),
    'top_alumnos',  v_top_alumnos,
    'top_familias', v_top_familias,
    'gastos_por_categoria', v_gastos_cat
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reporte_mes(uuid, int, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reporte_mes(uuid, int, int) TO authenticated;
