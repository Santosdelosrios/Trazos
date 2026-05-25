-- ============================================================
-- Migración 016: Plan de Clase (Próxima Clase Inteligente)
-- Tiza prepara la clase a partir del material que sube la maestra.
-- El plan generado se guarda 1:1 con la clase planeada en agenda.
-- ============================================================

ALTER TABLE public.agenda
  ADD COLUMN IF NOT EXISTS plan_clase jsonb DEFAULT NULL;

COMMENT ON COLUMN public.agenda.plan_clase IS
  'Plan de clase generado por Tiza. Forma: { objetivo, momentos:[{titulo,minutos,detalle}], tarea, generado_at }. NULL = sin preparar.';
