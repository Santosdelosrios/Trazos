-- ============================================================
-- Migración 036: bitácora pedagógica
--
-- Convierte la clase en algo más que "tema + ejercicio + nota".
-- Ahora cada clase tiene:
--
--   AL PLANIFICAR (vive en agenda)
--     - objetivos       text[]      lista de items a lograr
--     - recordatorios   jsonb       [{id, texto, completado, created_at}]
--
--   DURANTE LA CLASE (vive en clases)
--     - notas_vivo      text        anotaciones que la maestra
--                                   toma mientras la clase corre
--                                   (autosave desde el widget En Vivo)
--
--   AL CERRAR (vive en clases)
--     - objetivos       text[]      snapshot de los objetivos
--                                   originales (en agenda) para que
--                                   queden en el histórico aunque se
--                                   borre la agenda
--     - recordatorios   jsonb       snapshot de recordatorios
--     - resumen_realizado text      "¿qué hicieron en esta clase?"
--     - plan_proxima    text        "¿qué van a trabajar la próxima?"
--                                   → se usa como prefill de objetivos
--                                     cuando se agenda la siguiente
--                                     clase del mismo alumno
--
-- Todos son opcionales (NULL/empty default). Una clase puede seguir
-- existiendo sin nada de esto si la maestra no usa la feature.
-- ============================================================

-- AGENDA: planificación pedagógica + notas en vivo
-- (las notas viven acá porque durante la clase EN VIVO la fila de
--  `clases` aún no existe. Al cerrar la clase, se copian a `clases.notas_vivo`.)
ALTER TABLE public.agenda
  ADD COLUMN IF NOT EXISTS objetivos     text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS recordatorios jsonb  DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notas_vivo    text;

COMMENT ON COLUMN public.agenda.objetivos IS
  'Lista de objetivos pedagógicos planificados para esta clase.';
COMMENT ON COLUMN public.agenda.recordatorios IS
  'Recordatorios para la clase: [{id, texto, completado, created_at}]. Se marcan como completados desde el widget En Vivo.';
COMMENT ON COLUMN public.agenda.notas_vivo IS
  'Notas que la maestra toma DURANTE la clase desde el widget En Vivo (autosave). Al cerrar la clase se copian a clases.notas_vivo y se pueden borrar de acá.';

-- CLASES: snapshot pedagógico + cierre + notas en vivo
ALTER TABLE public.clases
  ADD COLUMN IF NOT EXISTS objetivos         text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS recordatorios     jsonb  DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notas_vivo        text,
  ADD COLUMN IF NOT EXISTS resumen_realizado text,
  ADD COLUMN IF NOT EXISTS plan_proxima      text;

COMMENT ON COLUMN public.clases.objetivos IS
  'Snapshot de objetivos al cerrar la clase (copiado de agenda).';
COMMENT ON COLUMN public.clases.recordatorios IS
  'Snapshot de recordatorios al cerrar la clase (copiado de agenda).';
COMMENT ON COLUMN public.clases.notas_vivo IS
  'Notas tomadas por la maestra durante la clase, vía autosave del widget En Vivo.';
COMMENT ON COLUMN public.clases.resumen_realizado IS
  '¿Qué hicieron en esta clase? Texto libre llenado al cerrar.';
COMMENT ON COLUMN public.clases.plan_proxima IS
  '¿Qué van a trabajar la próxima? Texto libre llenado al cerrar. Se usa como prefill de objetivos en la próxima clase del mismo alumno.';

-- Índice para encontrar "última clase del alumno con plan_proxima"
-- rápidamente (usado para sugerir objetivos al planificar).
CREATE INDEX IF NOT EXISTS idx_clases_plan_proxima_no_null
  ON public.clases (maestra_id, fecha DESC)
  WHERE plan_proxima IS NOT NULL AND plan_proxima <> '';
