-- ============================================================
-- 016_roles_permissions_audit.sql
-- Cargos, permissões, hierarquia, canais privados e logs.
-- Não recria nada existente: apenas adiciona ao sistema atual.
-- ============================================================

-- ------------------------------------------------------------
-- Novos bits de permissão (continuando a bitmask de 002/009):
--  16384  = MANAGE_MEMBERS        (gerenciar membros / adicionar-remover)
--  32768  = PROMOTE_MEMBERS       (promover membros)
--  65536  = DEMOTE_MEMBERS        (rebaixar membros)
--  131072 = DISCONNECT_MEMBERS    (desconectar membros da call)
--  262144 = MOVE_MEMBERS          (mover membros entre calls)
--  524288 = MANAGE_PRIVATE_CHANNELS (gerenciar canais privados)
--  1048576 = MUTE_MEMBERS         (mutar membro na call)
--  2097152 = DEAFEN_MEMBERS       (ensurdecer membro na call)
--  4194304 = VIEW_AUDIT_LOG       (visualizar logs do grupo)
-- ------------------------------------------------------------

-- ============================================================
-- channel_role_permissions: acesso a canais por cargo
-- Sem registros => canal público para todos os membros.
-- Com qualquer registro => canal privado: apenas cargos com can_view.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.channel_role_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  can_view   BOOLEAN NOT NULL DEFAULT TRUE,
  can_send   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel_id, role_id)
);

-- ============================================================
-- audit_logs: registro de todas as ações administrativas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  actor_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  target_id   UUID,
  target_name TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_server_created
  ON public.audit_logs (server_id, created_at DESC);

ALTER TABLE public.channel_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helpers de hierarquia e acesso
-- ============================================================

