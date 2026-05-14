-- ============================================================
-- Migración 010: Soporte para materias personalizadas
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 009
-- ============================================================

-- 1. Cambiar clases.materia de enum a text para soportar valores custom
ALTER TABLE public.clases ALTER COLUMN materia TYPE text;

-- 2. Columna para ocultar materias base (JSON array de strings)
ALTER TABLE public.maestras 
  ADD COLUMN IF NOT EXISTS materias_ocultas text DEFAULT '[]';
