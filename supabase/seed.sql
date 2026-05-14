-- ============================================================
-- Seed data para desarrollo local
-- NOTA: Requiere un usuario en auth.users con el UUID especificado.
-- En desarrollo local con Supabase CLI, crear el usuario primero.
-- ============================================================

-- Maestra de prueba (el UUID debe coincidir con un user de auth.users)
-- insert into public.maestras (id, nombre, email, telefono)
-- values (
--   '00000000-0000-0000-0000-000000000001',
--   'María García',
--   'maria@ejemplo.com',
--   '+5491112345678'
-- );

-- Alumnos de prueba
-- insert into public.alumnos (maestra_id, nombre, apellido, grado) values
--   ('00000000-0000-0000-0000-000000000001', 'Lucía', 'Martínez', 3),
--   ('00000000-0000-0000-0000-000000000001', 'Tomás', 'López', 3),
--   ('00000000-0000-0000-0000-000000000001', 'Valentina', 'Rodríguez', 5);
