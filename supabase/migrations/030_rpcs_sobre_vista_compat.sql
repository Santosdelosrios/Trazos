-- ============================================================
-- Migración 030: RPCs analíticos sobre la vista compat pagos_activos
--
-- Post 028+029, public.pagos quedó obsoleta como fuente de verdad
-- pero las RPCs analíticas (resumen, historico, proyeccion, alertas,
-- reporte) seguían leyendo de ella directamente y por eso devolvían
-- valores stale.
--
-- Esta migración las recrea cambiando solo el FROM:
--   public.pagos  →  public.pagos_activos
--
-- Sin cambios semánticos: pagos_activos preserva la SHAPE vieja
-- (id, monto, estado, fecha_pago, periodo, clase_id, etc.) derivada
-- de cargos+cobros+imputaciones.
--
-- También quita el modelo 'cuenta_corriente' de los filtros porque
-- ya no existe (alumnos migraron a por_clase en 028).
-- ============================================================

-- 1. resumen_financiero_mes ----------------------------------------

CREATE OR REPLACE FUNCTION public.resumen_financiero_mes(p_maestra_id uuid)
RETURNS TABLE(
  ingresos_mes      numeric,
  gastos_mes        numeric,
  ganancia_neta     numeric,
  pagos_pendientes  bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH ingresos AS (
    SELECT COALESCE(SUM(monto), 0) AS total
    FROM public.pagos_activos
    WHERE maestra_id = p_maestra_id
      AND estado = 'pagado'
      AND fecha_pago >= date_trunc('month', CURRENT_DATE)
  ),
  gastos AS (
    SELECT COALESCE(SUM(monto), 0) AS total
    FROM public.gastos_activos
    WHERE maestra_id = p_maestra_id
      AND fecha >= date_trunc('month', CURRENT_DATE)
  ),
  pendientes AS (
    SELECT COUNT(*) AS total
    FROM public.pagos_activos
    WHERE maestra_id = p_maestra_id
      AND estado = 'pendiente'
  )
  SELECT
    ingresos.total,
    gastos.total,
    ingresos.total - gastos.total,
    pendientes.total
  FROM ingresos, gastos, pendientes;
$$;

-- 2. obtener_metricas_negocio --------------------------------------

CREATE OR REPLACE FUNCTION public.obtener_metricas_negocio(p_maestra_id uuid)
RETURNS TABLE (
  horas_mes        bigint,
  alumno_estrella  text,
  materia_top      text
) AS $$
DECLARE
  v_horas   bigint;
  v_alumno  text;
  v_materia text;
BEGIN
  SELECT COUNT(*) INTO v_horas
  FROM public.clases
  WHERE maestra_id = p_maestra_id
    AND fecha >= date_trunc('month', CURRENT_DATE);

  SELECT (a.nombre || ' ' || a.apellido) INTO v_alumno
  FROM public.pagos_activos p
  JOIN public.alumnos a ON p.alumno_id = a.id
  WHERE p.maestra_id = p_maestra_id
    AND p.estado = 'pagado'
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

-- 3. historico_finanzas --------------------------------------------

CREATE OR REPLACE FUNCTION public.historico_finanzas(
  p_maestra_id  uuid,
  p_meses_atras int DEFAULT 12
)
RETURNS TABLE(
  mes       text,
  ingresos  numeric,
  gastos    numeric,
  neto      numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH RECURSIVE serie AS (
    SELECT
      to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM') AS mes,
      date_trunc('month', CURRENT_DATE) AS d,
      1 AS i
    UNION ALL
    SELECT
      to_char(d - interval '1 month', 'YYYY-MM'),
      d - interval '1 month',
      i + 1
    FROM serie
    WHERE i < GREATEST(p_meses_atras, 1)
  ),
  ingresos AS (
    SELECT
      to_char(date_trunc('month', fecha_pago), 'YYYY-MM') AS mes,
      SUM(monto) AS total
    FROM public.pagos_activos
    WHERE maestra_id = p_maestra_id
      AND estado = 'pagado'
      AND fecha_pago IS NOT NULL
    GROUP BY 1
  ),
  gastos AS (
    SELECT
      to_char(date_trunc('month', fecha), 'YYYY-MM') AS mes,
      SUM(monto) AS total
    FROM public.gastos_activos
    WHERE maestra_id = p_maestra_id
    GROUP BY 1
  )
  SELECT
    s.mes,
    COALESCE(i.total, 0) AS ingresos,
    COALESCE(g.total, 0) AS gastos,
    COALESCE(i.total, 0) - COALESCE(g.total, 0) AS neto
  FROM serie s
  LEFT JOIN ingresos i ON i.mes = s.mes
  LEFT JOIN gastos   g ON g.mes = s.mes
  ORDER BY s.mes ASC;
$$;

-- 4. proyeccion_mes -------------------------------------------------

CREATE OR REPLACE FUNCTION public.proyeccion_mes(
  p_maestra_id uuid,
  p_anio       int DEFAULT EXTRACT(year  FROM CURRENT_DATE)::int,
  p_mes        int DEFAULT EXTRACT(month FROM CURRENT_DATE)::int
)
RETURNS TABLE(
  ya_facturado     numeric,
  por_cobrar       numeric,
  proyectado       numeric,
  clases_restantes bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH params AS (
    SELECT
      make_date(p_anio, p_mes, 1)::date AS inicio,
      (make_date(p_anio, p_mes, 1) + interval '1 month' - interval '1 day')::date AS fin
  ),
  tarifa_global AS (
    SELECT COALESCE(
      (SELECT valor_hora FROM public.tarifas
        WHERE maestra_id = p_maestra_id AND activa = true
        ORDER BY vigente_desde DESC LIMIT 1),
      0
    ) AS valor
  ),
  -- Nota: CROSS JOIN explícito en vez de coma. La coma en FROM tiene
  -- menor precedencia que JOIN, así que `FROM a, b LEFT JOIN c ON c.id = a.id`
  -- se parsea como `FROM a, (b LEFT JOIN c ON c.id = a.id)` y `a` queda
  -- fuera del scope del JOIN. El fix de a49170e arregló esto en 023;
  -- replicamos el patrón acá para no reintroducir el bug.
  ingresos AS (
    SELECT COALESCE(SUM(monto), 0) AS total
      FROM public.pagos_activos
      CROSS JOIN params
     WHERE maestra_id = p_maestra_id
       AND estado = 'pagado'
       AND fecha_pago >= params.inicio
       AND fecha_pago <= params.fin
  ),
  pendientes_pagos AS (
    SELECT COALESCE(SUM(p.monto), 0) AS total
      FROM public.pagos_activos p
      CROSS JOIN params
      LEFT JOIN public.clases c ON c.id = p.clase_id
     WHERE p.maestra_id = p_maestra_id
       AND p.estado IN ('pendiente', 'parcial')
       AND COALESCE(c.fecha::date, p.created_at::date) >= params.inicio
       AND COALESCE(c.fecha::date, p.created_at::date) <= params.fin
  ),
  agenda_pendientes AS (
    SELECT
      COALESCE(SUM(
        COALESCE(
          ag.tarifa_esperada,
          a.tarifa_override,
          tg.valor,
          0
        )
      ), 0) AS total,
      COUNT(*) AS cant
    FROM public.agenda ag
    CROSS JOIN tarifa_global tg
    CROSS JOIN params
    JOIN public.alumnos a ON a.id = ag.alumno_id
    LEFT JOIN public.pagos_activos p ON p.clase_id = ag.clase_id
    WHERE ag.maestra_id = p_maestra_id
      AND ag.fecha >= params.inicio
      AND ag.fecha <= params.fin
      AND a.modelo_cobro = 'por_clase'
      AND p.id IS NULL
  ),
  clases_restantes AS (
    SELECT COUNT(*) AS cant
      FROM public.agenda ag
      CROSS JOIN params
     WHERE ag.maestra_id = p_maestra_id
       AND ag.estado = 'pendiente'
       AND ag.fecha >= GREATEST(CURRENT_DATE, params.inicio)
       AND ag.fecha <= params.fin
  )
  SELECT
    ingresos.total                                                    AS ya_facturado,
    pendientes_pagos.total + agenda_pendientes.total                  AS por_cobrar,
    ingresos.total + pendientes_pagos.total + agenda_pendientes.total AS proyectado,
    clases_restantes.cant                                             AS clases_restantes
  FROM ingresos, pendientes_pagos, agenda_pendientes, clases_restantes;
$$;

-- 5. alertas_finanzas ----------------------------------------------

CREATE OR REPLACE FUNCTION public.alertas_finanzas(p_maestra_id uuid)
RETURNS TABLE(
  tipo      text,
  severidad text,
  payload   jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  -- Alumnos con deuda > 15 días desde última clase
  RETURN QUERY
    WITH ultima_clase AS (
      SELECT ca.alumno_id, MAX(c.fecha::date) AS fecha
        FROM public.clase_alumnos ca
        JOIN public.clases c ON c.id = ca.clase_id
       WHERE c.maestra_id = p_maestra_id
       GROUP BY ca.alumno_id
    )
    SELECT
      'alumno_deuda_15d'::text,
      'warning'::text,
      jsonb_build_object(
        'alumno_id', a.id,
        'nombre',    a.nombre || ' ' || a.apellido,
        'saldo',     a.saldo_actual,
        'dias_desde_ultima_clase',
          GREATEST(0, (CURRENT_DATE - uc.fecha)::int)
      )
    FROM public.alumnos a
    LEFT JOIN ultima_clase uc ON uc.alumno_id = a.id
    WHERE a.maestra_id = p_maestra_id
      AND a.modelo_cobro IN ('por_clase', 'abono_mensual')
      AND a.saldo_actual > 0
      AND (uc.fecha IS NULL OR CURRENT_DATE - uc.fecha >= 15)
    ORDER BY a.saldo_actual DESC
    LIMIT 10;

  -- Cobros pendientes hace más de 30 días
  RETURN QUERY
    SELECT
      'cobro_pendiente_30d'::text,
      'critical'::text,
      jsonb_build_object(
        'pago_id',  p.id,
        'alumno',   COALESCE(a.nombre || ' ' || a.apellido, '—'),
        'monto',    p.monto,
        'dias',     (CURRENT_DATE - p.created_at::date)::int
      )
    FROM public.pagos_activos p
    LEFT JOIN public.alumnos a ON a.id = p.alumno_id
    WHERE p.maestra_id = p_maestra_id
      AND p.estado = 'pendiente'
      AND CURRENT_DATE - p.created_at::date > 30
    ORDER BY p.created_at ASC
    LIMIT 10;

  -- Tarifa desactualizada (> 90 días sin tocar)
  SELECT COUNT(*) INTO v_count FROM public.tarifas
    WHERE maestra_id = p_maestra_id AND activa = true;
  IF v_count > 0 THEN
    RETURN QUERY
      SELECT
        'tarifa_desactualizada'::text,
        'info'::text,
        jsonb_build_object(
          'meses', ROUND((CURRENT_DATE - t.vigente_desde)::int / 30.0, 1),
          'valor_hora', t.valor_hora
        )
      FROM public.tarifas t
      WHERE t.maestra_id = p_maestra_id
        AND t.activa = true
        AND CURRENT_DATE - t.vigente_desde > 90
      ORDER BY t.vigente_desde ASC
      LIMIT 1;
  END IF;

  -- Caída de facturación > 20% mes actual vs anterior
  RETURN QUERY
    WITH actual AS (
      SELECT COALESCE(SUM(monto), 0) AS total
        FROM public.pagos_activos
       WHERE maestra_id = p_maestra_id
         AND estado = 'pagado'
         AND fecha_pago >= date_trunc('month', CURRENT_DATE)
         AND fecha_pago <= CURRENT_DATE
    ),
    anterior AS (
      SELECT COALESCE(SUM(monto), 0) AS total
        FROM public.pagos_activos
       WHERE maestra_id = p_maestra_id
         AND estado = 'pagado'
         AND fecha_pago >= date_trunc('month', CURRENT_DATE - interval '1 month')
         AND fecha_pago <  date_trunc('month', CURRENT_DATE)
    )
    SELECT
      'caida_facturacion_20pct'::text,
      CASE
        WHEN anterior.total = 0 THEN 'info'
        WHEN (actual.total / anterior.total) < 0.5 THEN 'critical'
        ELSE 'warning'
      END::text,
      jsonb_build_object(
        'actual',   actual.total,
        'anterior', anterior.total,
        'caida_pct', CASE
          WHEN anterior.total > 0
            THEN ROUND((1 - actual.total / anterior.total) * 100)::int
          ELSE 0
        END
      )
    FROM actual, anterior
    WHERE anterior.total > 0
      AND actual.total < anterior.total * 0.8
      AND EXTRACT(day FROM CURRENT_DATE)::int >= 10;
END;
$$;

-- 6. reporte_mes ----------------------------------------------------

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
  SELECT COALESCE(SUM(monto), 0), COUNT(*)
    INTO v_ingresos, v_cant_pagos
    FROM public.pagos_activos
   WHERE maestra_id = p_maestra_id
     AND estado = 'pagado'
     AND fecha_pago >= v_inicio
     AND fecha_pago <= v_fin;

  SELECT COALESCE(SUM(monto), 0), COUNT(*)
    INTO v_gastos, v_cant_gastos
    FROM public.gastos_activos
   WHERE maestra_id = p_maestra_id
     AND fecha >= v_inicio
     AND fecha <= v_fin;

  SELECT COALESCE(SUM(monto), 0) INTO v_ingresos_prev
    FROM public.pagos_activos
   WHERE maestra_id = p_maestra_id
     AND estado = 'pagado'
     AND fecha_pago >= v_inicio_prev
     AND fecha_pago <= v_fin_prev;

  SELECT COALESCE(SUM(monto), 0) INTO v_gastos_prev
    FROM public.gastos_activos
   WHERE maestra_id = p_maestra_id
     AND fecha >= v_inicio_prev
     AND fecha <= v_fin_prev;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_top_alumnos
  FROM (
    SELECT
      (a.nombre || ' ' || a.apellido) AS nombre,
      SUM(p.monto) AS total,
      COUNT(DISTINCT p.clase_id) FILTER (WHERE p.clase_id IS NOT NULL) AS cant_clases
    FROM public.pagos_activos p
    JOIN public.alumnos a ON a.id = p.alumno_id
    WHERE p.maestra_id = p_maestra_id
      AND p.estado = 'pagado'
      AND p.fecha_pago >= v_inicio
      AND p.fecha_pago <= v_fin
    GROUP BY a.id, a.nombre, a.apellido
    ORDER BY SUM(p.monto) DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_top_familias
  FROM (
    SELECT
      f.nombre AS nombre,
      SUM(p.monto) AS total
    FROM public.pagos_activos p
    JOIN public.alumnos a  ON a.id = p.alumno_id
    JOIN public.familias f ON f.id = a.familia_id
    WHERE p.maestra_id = p_maestra_id
      AND p.estado = 'pagado'
      AND p.fecha_pago >= v_inicio
      AND p.fecha_pago <= v_fin
      AND f.deleted_at IS NULL
    GROUP BY f.id, f.nombre
    ORDER BY SUM(p.monto) DESC
    LIMIT 3
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_gastos_cat
  FROM (
    SELECT
      COALESCE(c.nombre, '(sin categoría)') AS nombre,
      SUM(g.monto) AS total,
      COUNT(*) AS cant
    FROM public.gastos_activos g
    LEFT JOIN public.categorias_gasto_custom c ON c.id = g.categoria_id
    WHERE g.maestra_id = p_maestra_id
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
