-- ============================================================
-- Migración 020: Bucket de Storage para comprobantes de pago
--
-- Path pattern: <maestra_id>/<pago_id>/<filename>
-- Tipos MIME permitidos: image/*, application/pdf
-- Tamaño máx: 5 MB (validado en cliente; el bucket no fuerza)
--
-- RLS: cada maestra solo puede leer/escribir objetos cuyo primer
-- segmento del path coincida con su auth.uid().
-- ============================================================

-- 1. Crear bucket (privado) -----------------------------------------
-- Idempotente: ON CONFLICT por id.
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes-pagos', 'comprobantes-pagos', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Policies ------------------------------------------------------
-- Borramos primero por idempotencia (recrea las policies si la
-- migración se aplica sobre un bucket pre-existente).

DROP POLICY IF EXISTS "comprobantes_maestra_select" ON storage.objects;
DROP POLICY IF EXISTS "comprobantes_maestra_insert" ON storage.objects;
DROP POLICY IF EXISTS "comprobantes_maestra_update" ON storage.objects;
DROP POLICY IF EXISTS "comprobantes_maestra_delete" ON storage.objects;

-- SELECT: la maestra ve sus propios comprobantes
CREATE POLICY "comprobantes_maestra_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'comprobantes-pagos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- INSERT: la maestra sube a su propio path
CREATE POLICY "comprobantes_maestra_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'comprobantes-pagos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- UPDATE: misma maestra
CREATE POLICY "comprobantes_maestra_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'comprobantes-pagos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- DELETE: misma maestra (para reemplazar comprobantes viejos)
CREATE POLICY "comprobantes_maestra_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'comprobantes-pagos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
