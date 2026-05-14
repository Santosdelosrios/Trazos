-- ============================================================
-- 011: MercadoPago subscription tracking
-- ============================================================

-- Agregar columna para guardar el ID de suscripción de MercadoPago
ALTER TABLE maestras
ADD COLUMN IF NOT EXISTS mp_subscription_id TEXT DEFAULT NULL;
