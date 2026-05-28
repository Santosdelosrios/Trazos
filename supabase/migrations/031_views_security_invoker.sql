-- ============================================================
-- Migración 031: security_invoker en todas las vistas
--
-- Supabase Security Advisor advierte que las vistas sin
-- security_invoker se ejecutan con los permisos del creador
-- (SECURITY DEFINER implícito), bypasseando RLS del usuario.
--
-- Con security_invoker = on, la vista hereda las políticas RLS
-- del usuario que la consulta — comportamiento correcto para
-- aplicaciones multi-tenant como esta.
--
-- Fix: ALTER VIEW ... SET (security_invoker = on)
-- Requiere PostgreSQL 15+ (disponible en Supabase desde 2023).
-- ============================================================

ALTER VIEW public.familias_activas          SET (security_invoker = on);
ALTER VIEW public.pagos_activos             SET (security_invoker = on);
ALTER VIEW public.gastos_activos            SET (security_invoker = on);
ALTER VIEW public.categorias_gasto_activas  SET (security_invoker = on);
ALTER VIEW public.cargos_activos            SET (security_invoker = on);
ALTER VIEW public.cobros_activos            SET (security_invoker = on);
ALTER VIEW public.cobros_libres_activos     SET (security_invoker = on);
