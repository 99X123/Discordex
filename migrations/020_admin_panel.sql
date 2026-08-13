-- ============================================================
-- 020_admin_panel.sql
-- Painel admin global do Discordex.
-- RPCs protegidas (apenas admins via is_app_admin):
--   - get_admin_stats()            : estatisticas globais do site
--   - promote_app_admin(id)        : torna um usuario admin global
--   - revoke_app_admin(id)         : remove admin global
--   - delete_app_account(id)       : banimento definitivo (remove auth + perfil)
-- ============================================================

-- ------------------------------------------------------------------
-- Estatisticas globais
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT jsonb_build_object(
    'total_users',       (SELECT COUNT(*) FROM public.profiles),
    'online_users',      (SELECT COUNT(*) FROM public.profiles WHERE status = 'online'),
    'total_servers',     (SELECT COUNT(*) FROM public.servers),
    'total_channels',    (SELECT COUNT(*) FROM public.channels),
    'total_messages',    (SELECT COUNT(*) FROM public.messages),
    'total_dm_messages', (SELECT COUNT(*) FROM public.direct_messages),
    'total_friendships', (SELECT COUNT(*) FROM public.friendships WHERE status = 'accepted'),
    'active_voice',      (SELECT COUNT(*) FROM public.voice_states),
    'total_calls',       (SELECT COUNT(*) FROM public.dm_call_rings)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------
-- Promover / remover admin global
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.promote_app_admin(p_target_id UUID)
RETURNS JSONB AS $$
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Usuario nao encontrado.');
  END IF;

  INSERT INTO public.app_admins (user_id)
  VALUES (p_target_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.revoke_app_admin(p_target_id UUID)
RETURNS JSONB AS $$
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  IF p_target_id = auth.uid() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Voce nao pode remover o proprio admin.');
  END IF;

  DELETE FROM public.app_admins WHERE user_id = p_target_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------
-- Banimento definitivo de conta
-- Remove auth.users (cascade apaga perfil, mensagens, participacoes).
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_app_account(p_target_id UUID)
RETURNS JSONB AS $$
DECLARE
  target_name TEXT;
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  IF p_target_id = auth.uid() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Voce nao pode banir a propria conta.');
  END IF;

  SELECT display_name INTO target_name
  FROM public.profiles WHERE id = p_target_id;

  IF target_name IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Conta nao encontrada.');
  END IF;

  DELETE FROM auth.users WHERE id = p_target_id;

  RETURN jsonb_build_object('success', TRUE, 'target_name', target_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ------------------------------------------------------------------
-- RLS: somente admins podem ler app_admins
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "app_admins_select_self_or_admin" ON public.app_admins;
CREATE POLICY "app_admins_select_self_or_admin" ON public.app_admins
  FOR SELECT USING (user_id = auth.uid() OR public.is_app_admin(auth.uid()));