-- Posição do cargo mais alto de um usuário no servidor.
-- O dono tem posição máxima (sempre acima de todos).
CREATE OR REPLACE FUNCTION public.get_user_top_role_position(
  p_user_id UUID,
  p_server_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_owner UUID;
  v_max INTEGER;
BEGIN
  SELECT owner_id INTO v_owner FROM public.servers WHERE id = p_server_id;
  IF v_owner = p_user_id THEN RETURN 2147483647; END IF;

  SELECT COALESCE(MAX(r.position), -1) INTO v_max
  FROM public.role_members rm
  JOIN public.roles r ON r.id = rm.role_id
  WHERE rm.user_id = p_user_id AND r.server_id = p_server_id;

  RETURN COALESCE(v_max, -1);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- O executor pode gerenciar o alvo? (posição superior OU dono)
CREATE OR REPLACE FUNCTION public.can_manage_member(
  p_executor_id UUID,
  p_server_id UUID,
  p_target_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_executor_id = p_target_id THEN RETURN FALSE; END IF;
  RETURN public.get_user_top_role_position(p_executor_id, p_server_id)
      >  public.get_user_top_role_position(p_target_id, p_server_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- O executor pode gerenciar o cargo? (cargo abaixo do topo do executor)
CREATE OR REPLACE FUNCTION public.can_manage_role(
  p_executor_id UUID,
  p_role_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_server_id UUID;
  v_position INTEGER;
BEGIN
  SELECT server_id, position INTO v_server_id, v_position FROM public.roles WHERE id = p_role_id;
  IF v_server_id IS NULL THEN RETURN FALSE; END IF;
  RETURN public.get_user_top_role_position(p_executor_id, v_server_id) > v_position;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- Pode visualizar o canal (leva em conta canais privados por cargo)
CREATE OR REPLACE FUNCTION public.can_view_channel(
  p_user_id UUID,
  p_channel_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_server_id UUID;
BEGIN
  SELECT server_id INTO v_server_id FROM public.channels WHERE id = p_channel_id;
  IF v_server_id IS NULL THEN RETURN FALSE; END IF;

  -- Dono e ADMINISTRATOR sempre veem tudo
  IF public.user_has_permission(p_user_id, v_server_id, 1) THEN RETURN TRUE; END IF;

  -- Canal sem overrides é público para membros
  IF NOT EXISTS (
    SELECT 1 FROM public.channel_role_permissions crp WHERE crp.channel_id = p_channel_id
  ) THEN
    RETURN public.is_server_member(p_user_id, v_server_id);
  END IF;

  -- Canal privado: precisa de cargo com can_view
  RETURN EXISTS (
    SELECT 1
    FROM public.channel_role_permissions crp
    JOIN public.role_members rm ON rm.role_id = crp.role_id
    WHERE crp.channel_id = p_channel_id
      AND crp.can_view
      AND rm.user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- Pode enviar mensagem no canal (canais privados + can_send)
CREATE OR REPLACE FUNCTION public.can_send_to_channel(
  p_user_id UUID,
  p_channel_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_server_id UUID;
BEGIN
  SELECT server_id INTO v_server_id FROM public.channels WHERE id = p_channel_id;
  IF v_server_id IS NULL THEN RETURN FALSE; END IF;

  IF public.user_has_permission(p_user_id, v_server_id, 1) THEN RETURN TRUE; END IF;
  IF NOT public.can_view_channel(p_user_id, p_channel_id) THEN RETURN FALSE; END IF;

  IF EXISTS (
    SELECT 1 FROM public.channel_role_permissions crp WHERE crp.channel_id = p_channel_id
  ) THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.channel_role_permissions crp
      JOIN public.role_members rm ON rm.role_id = crp.role_id
      WHERE crp.channel_id = p_channel_id
        AND crp.can_send
        AND rm.user_id = p_user_id
    );
  END IF;

  RETURN public.user_has_permission(p_user_id, v_server_id, 512); -- SEND_MESSAGES
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- ============================================================
-- Log de auditoria
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_audit(
  p_server_id UUID,
  p_action TEXT,
  p_target_id UUID DEFAULT NULL,
  p_target_name TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.audit_logs (server_id, actor_id, action, target_id, target_name, details)
  VALUES (p_server_id, public.current_user_id(), p_action, p_target_id, p_target_name, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Trigger: entrada/saída de membros no grupo (cobre join/leave/kick/ban)
CREATE OR REPLACE FUNCTION public.log_member_change()
RETURNS TRIGGER AS $$
DECLARE
  v_actor UUID := COALESCE(auth.uid(), NEW.user_id, OLD.user_id);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (server_id, actor_id, action, target_id)
    VALUES (NEW.server_id, v_actor, 'MEMBER_JOINED', NEW.user_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (server_id, actor_id, action, target_id)
    VALUES (OLD.server_id, v_actor, 'MEMBER_LEFT', OLD.user_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS server_members_audit ON public.server_members;
CREATE TRIGGER server_members_audit
  AFTER INSERT OR DELETE ON public.server_members
  FOR EACH ROW EXECUTE FUNCTION public.log_member_change();

-- ============================================================
-- RPCs: gestão de cargos
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_role(
  p_server_id UUID,
  p_name TEXT,
  p_color TEXT DEFAULT '#99AAB5',
  p_permissions BIGINT DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
  v_top INTEGER;
  v_max INTEGER;
  v_new_pos INTEGER;
  v_role_id UUID;
BEGIN
  IF NOT public.user_has_permission(v_executor, p_server_id, 8) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para gerenciar cargos.');
  END IF;

  v_top := public.get_user_top_role_position(v_executor, p_server_id);
  SELECT COALESCE(MAX(position), 0) INTO v_max FROM public.roles WHERE server_id = p_server_id;
  IF v_top = 2147483647 THEN
    v_new_pos := v_max + 1;
  ELSE
    v_new_pos := GREATEST(v_top - 1, 0);
  END IF;

  INSERT INTO public.roles (server_id, name, color, position, permissions)
  VALUES (p_server_id, p_name, p_color, v_new_pos, p_permissions)
  RETURNING id INTO v_role_id;

  PERFORM public.log_audit(p_server_id, 'ROLE_CREATED', v_role_id, p_name,
    jsonb_build_object('permissions', p_permissions, 'color', p_color));
  RETURN jsonb_build_object('success', true, 'role_id', v_role_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.update_role(
  p_server_id UUID,
  p_role_id UUID,
  p_name TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL,
  p_permissions BIGINT DEFAULT NULL,
  p_position INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
  v_role public.roles%ROWTYPE;
  v_new_position INTEGER;
  v_top INTEGER;
BEGIN
  SELECT * INTO v_role FROM public.roles WHERE id = p_role_id AND server_id = p_server_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ROLE_NOT_FOUND', 'message', 'Cargo nao encontrado.');
  END IF;
  IF NOT public.user_has_permission(v_executor, p_server_id, 8) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para gerenciar cargos.');
  END IF;
  IF NOT public.can_manage_role(v_executor, p_role_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode gerenciar cargos iguais ou superiores ao seu.');
  END IF;

  v_new_position := COALESCE(p_position, v_role.position);
  v_top := public.get_user_top_role_position(v_executor, p_server_id);
  IF v_top <> 2147483647 AND v_new_position >= v_top THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Nao e possivel posicionar o cargo acima ou no mesmo nivel do seu.');
  END IF;

  UPDATE public.roles SET
    name = COALESCE(p_name, v_role.name),
    color = COALESCE(p_color, v_role.color),
    permissions = COALESCE(p_permissions, v_role.permissions),
    position = v_new_position
  WHERE id = p_role_id;

  PERFORM public.log_audit(p_server_id, 'ROLE_UPDATED', p_role_id, v_role.name,
    jsonb_build_object('permissions', COALESCE(p_permissions, v_role.permissions)));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.delete_role(
  p_server_id UUID,
  p_role_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
  v_role public.roles%ROWTYPE;
BEGIN
  SELECT * INTO v_role FROM public.roles WHERE id = p_role_id AND server_id = p_server_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ROLE_NOT_FOUND', 'message', 'Cargo nao encontrado.');
  END IF;
  IF NOT public.user_has_permission(v_executor, p_server_id, 8) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para gerenciar cargos.');
  END IF;
  IF NOT public.can_manage_role(v_executor, p_role_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode excluir cargos iguais ou superiores ao seu.');
  END IF;

  DELETE FROM public.roles WHERE id = p_role_id;
  PERFORM public.log_audit(p_server_id, 'ROLE_DELETED', p_role_id, v_role.name);
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Atribuir cargo a um membro (requer gerenciar cargos + hierarquia)
CREATE OR REPLACE FUNCTION public.add_role_to_member(
  p_server_id UUID,
  p_target_id UUID,
  p_role_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
  v_role public.roles%ROWTYPE;
BEGIN
  SELECT * INTO v_role FROM public.roles WHERE id = p_role_id AND server_id = p_server_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ROLE_NOT_FOUND', 'message', 'Cargo nao encontrado.');
  END IF;
  IF NOT public.user_has_permission(v_executor, p_server_id, 8) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para gerenciar cargos.');
  END IF;
  IF NOT public.can_manage_role(v_executor, p_role_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode atribuir cargos iguais ou superiores ao seu.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.server_members WHERE server_id = p_server_id AND user_id = p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'TARGET_NOT_MEMBER', 'message', 'O alvo nao e membro do grupo.');
  END IF;
  IF NOT public.can_manage_member(v_executor, p_server_id, p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode gerenciar membros com cargo igual ou superior ao seu.');
  END IF;

  INSERT INTO public.role_members (role_id, user_id) VALUES (p_role_id, p_target_id)
  ON CONFLICT DO NOTHING;

  PERFORM public.log_audit(p_server_id, 'ROLE_ASSIGNED', p_target_id,
    NULL, jsonb_build_object('role_id', p_role_id, 'role_name', v_role.name));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Remover cargo de um membro (requer gerenciar cargos + hierarquia)
CREATE OR REPLACE FUNCTION public.remove_role_from_member(
  p_server_id UUID,
  p_target_id UUID,
  p_role_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
  v_role public.roles%ROWTYPE;
BEGIN
  SELECT * INTO v_role FROM public.roles WHERE id = p_role_id AND server_id = p_server_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ROLE_NOT_FOUND', 'message', 'Cargo nao encontrado.');
  END IF;
  IF NOT public.user_has_permission(v_executor, p_server_id, 8) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para gerenciar cargos.');
  END IF;
  IF NOT public.can_manage_role(v_executor, p_role_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode remover cargos iguais ou superiores ao seu.');
  END IF;
  IF NOT public.can_manage_member(v_executor, p_server_id, p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode gerenciar membros com cargo igual ou superior ao seu.');
  END IF;

  DELETE FROM public.role_members WHERE role_id = p_role_id AND user_id = p_target_id;

  PERFORM public.log_audit(p_server_id, 'ROLE_REMOVED', p_target_id,
    NULL, jsonb_build_object('role_id', p_role_id, 'role_name', v_role.name));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Promover membro: atribuir cargo acima do atual
CREATE OR REPLACE FUNCTION public.promote_member(
  p_server_id UUID,
  p_target_id UUID,
  p_role_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
  v_role public.roles%ROWTYPE;
  v_target_top INTEGER;
BEGIN
  SELECT * INTO v_role FROM public.roles WHERE id = p_role_id AND server_id = p_server_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ROLE_NOT_FOUND', 'message', 'Cargo nao encontrado.');
  END IF;
  IF NOT (public.user_has_permission(v_executor, p_server_id, 32768) OR public.user_has_permission(v_executor, p_server_id, 8)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para promover membros.');
  END IF;
  IF NOT public.can_manage_role(v_executor, p_role_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode promover alguem acima do seu cargo.');
  END IF;
  IF NOT public.can_manage_member(v_executor, p_server_id, p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode gerenciar membros com cargo igual ou superior ao seu.');
  END IF;

  v_target_top := public.get_user_top_role_position(p_target_id, p_server_id);
  IF v_role.position <= v_target_top THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_PROMOTION', 'message', 'O cargo informado nao e uma promocao para este membro.');
  END IF;

  INSERT INTO public.role_members (role_id, user_id) VALUES (p_role_id, p_target_id)
  ON CONFLICT DO NOTHING;

  PERFORM public.log_audit(p_server_id, 'MEMBER_PROMOTED', p_target_id,
    NULL, jsonb_build_object('role_id', p_role_id, 'role_name', v_role.name));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Rebaixar membro: remover cargo acima do atual (ou o cargo escolhido)
CREATE OR REPLACE FUNCTION public.demote_member(
  p_server_id UUID,
  p_target_id UUID,
  p_role_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
  v_role public.roles%ROWTYPE;
BEGIN
  SELECT * INTO v_role FROM public.roles WHERE id = p_role_id AND server_id = p_server_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ROLE_NOT_FOUND', 'message', 'Cargo nao encontrado.');
  END IF;
  IF NOT (public.user_has_permission(v_executor, p_server_id, 65536) OR public.user_has_permission(v_executor, p_server_id, 8)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para rebaixar membros.');
  END IF;
  IF NOT public.can_manage_role(v_executor, p_role_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode remover cargos iguais ou superiores ao seu.');
  END IF;
  IF NOT public.can_manage_member(v_executor, p_server_id, p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode gerenciar membros com cargo igual ou superior ao seu.');
  END IF;

  DELETE FROM public.role_members WHERE role_id = p_role_id AND user_id = p_target_id;

  PERFORM public.log_audit(p_server_id, 'MEMBER_DEMOTED', p_target_id,
    NULL, jsonb_build_object('role_id', p_role_id, 'role_name', v_role.name));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ============================================================
-- RPCs: moderação de voz (calls)
-- ============================================================

CREATE OR REPLACE FUNCTION public.disconnect_member(
  p_server_id UUID,
  p_target_id UUID,
  p_channel_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
BEGIN
  IF NOT public.user_has_permission(v_executor, p_server_id, 131072) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para desconectar membros da call.');
  END IF;
  IF NOT public.can_manage_member(v_executor, p_server_id, p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode desconectar membros com cargo igual ou superior ao seu.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.voice_states vs
    JOIN public.channels c ON c.id = vs.channel_id
    WHERE vs.user_id = p_target_id AND c.server_id = p_server_id AND vs.channel_id = p_channel_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_IN_CHANNEL', 'message', 'O membro nao esta nessa call.');
  END IF;

  DELETE FROM public.voice_states WHERE user_id = p_target_id AND channel_id = p_channel_id;
  PERFORM public.log_audit(p_server_id, 'VOICE_DISCONNECTED', p_target_id,
    NULL, jsonb_build_object('channel_id', p_channel_id));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.move_member(
  p_server_id UUID,
  p_target_id UUID,
  p_from_channel_id UUID,
  p_to_channel_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
BEGIN
  IF NOT public.user_has_permission(v_executor, p_server_id, 262144) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para mover membros entre calls.');
  END IF;
  IF NOT public.can_manage_member(v_executor, p_server_id, p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode mover membros com cargo igual ou superior ao seu.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.voice_states
    WHERE user_id = p_target_id AND channel_id = p_from_channel_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_IN_CHANNEL', 'message', 'O membro nao esta na call de origem.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.channels
    WHERE id = p_to_channel_id AND server_id = p_server_id AND type = 'voice'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CHANNEL', 'message', 'Canal de destino invalido.');
  END IF;

  UPDATE public.voice_states SET channel_id = p_to_channel_id
  WHERE user_id = p_target_id AND channel_id = p_from_channel_id;

  PERFORM public.log_audit(p_server_id, 'VOICE_MOVED', p_target_id,
    NULL, jsonb_build_object('from', p_from_channel_id, 'to', p_to_channel_id));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.set_member_muted(
  p_server_id UUID,
  p_target_id UUID,
  p_muted BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
BEGIN
  IF NOT public.user_has_permission(v_executor, p_server_id, 1048576) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para mutar membros.');
  END IF;
  IF NOT public.can_manage_member(v_executor, p_server_id, p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode mutar membros com cargo igual ou superior ao seu.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.voice_states vs
    JOIN public.channels c ON c.id = vs.channel_id
    WHERE vs.user_id = p_target_id AND c.server_id = p_server_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_IN_CALL', 'message', 'O membro nao esta em uma call do grupo.');
  END IF;

  UPDATE public.voice_states vs SET muted = p_muted
  FROM public.channels c
  WHERE vs.channel_id = c.id AND c.server_id = p_server_id AND vs.user_id = p_target_id;

  PERFORM public.log_audit(p_server_id, 'VOICE_MUTED', p_target_id,
    NULL, jsonb_build_object('muted', p_muted));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.set_member_deafened(
  p_server_id UUID,
  p_target_id UUID,
  p_deafened BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
BEGIN
  IF NOT public.user_has_permission(v_executor, p_server_id, 2097152) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para ensurdecer membros.');
  END IF;
  IF NOT public.can_manage_member(v_executor, p_server_id, p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode ensurdecer membros com cargo igual ou superior ao seu.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.voice_states vs
    JOIN public.channels c ON c.id = vs.channel_id
    WHERE vs.user_id = p_target_id AND c.server_id = p_server_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_IN_CALL', 'message', 'O membro nao esta em uma call do grupo.');
  END IF;

  UPDATE public.voice_states vs SET deafened = p_deafened
  FROM public.channels c
  WHERE vs.channel_id = c.id AND c.server_id = p_server_id AND vs.user_id = p_target_id;

  PERFORM public.log_audit(p_server_id, 'VOICE_DEAFENED', p_target_id,
    NULL, jsonb_build_object('deafened', p_deafened));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ============================================================
-- RPC: canais privados (sincronizado com cargos)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_channel_role_permission(
  p_channel_id UUID,
  p_role_id UUID,
  p_can_view BOOLEAN,
  p_can_send BOOLEAN DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
  v_server_id UUID;
  v_role_server UUID;
BEGIN
  SELECT server_id INTO v_server_id FROM public.channels WHERE id = p_channel_id;
  SELECT server_id INTO v_role_server FROM public.roles WHERE id = p_role_id;
  IF v_server_id IS NULL OR v_role_server IS NULL OR v_server_id <> v_role_server THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TARGET', 'message', 'Canal ou cargo invalido.');
  END IF;

  IF NOT (public.user_has_permission(v_executor, v_server_id, 4)      -- MANAGE_CHANNELS
       OR public.user_has_permission(v_executor, v_server_id, 524288) -- MANAGE_PRIVATE_CHANNELS
       OR public.user_has_permission(v_executor, v_server_id, 8))     -- MANAGE_ROLES
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para gerenciar canais privados.');
  END IF;
  IF NOT public.can_manage_role(v_executor, p_role_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode gerenciar permissoes de cargos iguais ou superiores ao seu.');
  END IF;

  INSERT INTO public.channel_role_permissions (channel_id, role_id, can_view, can_send)
  VALUES (p_channel_id, p_role_id, p_can_view, COALESCE(p_can_send, p_can_view))
  ON CONFLICT (channel_id, role_id) DO UPDATE SET
    can_view = EXCLUDED.can_view,
    can_send = COALESCE(p_can_send, EXCLUDED.can_view);

  PERFORM public.log_audit(v_server_id, 'CHANNEL_PERMISSION_CHANGED', p_channel_id,
    NULL, jsonb_build_object('role_id', p_role_id, 'can_view', p_can_view, 'can_send', COALESCE(p_can_send, p_can_view)));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Remover override de um canal (volta a ser público)
CREATE OR REPLACE FUNCTION public.remove_channel_role_permission(
  p_channel_id UUID,
  p_role_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
  v_server_id UUID;
BEGIN
  SELECT server_id INTO v_server_id FROM public.channels WHERE id = p_channel_id;
  IF v_server_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TARGET', 'message', 'Canal invalido.');
  END IF;

  IF NOT (public.user_has_permission(v_executor, v_server_id, 4)
       OR public.user_has_permission(v_executor, v_server_id, 524288)
       OR public.user_has_permission(v_executor, v_server_id, 8))
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para gerenciar canais privados.');
  END IF;
  IF NOT public.can_manage_role(v_executor, p_role_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode gerenciar permissoes de cargos iguais ou superiores ao seu.');
  END IF;

  DELETE FROM public.channel_role_permissions WHERE channel_id = p_channel_id AND role_id = p_role_id;
  PERFORM public.log_audit(v_server_id, 'CHANNEL_PERMISSION_CHANGED', p_channel_id,
    NULL, jsonb_build_object('role_id', p_role_id, 'removed', true));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ============================================================
-- RPC: logs de auditoria
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_server_id UUID,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  actor_id UUID,
  actor_name TEXT,
  target_id UUID,
  target_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_executor UUID := public.current_user_id();
BEGIN
  IF NOT (public.user_has_permission(v_executor, p_server_id, 2)       -- MANAGE_SERVER
       OR public.user_has_permission(v_executor, p_server_id, 4194304) -- VIEW_AUDIT_LOG
       OR public.user_has_permission(v_executor, p_server_id, 8))      -- MANAGE_ROLES
  THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.action,
    al.actor_id,
    COALESCE(p.display_name, p.username, 'Sistema'),
    al.target_id,
    al.target_name,
    al.details,
    al.created_at
  FROM public.audit_logs al
  LEFT JOIN public.profiles p ON p.id = al.actor_id
  WHERE al.server_id = p_server_id
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ============================================================
-- Atualizar RPCs de moderação existentes com hierarquia
-- ============================================================

CREATE OR REPLACE FUNCTION public.kick_member(p_server_id UUID, p_target_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
BEGIN
  IF NOT (public.user_has_permission(v_executor, p_server_id, 32)      -- KICK_MEMBERS
       OR public.user_has_permission(v_executor, p_server_id, 16384)) -- MANAGE_MEMBERS
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para expulsar membros.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.servers WHERE id = p_server_id AND owner_id = p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_KICK_OWNER', 'message', 'Nao e possivel expulsar o proprietario do grupo.');
  END IF;
  IF NOT public.can_manage_member(v_executor, p_server_id, p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode expulsar alguem com cargo igual ou superior ao seu.');
  END IF;

  DELETE FROM public.server_members WHERE server_id = p_server_id AND user_id = p_target_id;
  DELETE FROM public.voice_states WHERE user_id = p_target_id AND channel_id IN (SELECT id FROM public.channels WHERE server_id = p_server_id);
  PERFORM public.log_audit(p_server_id, 'MEMBER_KICKED', p_target_id);
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.ban_member(p_server_id UUID, p_target_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
BEGIN
  IF NOT (public.user_has_permission(v_executor, p_server_id, 64)      -- BAN_MEMBERS
       OR public.user_has_permission(v_executor, p_server_id, 16384)) -- MANAGE_MEMBERS
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para banir membros.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.servers WHERE id = p_server_id AND owner_id = p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_BAN_OWNER', 'message', 'Nao e possivel banir o proprietario do grupo.');
  END IF;
  IF NOT public.can_manage_member(v_executor, p_server_id, p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode banir alguem com cargo igual ou superior ao seu.');
  END IF;

  INSERT INTO public.server_bans (server_id, user_id, banned_by, reason)
  VALUES (p_server_id, p_target_id, v_executor, p_reason)
  ON CONFLICT (server_id, user_id) DO UPDATE SET banned_by = EXCLUDED.banned_by, reason = EXCLUDED.reason;
  DELETE FROM public.server_members WHERE server_id = p_server_id AND user_id = p_target_id;
  DELETE FROM public.voice_states WHERE user_id = p_target_id AND channel_id IN (SELECT id FROM public.channels WHERE server_id = p_server_id);
  PERFORM public.log_audit(p_server_id, 'MEMBER_BANNED', p_target_id);
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.timeout_member(p_server_id UUID, p_target_id UUID, p_minutes INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
BEGIN
  IF p_minutes < 1 OR p_minutes > 40320 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TIMEOUT', 'message', 'Duracao de timeout invalida.');
  END IF;
  IF NOT (public.user_has_permission(v_executor, p_server_id, 32)
       OR public.user_has_permission(v_executor, p_server_id, 16384)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Permissao negada.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.servers WHERE id = p_server_id AND owner_id = p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_TIMEOUT_OWNER', 'message', 'Nao e possivel aplicar timeout no proprietario.');
  END IF;
  IF NOT public.can_manage_member(v_executor, p_server_id, p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'HIERARCHY', 'message', 'Voce nao pode aplicar timeout em alguem com cargo igual ou superior ao seu.');
  END IF;

  UPDATE public.server_members
  SET timeout_until = NOW() + (p_minutes || ' minutes')::INTERVAL
  WHERE server_id = p_server_id AND user_id = p_target_id;

  PERFORM public.log_audit(p_server_id, 'MEMBER_TIMEOUT', p_target_id,
    NULL, jsonb_build_object('minutes', p_minutes));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ============================================================
-- RLS: novas tabelas
-- ============================================================

DROP POLICY IF EXISTS "crp_select_member" ON public.channel_role_permissions;
CREATE POLICY "crp_select_member" ON public.channel_role_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE c.id = channel_id AND sm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "crp_write_via_rpc" ON public.channel_role_permissions;
CREATE POLICY "crp_write_via_rpc" ON public.channel_role_permissions
  FOR ALL USING (FALSE)
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS "audit_select_member" ON public.audit_logs;
CREATE POLICY "audit_select_member" ON public.audit_logs
  FOR SELECT USING (
    public.user_has_permission(auth.uid(), server_id, 2)
    OR public.user_has_permission(auth.uid(), server_id, 4194304)
    OR public.user_has_permission(auth.uid(), server_id, 8)
  );

DROP POLICY IF EXISTS "audit_write_via_rpc" ON public.audit_logs;
CREATE POLICY "audit_write_via_rpc" ON public.audit_logs
  FOR ALL USING (FALSE)
  WITH CHECK (FALSE);

-- ============================================================
-- RLS: canais, mensagens, voz e reações respeitando canais privados
-- ============================================================

DROP POLICY IF EXISTS "channels_select_member" ON public.channels;
CREATE POLICY "channels_select_member" ON public.channels
  FOR SELECT USING (public.can_view_channel(auth.uid(), id));

-- Gestores de cargos / canais privados precisam ENXERGAR todos os canais
-- para configurar acessos (sem conceder escrita direta).
DROP POLICY IF EXISTS "channels_select_role_manager" ON public.channels;
CREATE POLICY "channels_select_role_manager" ON public.channels
  FOR SELECT USING (
    public.user_has_permission(auth.uid(), server_id, 8)
    OR public.user_has_permission(auth.uid(), server_id, 524288)
  );

DROP POLICY IF EXISTS "messages_select_member" ON public.messages;
CREATE POLICY "messages_select_member" ON public.messages
  FOR SELECT USING (public.can_view_channel(auth.uid(), channel_id));

DROP POLICY IF EXISTS "messages_insert_member" ON public.messages;
CREATE POLICY "messages_insert_member" ON public.messages
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND public.can_send_to_channel(auth.uid(), channel_id)
  );

DROP POLICY IF EXISTS "reactions_select_member" ON public.message_reactions;
CREATE POLICY "reactions_select_member" ON public.message_reactions
  FOR SELECT USING (
    public.can_view_channel(auth.uid(), (SELECT m.channel_id FROM public.messages m WHERE m.id = message_id))
  );

DROP POLICY IF EXISTS "voice_states_select_member" ON public.voice_states;
CREATE POLICY "voice_states_select_member" ON public.voice_states
  FOR SELECT USING (public.can_view_channel(auth.uid(), channel_id));

-- Cargos: gestão respeitando hierarquia
DROP POLICY IF EXISTS "roles_manage_permission" ON public.roles;
CREATE POLICY "roles_manage_permission" ON public.roles
  FOR ALL USING (
    public.user_has_permission(auth.uid(), server_id, 8)
    AND public.can_manage_role(auth.uid(), id)
  );

DROP POLICY IF EXISTS "role_members_manage_permission" ON public.role_members;
CREATE POLICY "role_members_manage_role" ON public.role_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_id
        AND public.user_has_permission(auth.uid(), r.server_id, 8)
        AND public.can_manage_role(auth.uid(), r.id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_id
        AND public.user_has_permission(auth.uid(), r.server_id, 8)
        AND public.can_manage_role(auth.uid(), r.id)
    )
  );

-- ============================================================
-- Guards de mensagem/voz respeitando canais privados
-- ============================================================

CREATE OR REPLACE FUNCTION public.assert_message_channel()
RETURNS TRIGGER AS $$
DECLARE
  v_server_id UUID;
  v_type TEXT;
BEGIN
  SELECT server_id, type INTO v_server_id, v_type
  FROM public.channels
  WHERE id = NEW.channel_id;

  IF v_type <> 'text' THEN
    RAISE EXCEPTION 'CHANNEL_NOT_TEXT';
  END IF;

  IF NOT public.is_server_member(NEW.author_id, v_server_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  IF NOT public.can_send_to_channel(NEW.author_id, NEW.channel_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  IF TG_OP = 'INSERT' AND NOT public.check_rate_limit('messages', 20, 60) THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.assert_voice_state()
RETURNS TRIGGER AS $$
DECLARE
  v_server_id UUID;
  v_type TEXT;
BEGIN
  SELECT server_id, type INTO v_server_id, v_type FROM public.channels WHERE id = NEW.channel_id;
  IF v_type <> 'voice' THEN
    RAISE EXCEPTION 'CHANNEL_NOT_VOICE';
  END IF;
  IF NOT public.is_server_member(NEW.user_id, v_server_id) OR NOT public.user_has_permission(NEW.user_id, v_server_id, 1024) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  IF NOT public.can_view_channel(NEW.user_id, NEW.channel_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS messages_assert_channel ON public.messages;
CREATE TRIGGER messages_assert_channel
  BEFORE INSERT OR UPDATE OF channel_id, author_id, content ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.assert_message_channel();

DROP TRIGGER IF EXISTS voice_states_assert_channel ON public.voice_states;
CREATE TRIGGER voice_states_assert_channel
  BEFORE INSERT OR UPDATE OF channel_id, user_id ON public.voice_states
  FOR EACH ROW EXECUTE FUNCTION public.assert_voice_state();

-- ============================================================
-- Realtime para permissões de canais
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_role_permissions;
  END IF;
END $$;