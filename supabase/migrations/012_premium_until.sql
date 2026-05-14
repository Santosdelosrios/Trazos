-- ============================================================
-- 012: Premium Until tracking
-- ============================================================

-- Agregar columna para saber hasta cuándo es premium el usuario
-- (Así si cancelan, conservan el premium hasta que termine el mes pago)
ALTER TABLE maestras
ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ DEFAULT NULL;
