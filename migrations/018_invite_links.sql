-- ============================================================
-- 018_invite_links.sql
-- Link de convite estilo Discord: ao abrir o site com um
-- codigo (?invite=XXXX ou /invite/XXXX), a tela de convite
-- mostra as informacoes do servidor ANTES de entrar.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_invite_details(p_code TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invite  public.invites%ROWTYPE;
  v_server  public.servers%ROWTYPE;
  v_members INTEGER;
  v_user_id UUID := auth.uid();
BEGIN
  SELECT * INTO v_invite
  FROM public.invites
  WHERE code = p_code
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR uses < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITE_INVALID', 'message', 'Convite invalido ou expirado.');
  END IF;

  SELECT * INTO v_server FROM public.servers WHERE id = v_invite.server_id;
  IF v_server.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SERVER_NOT_FOUND', 'message', 'Servidor nao encontrado.');
  END IF;

  SELECT COUNT(*) INTO v_members
  FROM public.server_members
  WHERE server_id = v_server.id;

  RETURN jsonb_build_object(
    'success', true,
    'server_id', v_server.id,
    'server_name', v_server.name,
    'server_icon', v_server.icon_url,
    'member_count', v_members,
    'already_member', EXISTS (
      SELECT 1 FROM public.server_members
      WHERE server_id = v_server.id AND user_id = v_user_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Permitir que qualquer visitante (logado ou nao) consulte o convite
REVOKE EXECUTE ON FUNCTION public.get_invite_details(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_details(TEXT) TO anon, authenticated;