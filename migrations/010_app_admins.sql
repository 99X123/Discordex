-- ============================================================
-- 010_app_admins.sql
-- Administradores globais do Discordex.
-- Marque uma conta como admin inserindo o user_id em public.app_admins.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_app_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.app_admins admins
    WHERE admins.user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.list_registered_accounts()
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_admin BOOLEAN
) AS $$
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  RETURN QUERY
  SELECT
    profiles.id,
    profiles.username,
    profiles.display_name,
    profiles.avatar_url,
    profiles.bio,
    profiles.status,
    profiles.created_at,
    profiles.updated_at,
    public.is_app_admin(profiles.id) AS is_admin
  FROM public.profiles profiles
  ORDER BY profiles.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP POLICY IF EXISTS "app_admins_select_self_or_admin" ON public.app_admins;
CREATE POLICY "app_admins_select_self_or_admin" ON public.app_admins
  FOR SELECT USING (user_id = auth.uid() OR public.is_app_admin(auth.uid()));

DROP POLICY IF EXISTS "app_admins_no_client_writes" ON public.app_admins;
CREATE POLICY "app_admins_no_client_writes" ON public.app_admins
  FOR ALL USING (FALSE)
  WITH CHECK (FALSE);
