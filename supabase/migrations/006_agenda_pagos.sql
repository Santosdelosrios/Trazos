-- ============================================================
-- Migración 006: Mejoras en Agenda y Pagos
-- Agrega tarifa esperada y enlace a clase generada en la agenda
-- ============================================================

-- 1. Agregar columnas a agenda
ALTER TABLE public.agenda
ADD COLUMN IF NOT EXISTS tarifa_esperada numeric(10,2),
ADD COLUMN IF NOT EXISTS clase_id uuid REFERENCES public.clases(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.agenda.tarifa_esperada IS 'Monto que se espera cobrar por esta clase agendada.';
COMMENT ON COLUMN public.agenda.clase_id IS 'Vinculación a la clase real generada una vez completada la agenda.';

-- 2. Actualizar tipos existentes si es necesario
-- (Sin cambios a enums por ahora)
