-- ============================================================
-- Migración 023: PR-7 — Histórico, proyección y alertas inteligentes
--
-- Tres RPCs read-only:
--   1. historico_finanzas(maestra_id, meses_atras)
--   2. proyeccion_mes(maestra_id, anio, mes)
--   3. alertas_finanzas(maestra_id)
--
-- No agrega columnas ni tablas. Todo se calcula sobre datos existentes
-- (pagos_activos, gastos_activos, agenda, alumnos, tarifas).
-- ============================================================

-- 1. historico_finanzas --------------------------------------------
--
-- Devuelve [{mes, ingresos, gastos, neto}] con una fila por mes en los
-- últimos N meses (incluyendo el actual). Los meses sin movimientos
-- aparecen con 0 para que el gráfico tenga una línea continua.
--
-- "mes" se devuelve como texto YYYY-MM para que el cliente formatee.

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
    -- Genera la serie de los últimos N meses como YYYY-MM (texto)
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
    FROM public.pagos
    WHERE maestra_id = p_maestra_id
      AND estado = 'pagado'
      AND deleted_at IS NULL
      AND fecha_pago IS NOT NULL
    GROUP BY 1
  ),
  gastos AS (
    SELECT
      to_char(date_trunc('month', fecha), 'YYYY-MM') AS mes,
      SUM(monto) AS total
    FROM public.gastos
    WHERE maestra_id = p_maestra_id
      AND deleted_at IS NULL
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

REVOKE EXECUTE ON FUNCTION public.historico_finanzas(uuid, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.historico_finanzas(uuid, int) TO authenticated;

-- 2. proyeccion_mes ------------------------------------------------
--
-- Para un mes dado (default: actual), calcula:
--   - ya_facturado:  SUM(pagos pagados) del mes
--   - por_cobrar:    SUM(pagos pendientes/parciales del mes) +
--                    SUM(clases agendadas del mes cuyo alumno tiene
--                    cobros_automaticos_clases=true, modelo por_clase
--                    y sin pago todavía generado).
--   - proyectado:    ya_facturado + por_cobrar + proyectado_agenda_pendiente
--   - clases_restantes: cantidad de clases agendadas del mes con
--                    fecha >= hoy que aún no se cerraron.
--
-- Decisiones:
--   - Solo el modelo por_clase aporta a "por cobrar" por agenda
--     (los otros modelos tienen su propio mecanismo).
--   - Si la maestra tiene el flag desactivado, igual proyectamos —
--     el sistema sabe lo que "debería" cobrar aunque no genere
--     el pago automáticamente.

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
  ingresos AS (
    -- Lo que ya entró este mes (estado pagado)
    SELECT COALESCE(SUM(monto), 0) AS total
      FROM public.pagos, params
     WHERE maestra_id = p_maestra_id
       AND deleted_at IS NULL
       AND estado = 'pagado'
       AND fecha_pago >= params.inicio
       AND fecha_pago <= params.fin
  ),
  pendientes_pagos AS (
    -- Pagos del mes en estado pendiente/parcial (no cobrados aún).
    -- Usamos created_at del pago como referencia del "mes" cuando el
    -- pago no tiene clase_id; sino la fecha de la clase.
    SELECT COALESCE(SUM(p.monto), 0) AS total
      FROM public.pagos p, params
      LEFT JOIN public.clases c ON c.id = p.clase_id
     WHERE p.maestra_id = p_maestra_id
       AND p.deleted_at IS NULL
       AND p.estado IN ('pendiente', 'parcial')
       AND COALESCE(c.fecha::date, p.created_at::date) >= params.inicio
       AND COALESCE(c.fecha::date, p.created_at::date) <= params.fin
  ),
  agenda_pendientes AS (
    -- Clases agendadas del mes que todavía NO tienen pago generado
    -- (la lógica de PR-2 puede haber omitido el pago si el flag está off).
    -- Solo aporta el modelo por_clase, usando tarifa_override o global.
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
    CROSS JOIN tarifa_global tg, params
    JOIN public.alumnos a ON a.id = ag.alumno_id
    LEFT JOIN public.pagos p ON p.clase_id = ag.clase_id AND p.deleted_at IS NULL
    WHERE ag.maestra_id = p_maestra_id
      AND ag.fecha >= params.inicio
      AND ag.fecha <= params.fin
      AND a.modelo_cobro = 'por_clase'
      AND p.id IS NULL  -- aún no tiene pago
  ),
  clases_restantes AS (
    SELECT COUNT(*) AS cant
      FROM public.agenda ag, params
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

REVOKE EXECUTE ON FUNCTION public.proyeccion_mes(uuid, int, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.proyeccion_mes(uuid, int, int) TO authenticated;

-- 3. alertas_finanzas ----------------------------------------------
--
-- Devuelve un array de "alertas" calculadas sobre el estado actual.
-- Cada alerta tiene tipo + severidad + payload (jsonb arbitrario).
--
-- Tipos cubiertos:
--   - alumno_deuda_15d:        alumno con saldo > 0 y última clase >= 15 días
--   - cobro_pendiente_30d:     pago con estado pendiente creado hace > 30 días
--   - tarifa_desactualizada:   tarifa activa con vigente_desde > 90 días
--   - caida_facturacion_20pct: mes actual vs anterior, drop > 20%
--
-- Severidades: 'info' | 'warning' | 'critical'.

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
  -- 3.a Alumnos con deuda > 15 días desde última clase
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
      AND a.modelo_cobro IN ('por_clase', 'abono_mensual', 'cuenta_corriente')
      AND a.saldo_actual > 0
      AND (uc.fecha IS NULL OR CURRENT_DATE - uc.fecha >= 15)
    ORDER BY a.saldo_actual DESC
    LIMIT 10;

  -- 3.b Cobros pendientes hace más de 30 días
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
    FROM public.pagos p
    LEFT JOIN public.alumnos a ON a.id = p.alumno_id
    WHERE p.maestra_id = p_maestra_id
      AND p.deleted_at IS NULL
      AND p.estado = 'pendiente'
      AND CURRENT_DATE - p.created_at::date > 30
    ORDER BY p.created_at ASC
    LIMIT 10;

  -- 3.c Tarifa desactualizada (> 90 días sin tocar)
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

  -- 3.d Caída de facturación > 20% mes actual vs anterior
  RETURN QUERY
    WITH actual AS (
      SELECT COALESCE(SUM(monto), 0) AS total
        FROM public.pagos
       WHERE maestra_id = p_maestra_id
         AND deleted_at IS NULL
         AND estado = 'pagado'
         AND fecha_pago >= date_trunc('month', CURRENT_DATE)
         AND fecha_pago <= CURRENT_DATE
    ),
    anterior AS (
      SELECT COALESCE(SUM(monto), 0) AS total
        FROM public.pagos
       WHERE maestra_id = p_maestra_id
         AND deleted_at IS NULL
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
      -- Solo después del día 10 del mes (antes la comparación no es justa)
      AND EXTRACT(day FROM CURRENT_DATE)::int >= 10;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.alertas_finanzas(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.alertas_finanzas(uuid) TO authenticated;
