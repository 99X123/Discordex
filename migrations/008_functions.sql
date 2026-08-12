-- ============================================================
-- 008_seed_defaults.sql
-- Funções auxiliares para operações comuns
-- ============================================================

-- Função: Criar servidor com estrutura padrão completa
-- Cria: servidor + membro owner + cargo Admin + cargo @everyone + canal geral + canal de voz
CREATE OR REPLACE FUNCTION public.create_server_with_defaults(
  p_name       TEXT,
  p_owner_id   UUID,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_server_id   UUID;
  v_admin_role  UUID;
  v_member_role UUID;
  v_cat_info    UUID;
  v_cat_conversa UUID;
  v_cat_voz     UUID;
BEGIN
  -- Criar servidor
  INSERT INTO public.servers (name, description, owner_id)
  VALUES (p_name, p_description, p_owner_id)
  RETURNING id INTO v_server_id;

  -- Adicionar owner como membro
  INSERT INTO public.server_members (server_id, user_id)
  VALUES (v_server_id, p_owner_id);

  -- Criar cargo Administrador (todas as permissões)
  INSERT INTO public.roles (server_id, name, color, position, permissions)
  VALUES (v_server_id, 'Administrador', '#E53935', 100, 2147483647) -- Todos os bits
  RETURNING id INTO v_admin_role;

  -- Criar cargo @Membro padrão
  INSERT INTO public.roles (server_id, name, color, position, permissions)
  VALUES (v_server_id, 'Membro', '#99AAB5', 0, 256 + 512 + 1024 + 2048) -- VIEW + SEND + CONNECT + SPEAK
  RETURNING id INTO v_member_role;

  -- Dar cargo de Administrador ao owner
  INSERT INTO public.role_members (role_id, user_id)
  VALUES (v_admin_role, p_owner_id);

  -- Criar categorias de canais
  INSERT INTO public.channels (server_id, name, type, position)
  VALUES (v_server_id, 'INFORMAÇÕES', 'category', 0)
  RETURNING id INTO v_cat_info;

  INSERT INTO public.channels (server_id, name, type, position)
  VALUES (v_server_id, 'CONVERSA', 'category', 1)
  RETURNING id INTO v_cat_conversa;

  INSERT INTO public.channels (server_id, name, type, position)
  VALUES (v_server_id, 'VOZ', 'category', 2)
  RETURNING id INTO v_cat_voz;

  -- Criar canais de texto
  INSERT INTO public.channels (server_id, name, type, position, parent_id, description)
  VALUES
    (v_server_id, 'regras',    'text', 0, v_cat_info,    'Regras e diretrizes do servidor.'),
    (v_server_id, 'novidades', 'text', 1, v_cat_info,    'Anúncios e novidades.'),
    (v_server_id, 'geral',     'text', 0, v_cat_conversa, 'Canal de conversa geral.'),
    (v_server_id, 'bate-papo', 'text', 1, v_cat_conversa, 'Conversas aleatórias.');

  -- Criar canais de voz
  INSERT INTO public.channels (server_id, name, type, position, parent_id)
  VALUES
    (v_server_id, 'Sala Geral',  'voice', 0, v_cat_voz),
    (v_server_id, 'Sala Gaming', 'voice', 1, v_cat_voz);

  RETURN v_server_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Entrar em servidor via código de convite
CREATE OR REPLACE FUNCTION public.join_server_with_invite(
  p_code    TEXT,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_invite   public.invites%ROWTYPE;
  v_server_id UUID;
BEGIN
  -- Busca convite válido
  SELECT * INTO v_invite
  FROM public.invites
  WHERE code = p_code
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR uses < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITE_INVALID', 'message', 'Convite inválido ou expirado.');
  END IF;

  -- Verifica se já é membro
  IF EXISTS (
    SELECT 1 FROM public.server_members
    WHERE server_id = v_invite.server_id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'server_id', v_invite.server_id, 'already_member', true);
  END IF;

  -- Adiciona como membro
  INSERT INTO public.server_members (server_id, user_id)
  VALUES (v_invite.server_id, p_user_id);

  -- Incrementa uso
  UPDATE public.invites SET uses = uses + 1 WHERE id = v_invite.id;

  -- Dar cargo @Membro padrão
  INSERT INTO public.role_members (role_id, user_id)
  SELECT r.id, p_user_id
  FROM public.roles r
  WHERE r.server_id = v_invite.server_id AND r.name = 'Membro'
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'server_id', v_invite.server_id, 'already_member', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Kickar membro (verifica permissão)
CREATE OR REPLACE FUNCTION public.kick_member(
  p_executor_id UUID,
  p_server_id   UUID,
  p_target_id   UUID
)
RETURNS JSONB AS $$
BEGIN
  -- Verifica permissão
  IF NOT public.user_has_permission(p_executor_id, p_server_id, 32) THEN -- KICK_MEMBERS
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Você não possui permissão para expulsar membros.');
  END IF;

  -- Não pode kickar o dono
  IF EXISTS (SELECT 1 FROM public.servers WHERE id = p_server_id AND owner_id = p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_KICK_OWNER', 'message', 'Não é possível expulsar o proprietário do servidor.');
  END IF;

  DELETE FROM public.server_members WHERE server_id = p_server_id AND user_id = p_target_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Banir membro (kick + bloquear acesso)
CREATE OR REPLACE FUNCTION public.ban_member(
  p_executor_id UUID,
  p_server_id   UUID,
  p_target_id   UUID
)
RETURNS JSONB AS $$
BEGIN
  -- Verifica permissão
  IF NOT public.user_has_permission(p_executor_id, p_server_id, 64) THEN -- BAN_MEMBERS
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Você não possui permissão para banir membros.');
  END IF;

  -- Não pode banir o dono
  IF EXISTS (SELECT 1 FROM public.servers WHERE id = p_server_id AND owner_id = p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_BAN_OWNER', 'message', 'Não é possível banir o proprietário do servidor.');
  END IF;

  -- Remove membro
  DELETE FROM public.server_members WHERE server_id = p_server_id AND user_id = p_target_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Aplicar timeout em membro
CREATE OR REPLACE FUNCTION public.timeout_member(
  p_executor_id UUID,
  p_server_id   UUID,
  p_target_id   UUID,
  p_minutes     INTEGER
)
RETURNS JSONB AS $$
BEGIN
  IF NOT public.user_has_permission(p_executor_id, p_server_id, 32) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Permissão negada.');
  END IF;

  UPDATE public.server_members
  SET timeout_until = NOW() + (p_minutes || ' minutes')::INTERVAL
  WHERE server_id = p_server_id AND user_id = p_target_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
