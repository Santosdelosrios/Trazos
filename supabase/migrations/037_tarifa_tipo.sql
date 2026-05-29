-- ============================================================
-- Migración 037: tipo de tarifa (por hora vs por clase)
--
-- Hasta ahora la tarifa siempre se interpretaba como "valor por hora"
-- y el monto de cada clase se calculaba como tarifa × duración. Eso
-- no aplica para maestras que cobran un monto fijo por clase
-- independientemente de la duración.
--
-- Agregamos una columna tipo a tarifas con dos valores:
--   - por_hora  (default): monto = valor_hora × duracion
--   - por_clase            : monto = valor_hora (la duración no afecta)
--
-- El nombre de la columna sigue siendo valor_hora por compat con
-- todo el código existente; conceptualmente para 'por_clase' es el
-- "valor base por clase".
--
-- Histórico preservado: las tarifas previas quedan como 'por_hora'
-- (su comportamiento de siempre).
-- ============================================================

DO $$ BEGIN
  CREATE TYPE tarifa_tipo_enum AS ENUM ('por_hora', 'por_clase');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.tarifas
  ADD COLUMN IF NOT EXISTS tipo tarifa_tipo_enum NOT NULL DEFAULT 'por_hora';

COMMENT ON COLUMN public.tarifas.tipo IS
  'por_hora: monto = valor_hora × duracion. por_clase: monto = valor_hora (fijo, ignora duración).';
