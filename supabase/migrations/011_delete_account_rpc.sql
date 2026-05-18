-- ============================================================
-- Migration: Add RPC to allow users to delete their own account
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with the privileges of the creator (postgres/supabase_admin)
AS $$
BEGIN
  -- Delete the user from auth.users. 
  -- We strictly use auth.uid() so a user can ONLY delete themselves.
  -- This will trigger the ON DELETE CASCADE to public.maestras and all related tables.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Revoke execute from public/anon just in case, explicitly grant to authenticated
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
