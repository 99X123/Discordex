-- ============================================================
-- 012_server_invites.sql
-- RPC para criar convites de servidor (link compartilhavel)
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_server_invite(
  p_server_id UUID,
  p_max_uses INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := public.current_user_id();
  v_invite public.invites%ROWTYPE;
BEGIN
  -- Qualquer membro pode criar convite (como no Discord)
  IF NOT EXISTS (
    SELECT 1 FROM public.server_members
    WHERE server_id = p_server_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_MEMBER', 'message', 'Voce nao e membro deste servidor.');
  END IF;

  INSERT INTO public.invites (server_id, creator_id, max_uses)
  VALUES (p_server_id, v_user_id, p_max_uses)
  RETURNING * INTO v_invite;

  RETURN jsonb_build_object(
    'success', true,
    'code', v_invite.code,
    'invite_id', v_invite.id,
    'server_id', p_server_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;