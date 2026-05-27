-- ============================================================
-- Migración 025: Seeder de inflación mensual INDEC
--
-- Datos: variación mensual del IPC nacional INDEC, expresada como
-- fracción decimal (0.0420 = 4.20%).
--
-- Fuente: https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31
--         (informes técnicos mensuales del IPC).
--
-- Cobertura inicial: 2023-01 a 2025-03 (lo que estaba publicado al
-- redactar la migración). Para sumar meses nuevos:
-- ver supabase/migrations/INFLACION.md.
--
-- Idempotente vía ON CONFLICT — esta migración puede correrse muchas
-- veces sin pisar valores ya insertados, lo que permite editar a
-- mano correcciones de INDEC sin perderlas.
-- ============================================================

INSERT INTO public.inflacion_mensual (mes, ipc_mensual, fuente) VALUES
  -- 2023
  ('2023-01-01', 0.0600, 'INDEC'),
  ('2023-02-01', 0.0660, 'INDEC'),
  ('2023-03-01', 0.0770, 'INDEC'),
  ('2023-04-01', 0.0840, 'INDEC'),
  ('2023-05-01', 0.0780, 'INDEC'),
  ('2023-06-01', 0.0600, 'INDEC'),
  ('2023-07-01', 0.0630, 'INDEC'),
  ('2023-08-01', 0.1240, 'INDEC'),
  ('2023-09-01', 0.1270, 'INDEC'),
  ('2023-10-01', 0.0830, 'INDEC'),
  ('2023-11-01', 0.1280, 'INDEC'),
  ('2023-12-01', 0.2550, 'INDEC'),
  -- 2024
  ('2024-01-01', 0.2060, 'INDEC'),
  ('2024-02-01', 0.1320, 'INDEC'),
  ('2024-03-01', 0.1100, 'INDEC'),
  ('2024-04-01', 0.0880, 'INDEC'),
  ('2024-05-01', 0.0420, 'INDEC'),
  ('2024-06-01', 0.0460, 'INDEC'),
  ('2024-07-01', 0.0400, 'INDEC'),
  ('2024-08-01', 0.0420, 'INDEC'),
  ('2024-09-01', 0.0350, 'INDEC'),
  ('2024-10-01', 0.0270, 'INDEC'),
  ('2024-11-01', 0.0240, 'INDEC'),
  ('2024-12-01', 0.0270, 'INDEC'),
  -- 2025
  ('2025-01-01', 0.0220, 'INDEC'),
  ('2025-02-01', 0.0240, 'INDEC'),
  ('2025-03-01', 0.0370, 'INDEC')
ON CONFLICT (mes) DO NOTHING;

-- ============================================================
-- NOTA DE PRODUCCIÓN
-- Los valores históricos arriba son redondeos al 0.01% del IPC
-- INDEC publicado. Si algún mes recibe corrección oficial, hay que
-- actualizarlo manualmente con UPDATE — el ON CONFLICT DO NOTHING
-- no pisa nada.
--
-- Si querés forzar la actualización de un mes ya insertado:
--   UPDATE public.inflacion_mensual SET ipc_mensual = 0.0X
--    WHERE mes = 'YYYY-MM-01';
-- ============================================================
