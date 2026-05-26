-- ============================================================
-- Migración 018: Feature flag de cobros automáticos + tope de abono
--
-- Decisiones:
--  - Para las maestras EXISTENTES (beta) el flag queda en false: no
--    queremos cambiarles el comportamiento sin avisarles (banner en UI
--    las invita a activarlo).
--  - Para las maestras NUEVAS el default es true: que arranquen con la
--    funcionalidad activa.
--  - Truco para diferenciar sin trigger ni código adicional: la columna
--    se crea con default true, y luego un UPDATE backfill pone a false
--    a las filas preexistentes. Idempotente (se filtra por la columna
--    misma, que recién existe).
--
--  - abonos.tope_clases_mes: NULL = sin tope (mismo comportamiento que hoy).
--    Si tiene tope y se supera en el mes, la lógica de cierre de clase
--    genera un cobro suelto pendiente (clase excedente).
--
--  - pagos.origen: trazabilidad de "de dónde salió este cobro". Default
--    'manual' para preservar la semántica de los pagos existentes (los
--    creados por la maestra desde el form de cobranzas).
-- ============================================================

-- 1. Feature flag por maestra ---------------------------------------

ALTER TABLE public.maestras
  ADD COLUMN IF NOT EXISTS cobros_automaticos_clases boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.maestras.cobros_automaticos_clases IS
  'Si true, cerrar una clase genera el cobro pendiente automáticamente según el modelo de cobro del alumno. Default true para nuevas; las maestras beta arrancan en false y lo activan desde Perfil.';

-- Backfill: las maestras que ya existían quedan en false para no
-- cambiarles el comportamiento. Esto corre exactamente una vez porque
-- esta migración es idempotente (column already exists → noop) y las
-- maestras nuevas se crean después con default true.
UPDATE public.maestras
   SET cobros_automaticos_clases = false
 WHERE created_at < now() - interval '1 second';

-- 2. Tope mensual en abonos ----------------------------------------

ALTER TABLE public.abonos
  ADD COLUMN IF NOT EXISTS tope_clases_mes smallint;

COMMENT ON COLUMN public.abonos.tope_clases_mes IS
  'Cantidad máxima de clases incluidas en el abono mensual. NULL = sin tope (clases ilimitadas). Si se supera, las clases excedentes generan cobro suelto.';

-- 3. Trazabilidad del origen del pago ------------------------------

DO $$ BEGIN
  CREATE TYPE pago_origen_enum AS ENUM (
    'manual',            -- creado por la maestra desde el form
    'auto_clase',        -- generado por cerrar una clase con flag activo
    'abono_excedente'    -- clase fuera del tope del abono mensual
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS origen pago_origen_enum NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN public.pagos.origen IS
  'De dónde salió este cobro. Útil para UI (badge "Auto"/"Excedente") y para reportes.';

CREATE INDEX IF NOT EXISTS idx_pagos_origen
  ON public.pagos(maestra_id, origen) WHERE origen <> 'manual';

-- 4. Vista de cobros activos (anticipa PR-3 soft delete) -----------
-- PR-3 va a agregar pagos.deleted_at. Creo la vista vacía-de-filtro
-- acá para que los consumidores empiecen a usar pagos_activos y no
-- haya que refactorizar otra vez. Por ahora WHERE TRUE = todos.

CREATE OR REPLACE VIEW public.pagos_activos AS
  SELECT * FROM public.pagos;
