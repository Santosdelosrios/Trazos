-- ============================================================
-- Migración 021: PR-4 — Datos de pago + template editable de WhatsApp
--
-- Dos columnas nuevas en maestras:
--   - datos_pago: texto libre con CBU/alias/link MP. Se inyecta en
--     {datos_pago} del template.
--   - template_recordatorio: plantilla custom. Si NULL, la app usa el
--     template default (que vive en TS para que sea editable sin SQL).
--
-- Backward-compat total: ambas nullable, sin default destructivo.
-- ============================================================

ALTER TABLE public.maestras
  ADD COLUMN IF NOT EXISTS datos_pago            text,
  ADD COLUMN IF NOT EXISTS template_recordatorio text;

COMMENT ON COLUMN public.maestras.datos_pago IS
  'Texto libre con datos de pago (CBU, alias, link MP). Se inyecta en la variable {datos_pago} del template de WhatsApp.';

COMMENT ON COLUMN public.maestras.template_recordatorio IS
  'Plantilla de recordatorio de pago. Acepta variables: {nombre_alumno}, {nombre_responsable}, {mes}, {detalle_clases}, {detalle_por_alumno}, {cantidad_clases}, {monto}, {datos_pago}. NULL = usar default de la app.';
