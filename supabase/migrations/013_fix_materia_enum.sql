-- Migración 013: Agregar 'general' al enum de materias y convertir columnas a texto para flexibilidad total
-- Ejecutar este archivo en el SQL Editor de Supabase

-- 1. Agregar 'general' al tipo enum existente
-- Nota: En Postgres no se puede eliminar un valor de un enum fácilmente, pero sí agregar.
ALTER TYPE materia_enum ADD VALUE IF NOT EXISTS 'general';

-- 2. Asegurar que la tabla 'temas' también soporte texto (como ya hicimos con 'clases')
-- Esto permite que si en el futuro queremos usar cualquier string, no falle.
ALTER TABLE public.temas ALTER COLUMN materia TYPE text;

-- 3. Asegurar que 'agenda' soporte texto (ya debería serlo, pero por seguridad)
ALTER TABLE public.agenda ALTER COLUMN materia TYPE text;

-- 4. Opcional: Convertir todas las materias existentes a 'general' si se desea limpiar el pasado
-- UPDATE public.clases SET materia = 'general';
-- UPDATE public.temas SET materia = 'general';
-- UPDATE public.agenda SET materia = 'general';
