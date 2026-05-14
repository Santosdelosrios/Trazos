-- ============================================================
-- Migración 009: Trazos Premium
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- 1. Columna de plan en maestras
ALTER TABLE public.maestras 
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- 2. Token único para sincronización de calendario (.ics)
ALTER TABLE public.maestras 
  ADD COLUMN IF NOT EXISTS calendar_token uuid DEFAULT uuid_generate_v4();

-- 3. Tabla de materias personalizadas
CREATE TABLE IF NOT EXISTS public.materias_custom (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  maestra_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  icono       text DEFAULT 'book',
  created_at  timestamptz DEFAULT now(),
  UNIQUE(maestra_id, nombre)
);

ALTER TABLE public.materias_custom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materias_custom_own" ON public.materias_custom
  FOR ALL USING (maestra_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_materias_custom_maestra 
  ON public.materias_custom(maestra_id);

-- 4. Verificación: ver que todo se creó bien
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'maestras' AND column_name IN ('plan', 'calendar_token');
