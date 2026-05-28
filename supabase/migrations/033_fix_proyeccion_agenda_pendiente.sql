-- ============================================================
-- Migración 033: proyeccion_mes filtra agenda pendiente y backfill
--                de agenda.clase_id histórico
--
-- Bug en proyeccion_mes (030):
--   La CTE agenda_pendientes sumaba a "por cobrar" TODA agenda del
--   mes para alumnos por_clase que no tuviera un cargo linkeado vía
--   ag.clase_id. Pero:
--
--   a) Agendas completadas hace tiempo a veces tienen ag.clase_id = NULL
--      (nunca se seteó el FK al cerrar). Esas agendas contaban como
--      pendientes aunque la clase ya estuviera cerrada y pagada.
--
--   b) No había filtro por ag.estado, así que también se contaban
--      las explícitamente marcadas 'completada' o 'cancelada'.
--
-- Fix:
--   1. Recreamos proyeccion_mes con WHERE ag.estado = 'pendiente'.
--   2. Backfill: para cada agenda completada del mes actual cuyo
--      clase_id es NULL, intentamos resolverlo buscando una clase
--      del mismo alumno/maestra y fecha cercana.
--
-- El código (commit junto a esta migración) también ya pasa el
-- clase_id en futuras llamadas a completarPlanificacion(), pero
-- las agendas viejas necesitan este backfill para que la proyección
-- del mes corriente quede limpia.
-- ============================================================

-- 1. Recrear proyeccion_mes con el filtro correcto -----------------

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
      AND ag.estado = 'pendiente'           -- NUEVO: solo pendientes
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

-- 2. Backfill agenda.clase_id para agendas completadas sin link ----
-- Resolvemos por (alumno_id, maestra_id, fecha) — match exacto.
-- Si hay ambigüedad (>1 clase del mismo alumno en el día) tomamos
-- la primera, asumiendo correlación 1:1 razonable.

UPDATE public.agenda ag
   SET clase_id = sub.clase_id
  FROM (
    SELECT DISTINCT ON (ca.alumno_id, c.maestra_id, c.fecha::date)
      ca.alumno_id,
      c.maestra_id,
      c.fecha::date AS fecha,
      c.id          AS clase_id
    FROM public.clases c
    JOIN public.clase_alumnos ca ON ca.clase_id = c.id
    ORDER BY ca.alumno_id, c.maestra_id, c.fecha::date, c.created_at
  ) sub
 WHERE ag.alumno_id   = sub.alumno_id
   AND ag.maestra_id  = sub.maestra_id
   AND ag.fecha       = sub.fecha
   AND ag.clase_id IS NULL
   AND ag.estado     <> 'pendiente';
