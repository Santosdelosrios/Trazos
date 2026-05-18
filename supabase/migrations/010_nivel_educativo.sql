-- ============================================================
-- Migration: Change grado from integer to text
-- Supports all education levels (primary, secondary, university, etc.)
-- ============================================================

-- 1. Drop CHECK constraints FIRST (they reference the integer type)
-- Postgres auto-names inline CHECK constraints as <table>_<column>_check
ALTER TABLE alumnos DROP CONSTRAINT IF EXISTS alumnos_grado_check;
ALTER TABLE clases DROP CONSTRAINT IF EXISTS clases_grado_target_check;

-- 2. Alumnos table: Change grado from smallint to text
ALTER TABLE alumnos ALTER COLUMN grado TYPE text USING (
  CASE grado
    WHEN 1 THEN '1° grado'
    WHEN 2 THEN '2° grado'
    WHEN 3 THEN '3° grado'
    WHEN 4 THEN '4° grado'
    WHEN 5 THEN '5° grado'
    WHEN 6 THEN '6° grado'
    WHEN 7 THEN '7° grado'
    ELSE grado::text
  END
);

-- 3. Clases table: Change grado_target from smallint to text
ALTER TABLE clases ALTER COLUMN grado_target TYPE text USING (
  CASE grado_target
    WHEN 1 THEN '1° grado'
    WHEN 2 THEN '2° grado'
    WHEN 3 THEN '3° grado'
    WHEN 4 THEN '4° grado'
    WHEN 5 THEN '5° grado'
    WHEN 6 THEN '6° grado'
    WHEN 7 THEN '7° grado'
    ELSE grado_target::text
  END
);

-- 4. Update comments to reflect new usage
COMMENT ON COLUMN public.alumnos.grado IS 'Nivel educativo del alumno (texto libre, ej: "3° grado", "2° año secundaria", "Universitario")';
COMMENT ON TABLE public.alumnos IS 'Alumnos registrados por cada docente.';
