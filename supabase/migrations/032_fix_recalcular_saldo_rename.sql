-- ============================================================
-- Migración 032: fix recalcular_saldo apuntando a función vieja
--
-- Bug en migración 028:
--   1. Se creó recalcular_saldo() con cuerpo que llama saldo_alumno_v2(...).
--   2. Después se hizo: ALTER FUNCTION saldo_alumno_v2 RENAME TO saldo_alumno.
--   3. Pero PostgreSQL resuelve nombres de funciones en runtime, no al
--      crear la función contenedora. Entonces recalcular_saldo() quedó
--      apuntando a saldo_alumno_v2 que ya no existe.
--
-- Síntoma: cualquier INSERT/UPDATE/DELETE sobre cargos o cobros dispara
-- el trigger trg_recalcular_saldo_v2 → recalcular_saldo() → "function
-- saldo_alumno_v2 does not exist". Esto rompe registrar cobro, borrar
-- alumno (cascade), borrar cobro, etc.
--
-- Fix: recrear recalcular_saldo() apuntando al nombre nuevo.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalcular_saldo(p_alumno_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deuda    numeric;
  v_creditos int;
BEGIN
  SELECT s.deuda, s.creditos_restantes
    INTO v_deuda, v_creditos
    FROM public.saldo_alumno(p_alumno_id) s;

  UPDATE public.alumnos
     SET saldo_actual    = COALESCE(v_deuda, 0),
         creditos_actual = COALESCE(v_creditos, 0)
   WHERE id = p_alumno_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalcular_saldo(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.recalcular_saldo(uuid) TO authenticated;
