-- ============================================================
-- Migración 034: clases_pendientes_imputacion retorna cargo_id
--
-- Bug en migración 028:
--   La RPC clases_pendientes_imputacion tiene un campo de salida
--   llamado "clase_id" pero su valor era c.clase_id (el ID de la
--   clase asociada al cargo). El código consumidor lo trata como
--   si fuera el cargo_id — los datos terminan siendo el primero.
--
--   Resultado: al confirmar un cobro vía "Marcar Pagado" en
--   /finanzas/cobranzas, la inserción en imputaciones intenta
--   guardar { cargo_id: <clase_id real> }, que no existe en
--   cargos → FK violation → "Server Components render error".
--
--   El comentario en src/lib/asistente/executor/cobros.ts ya
--   anticipaba esto: "Las versiones nuevas del RPC devuelven
--   cargo_id directamente; en la vista compat usamos el mismo
--   campo. Asumimos que la RPC retorna el cargo_id en clase_id."
--
-- Fix: cambiar SELECT c.clase_id → SELECT c.id. El nombre del
-- campo de salida sigue siendo "clase_id" por compat (todo el
-- código consumidor depende de ese nombre), pero el VALOR ahora
-- es el cargo_id, que es lo que los consumidores realmente quieren.
-- ============================================================

CREATE OR REPLACE FUNCTION public.clases_pendientes_imputacion(
  p_alumno_id uuid
)
RETURNS TABLE(
  clase_id        uuid,
  fecha           timestamptz,
  tema            text,
  monto_total     numeric,
  monto_imputado  numeric,
  pendiente       numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH imputado AS (
    SELECT cargo_id, COALESCE(SUM(monto_imputado), 0) AS total
      FROM public.imputaciones
     GROUP BY cargo_id
  )
  SELECT
    c.id,                                  -- CAMBIO: era c.clase_id, ahora c.id (cargo_id)
    c.fecha::timestamptz,
    c.descripcion,
    c.monto,
    COALESCE(i.total, 0),
    GREATEST(c.monto - COALESCE(i.total, 0), 0)
  FROM public.cargos c
  LEFT JOIN imputado i ON i.cargo_id = c.id
  WHERE c.alumno_id = p_alumno_id
    AND c.maestra_id = auth.uid()
    AND c.concepto = 'clase'
    AND c.clase_id IS NOT NULL
    AND c.deleted_at IS NULL
    AND c.monto - COALESCE(i.total, 0) > 0
  ORDER BY c.fecha ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.clases_pendientes_imputacion(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.clases_pendientes_imputacion(uuid) TO authenticated;
