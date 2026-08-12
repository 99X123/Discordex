-- ============================================================
-- 017_full_schema.sql
-- ESQUEMA COMPLETO E CONSOLIDADO DO DISCORDEX.
-- Recria o banco do zero (tabelas, funcoes, triggers, RLS,
-- index, storage e realtime) no estado mais atualizado.
--
-- Consolida: 001..016 (versoes mais recentes de cada objeto).
-- Idempotente: pode rodar mais de uma vez sem quebrar.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1) TABELAS (ordem respeitando dependencias de FK)
-- ============================================================

-- Perfis vinculados ao auth.users do Supabase
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url  TEXT,
  bio         TEXT,
  status      TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'idle', 'dnd', 'offline')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Servidores (comunidades)
CREATE TABLE IF NOT EXISTS public.servers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (LENGTH(name) BETWEEN 2 AND 100),
  description TEXT,
  icon_url    TEXT,
  owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Membros de cada servidor
CREATE TABLE IF NOT EXISTS public.server_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id     UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nickname      TEXT,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  timeout_until TIMESTAMPTZ,
  UNIQUE (server_id, user_id)
);

-- Cargos e permissoes dentro de um servidor (bitmask BIGINT)
-- Bits:
--  1       = ADMINISTRATOR
--  2       = MANAGE_SERVER
--  4       = MANAGE_CHANNELS
--  8       = MANAGE_ROLES
--  16      = MANAGE_MESSAGES
--  32      = KICK_MEMBERS
--  64      = BAN_MEMBERS
--  128     = CREATE_INVITES
--  256     = VIEW_CHANNELS
--  512     = SEND_MESSAGES
--  1024    = CONNECT
--  2048    = SPEAK
--  4096    = VIDEO
--  8192    = SCREEN_SHARE
--  16384   = MANAGE_MEMBERS
--  32768   = PROMOTE_MEMBERS
--  65536   = DEMOTE_MEMBERS
--  131072  = DISCONNECT_MEMBERS
--  262144  = MOVE_MEMBERS
--  524288  = MANAGE_PRIVATE_CHANNELS
--  1048576 = MUTE_MEMBERS
--  2097152 = DEAFEN_MEMBERS
--  4194304 = VIEW_AUDIT_LOG
CREATE TABLE IF NOT EXISTS public.roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (LENGTH(name) BETWEEN 1 AND 100),
  color       TEXT DEFAULT '#99AAB5',
  position    INTEGER NOT NULL DEFAULT 0,
  permissions BIGINT NOT NULL DEFAULT 256 + 512 + 1024 + 2048, -- VIEW + SEND + CONNECT + SPEAK
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (server_id, name)
);

CREATE TABLE IF NOT EXISTS public.role_members (
  role_id    UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, user_id)
);

-- Canais de texto, voz e categorias
CREATE TABLE IF NOT EXISTS public.channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (LENGTH(name) BETWEEN 1 AND 100),
  type        TEXT NOT NULL CHECK (type IN ('text', 'voice', 'category')),
  description TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  parent_id   UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mensagens de texto em canais
CREATE TABLE IF NOT EXISTS public.messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (
    LENGTH(TRIM(content)) > 0 AND
    LENGTH(content) <= 4000
  ),
  reply_to   UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  edited     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reacoes emoji em mensagens
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL CHECK (LENGTH(emoji) BETWEEN 1 AND 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

-- Canais de Mensagens Diretas (1 canal por par, menor UUID sempre em user1)
CREATE TABLE IF NOT EXISTS public.direct_message_channels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user1_id, user2_id),
  CHECK (user1_id < user2_id)
);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.direct_message_channels(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (
    LENGTH(TRIM(content)) > 0 AND
    LENGTH(content) <= 4000
  ),
  reply_to   UUID REFERENCES public.direct_messages(id) ON DELETE SET NULL,
  edited     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sistema de amizade entre usuarios
CREATE TABLE IF NOT EXISTS public.friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (requester_id, receiver_id),
  CHECK (requester_id <> receiver_id)
);

-- Sistema de bloqueio de usuarios
CREATE TABLE IF NOT EXISTS public.blocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

-- Convites para servidores
CREATE TABLE IF NOT EXISTS public.invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  creator_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code        TEXT NOT NULL UNIQUE DEFAULT SUBSTR(gen_random_uuid()::TEXT, 1, 8),
  max_uses    INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  uses        INTEGER NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notificacoes do sistema
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('mention', 'dm', 'friend_request', 'invite', 'system')),
  reference_id UUID,
  data         JSONB,
  read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Estado de participantes em canais de voz
CREATE TABLE IF NOT EXISTS public.voice_states (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id      UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  muted           BOOLEAN NOT NULL DEFAULT FALSE,
  deafened        BOOLEAN NOT NULL DEFAULT FALSE,
  camera_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  screen_sharing  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (channel_id, user_id)
);

-- Sinalizacao WebRTC (SDP + ICE candidates) em canais de voz
CREATE TABLE IF NOT EXISTS public.webrtc_signals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  from_user   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('offer', 'answer', 'ice-candidate')),
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Banimentos permanentes de servidores
CREATE TABLE IF NOT EXISTS public.server_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  banned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT CHECK (reason IS NULL OR LENGTH(reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (server_id, user_id)
);

-- Rate limit por usuario/bucket/janela
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
  UNIQUE (user_id, bucket, window_start)
);

-- Administradores globais do Discordex
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Acesso a canais por cargo.
-- Sem registros => canal publico para todos os membros.
-- Com qualquer registro => canal privado: apenas cargos com can_view.
CREATE TABLE IF NOT EXISTS public.channel_role_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  can_view   BOOLEAN NOT NULL DEFAULT TRUE,
  can_send   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel_id, role_id)
);

-- Registro de todas as acoes administrativas
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

-- Sinalizacao WebRTC para chamadas privadas (DM) 1:1
CREATE TABLE IF NOT EXISTS public.dm_call_signals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_room   TEXT NOT NULL,
  from_user   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('offer', 'answer', 'ice-candidate')),
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Toques de chamada privada (DM) — destinatario ve/aceita/rejeita
CREATE TABLE IF NOT EXISTS public.dm_call_rings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_room   TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('voice', 'video')),
  status      TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'accepted', 'declined')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2) FUNCOES (todas antes de triggers e RLS que as usam)
-- ============================================================

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria perfil automaticamente no cadastro (username customizado)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 0;
BEGIN
  base_username := LOWER(SPLIT_PART(NEW.email, '@', 1));
  base_username := REGEXP_REPLACE(base_username, '[^a-z0-9_]', '_', 'g');

  IF NEW.raw_user_meta_data->>'username' IS NOT NULL
     AND NEW.raw_user_meta_data->>'username' <> '' THEN
    final_username := LOWER(REGEXP_REPLACE(
      REGEXP_REPLACE(TRIM(NEW.raw_user_meta_data->>'username'), '\s+', '_', 'g'),
      '[^a-z0-9_]', '', 'g'
    ));
    IF final_username IS NULL OR LENGTH(final_username) < 2 THEN
      final_username := base_username;
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) THEN
      RAISE EXCEPTION 'Username ja em uso: %', final_username;
    END IF;
  ELSE
    final_username := base_username;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
      counter := counter + 1;
      final_username := base_username || counter::TEXT;
    END LOOP;
  END IF;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), final_username),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retorna o usuario autenticado ou erro
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- Verifica se e membro do servidor (ignorando timeout ativo)
CREATE OR REPLACE FUNCTION public.is_server_member(p_user_id UUID, p_server_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.server_members sm
    WHERE sm.user_id = p_user_id
      AND sm.server_id = p_server_id
      AND (sm.timeout_until IS NULL OR sm.timeout_until < NOW())
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Verifica se ha bloqueio entre dois usuarios
CREATE OR REPLACE FUNCTION public.is_blocked_between(p_user1 UUID, p_user2 UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.blocks b
    WHERE (b.blocker_id = p_user1 AND b.blocked_id = p_user2)
       OR (b.blocker_id = p_user2 AND b.blocked_id = p_user1)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Rate limit (retorna TRUE se dentro do limite)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID := public.current_user_id();
  v_window TIMESTAMPTZ := TO_TIMESTAMP(FLOOR(EXTRACT(EPOCH FROM NOW()) / p_window_seconds) * p_window_seconds);
  v_count INTEGER;
BEGIN
  INSERT INTO public.rate_limits (user_id, bucket, window_start, request_count)
  VALUES (v_user_id, p_bucket, v_window, 1)
  ON CONFLICT (user_id, bucket, window_start)
  DO UPDATE SET request_count = public.rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  DELETE FROM public.rate_limits
  WHERE window_start < NOW() - INTERVAL '1 day';

  RETURN v_count <= p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Verifica permissao de um usuario no servidor (owner/admin sempre TRUE)
CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id   UUID,
  p_server_id UUID,
  p_permission BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_owner_id UUID;
  v_combined BIGINT := 0;
BEGIN
  SELECT owner_id INTO v_owner_id FROM public.servers WHERE id = p_server_id;
  IF v_owner_id = p_user_id THEN RETURN TRUE; END IF;

  SELECT COALESCE(BIT_OR(r.permissions), 0)
  INTO v_combined
  FROM public.role_members rm
  JOIN public.roles r ON r.id = rm.role_id
  WHERE rm.user_id = p_user_id
    AND r.server_id = p_server_id;

  IF (v_combined & 1) = 1 THEN RETURN TRUE; END IF;
  RETURN (v_combined & p_permission) = p_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Posicao do cargo mais alto de um usuario no servidor (dono = max)
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

-- O executor pode gerenciar o alvo? (posicao superior OU dono)
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

  IF public.user_has_permission(p_user_id, v_server_id, 1) THEN RETURN TRUE; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.channel_role_permissions crp WHERE crp.channel_id = p_channel_id
  ) THEN
    RETURN public.is_server_member(p_user_id, v_server_id);
  END IF;

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

-- Registro de auditoria
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

-- Trigger: entrada/saida de membros no grupo (join/leave/kick/ban)
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

-- Obter ou criar canal DM entre o usuario atual e outro
CREATE OR REPLACE FUNCTION public.get_or_create_dm_channel(p_other_user UUID)
RETURNS UUID AS $$
DECLARE
  v_current UUID := public.current_user_id();
  v_channel_id UUID;
  v_low UUID := LEAST(v_current, p_other_user);
  v_high UUID := GREATEST(v_current, p_other_user);
BEGIN
  IF v_current = p_other_user THEN
    RAISE EXCEPTION 'INVALID_DM_TARGET';
  END IF;
  IF public.is_blocked_between(v_current, p_other_user) THEN
    RAISE EXCEPTION 'USER_BLOCKED';
  END IF;
  IF NOT public.check_rate_limit('create_dm', 30, 3600) THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  INSERT INTO public.direct_message_channels (user1_id, user2_id)
  VALUES (v_low, v_high)
  ON CONFLICT (user1_id, user2_id) DO UPDATE SET user1_id = EXCLUDED.user1_id
  RETURNING id INTO v_channel_id;

  RETURN v_channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Criar servidor com estrutura padrao completa
CREATE OR REPLACE FUNCTION public.create_server_with_defaults(
  p_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_owner_id UUID := public.current_user_id();
  v_server_id UUID;
  v_admin_role UUID;
  v_member_role UUID;
  v_cat_info UUID;
  v_cat_conversa UUID;
  v_cat_voz UUID;
BEGIN
  IF NOT public.check_rate_limit('create_server', 5, 3600) THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  INSERT INTO public.servers (name, description, owner_id)
  VALUES (p_name, p_description, v_owner_id)
  RETURNING id INTO v_server_id;

  INSERT INTO public.server_members (server_id, user_id) VALUES (v_server_id, v_owner_id);
  INSERT INTO public.roles (server_id, name, color, position, permissions)
  VALUES (v_server_id, 'Administrador', '#E53935', 100, 2147483647)
  RETURNING id INTO v_admin_role;
  INSERT INTO public.roles (server_id, name, color, position, permissions)
  VALUES (v_server_id, 'Membro', '#99AAB5', 0, 3840)
  RETURNING id INTO v_member_role;
  INSERT INTO public.role_members (role_id, user_id) VALUES (v_admin_role, v_owner_id);

  INSERT INTO public.channels (server_id, name, type, position) VALUES (v_server_id, 'INFORMACOES', 'category', 0) RETURNING id INTO v_cat_info;
  INSERT INTO public.channels (server_id, name, type, position) VALUES (v_server_id, 'CONVERSA', 'category', 1) RETURNING id INTO v_cat_conversa;
  INSERT INTO public.channels (server_id, name, type, position) VALUES (v_server_id, 'VOZ', 'category', 2) RETURNING id INTO v_cat_voz;

  INSERT INTO public.channels (server_id, name, type, position, parent_id, description)
  VALUES
    (v_server_id, 'regras', 'text', 0, v_cat_info, 'Regras e diretrizes do servidor.'),
    (v_server_id, 'geral', 'text', 0, v_cat_conversa, 'Canal de conversa geral.'),
    (v_server_id, 'Sala Geral', 'voice', 0, v_cat_voz, NULL);

  RETURN v_server_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Entrar em servidor via codigo de convite
CREATE OR REPLACE FUNCTION public.join_server_with_invite(p_code TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := public.current_user_id();
  v_invite public.invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM public.invites
  WHERE code = p_code
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR uses < max_uses)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITE_INVALID', 'message', 'Convite invalido ou expirado.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.server_bans WHERE server_id = v_invite.server_id AND user_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'BANNED', 'message', 'Voce foi banido deste servidor.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.server_members WHERE server_id = v_invite.server_id AND user_id = v_user_id) THEN
    RETURN jsonb_build_object('success', true, 'server_id', v_invite.server_id, 'already_member', true);
  END IF;

  INSERT INTO public.server_members (server_id, user_id) VALUES (v_invite.server_id, v_user_id);
  UPDATE public.invites SET uses = uses + 1 WHERE id = v_invite.id;
  INSERT INTO public.role_members (role_id, user_id)
  SELECT id, v_user_id FROM public.roles WHERE server_id = v_invite.server_id AND name = 'Membro'
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'server_id', v_invite.server_id, 'already_member', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Criar convite de servidor (qualquer membro pode criar)
CREATE OR REPLACE FUNCTION public.create_server_invite(
  p_server_id UUID,
  p_max_uses INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := public.current_user_id();
  v_invite public.invites%ROWTYPE;
BEGIN
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

-- Expulsar membro (com hierarquia e log)
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

-- Banir membro (kick + registro em server_bans)
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

-- Aplicar timeout em membro
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

-- Criar cargo (hierarquia: novos cargos abaixo do cargo do executor)
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

-- Atualizar cargo (nome, cor, permissoes, posicao)
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

-- Excluir cargo
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

-- Atribuir cargo a um membro
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

-- Remover cargo de um membro
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

-- Desconectar membro da call
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

-- Mover membro entre calls
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

-- Mutar membro na call
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

-- Ensurdecer membro na call
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

-- Definir permissao de acesso de um cargo a um canal
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

-- Remover override de um canal (volta a ser publico)
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

-- Listar logs de auditoria
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

-- Limpar sinais WebRTC antigos (60s)
CREATE OR REPLACE FUNCTION public.clean_old_signals()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.webrtc_signals
  WHERE created_at < NOW() - INTERVAL '60 seconds';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Limpar sinais de chamadas DM antigos (60s)
CREATE OR REPLACE FUNCTION public.clean_old_dm_signals()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.dm_call_signals
  WHERE created_at < NOW() - INTERVAL '60 seconds';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar notificacoes de mencao em mensagens
CREATE OR REPLACE FUNCTION public.create_mention_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_user_id UUID;
BEGIN
  FOR v_username IN
    SELECT DISTINCT LOWER(match[1])
    FROM REGEXP_MATCHES(NEW.content, '@([A-Za-z0-9_]{3,32})', 'g') AS match
  LOOP
    SELECT p.id INTO v_user_id
    FROM public.profiles p
    WHERE LOWER(p.username) = v_username
      AND p.id <> NEW.author_id;

    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, reference_id, data)
      VALUES (v_user_id, 'mention', NEW.id, jsonb_build_object('channel_id', NEW.channel_id, 'author_id', NEW.author_id))
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar notificacao de mensagem direta
CREATE OR REPLACE FUNCTION public.create_dm_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_receiver UUID;
BEGIN
  SELECT CASE WHEN dmc.user1_id = NEW.author_id THEN dmc.user2_id ELSE dmc.user1_id END
  INTO v_receiver
  FROM public.direct_message_channels dmc
  WHERE dmc.id = NEW.channel_id;

  IF v_receiver IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, reference_id, data)
    VALUES (v_receiver, 'dm', NEW.id, jsonb_build_object('channel_id', NEW.channel_id, 'author_id', NEW.author_id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Guard de mensagem (canal de texto + membro + permissao + rate limit)
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

-- Guard de estado de voz (canal de voz + membro + permissao + visibilidade)
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

-- Verifica se o usuario e admin global do app
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

-- Lista contas registradas (somente admin global)
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

-- ============================================================
-- 3) TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS servers_updated_at ON public.servers;
CREATE TRIGGER servers_updated_at
  BEFORE UPDATE ON public.servers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS channels_updated_at ON public.channels;
CREATE TRIGGER channels_updated_at
  BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS messages_updated_at ON public.messages;
CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS messages_assert_channel ON public.messages;
CREATE TRIGGER messages_assert_channel
  BEFORE INSERT OR UPDATE OF channel_id, author_id, content ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.assert_message_channel();

DROP TRIGGER IF EXISTS messages_mentions_notify ON public.messages;
CREATE TRIGGER messages_mentions_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.create_mention_notifications();

DROP TRIGGER IF EXISTS direct_messages_updated_at ON public.direct_messages;
CREATE TRIGGER direct_messages_updated_at
  BEFORE UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS direct_messages_notify ON public.direct_messages;
CREATE TRIGGER direct_messages_notify
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.create_dm_notification();

DROP TRIGGER IF EXISTS friendships_updated_at ON public.friendships;
CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS voice_states_assert_channel ON public.voice_states;
CREATE TRIGGER voice_states_assert_channel
  BEFORE INSERT OR UPDATE OF channel_id, user_id ON public.voice_states
  FOR EACH ROW EXECUTE FUNCTION public.assert_voice_state();

DROP TRIGGER IF EXISTS server_members_audit ON public.server_members;
CREATE TRIGGER server_members_audit
  AFTER INSERT OR DELETE ON public.server_members
  FOR EACH ROW EXECUTE FUNCTION public.log_member_change();

-- ============================================================
-- 4) RLS — habilitar e criar politicas (funcoes ja existem)
-- ============================================================

ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_message_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_states          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webrtc_signals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_bans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_admins            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_call_signals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_call_rings         ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- SERVERS
DROP POLICY IF EXISTS "servers_select_member" ON public.servers;
CREATE POLICY "servers_select_member" ON public.servers
  FOR SELECT USING (
    id IN (SELECT server_id FROM public.server_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "servers_insert_authenticated" ON public.servers;
CREATE POLICY "servers_insert_authenticated" ON public.servers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

DROP POLICY IF EXISTS "servers_update_owner" ON public.servers;
CREATE POLICY "servers_update_owner" ON public.servers
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "servers_delete_owner" ON public.servers;
CREATE POLICY "servers_delete_owner" ON public.servers
  FOR DELETE USING (owner_id = auth.uid());

-- SERVER_MEMBERS
DROP POLICY IF EXISTS "server_members_select_member" ON public.server_members;
CREATE POLICY "server_members_select_member" ON public.server_members
  FOR SELECT USING (
    public.is_server_member(auth.uid(), server_id)
  );

DROP POLICY IF EXISTS "server_members_insert_self_not_banned" ON public.server_members;
CREATE POLICY "server_members_insert_self_not_banned" ON public.server_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.server_bans b WHERE b.server_id = server_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "server_members_delete_self" ON public.server_members;
CREATE POLICY "server_members_delete_self" ON public.server_members
  FOR DELETE USING (user_id = auth.uid());

-- CHANNELS
DROP POLICY IF EXISTS "channels_select_member" ON public.channels;
CREATE POLICY "channels_select_member" ON public.channels
  FOR SELECT USING (public.can_view_channel(auth.uid(), id));

-- Gestores de cargos / canais privados enxergam todos os canais
DROP POLICY IF EXISTS "channels_select_role_manager" ON public.channels;
CREATE POLICY "channels_select_role_manager" ON public.channels
  FOR SELECT USING (
    public.user_has_permission(auth.uid(), server_id, 8)
    OR public.user_has_permission(auth.uid(), server_id, 524288)
  );

DROP POLICY IF EXISTS "channels_manage_permission" ON public.channels;
CREATE POLICY "channels_manage_permission" ON public.channels
  FOR ALL USING (
    public.user_has_permission(auth.uid(), server_id, 4) -- MANAGE_CHANNELS
  );

-- MESSAGES
DROP POLICY IF EXISTS "messages_select_member" ON public.messages;
CREATE POLICY "messages_select_member" ON public.messages
  FOR SELECT USING (public.can_view_channel(auth.uid(), channel_id));

DROP POLICY IF EXISTS "messages_insert_member" ON public.messages;
CREATE POLICY "messages_insert_member" ON public.messages
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND public.can_send_to_channel(auth.uid(), channel_id)
  );

DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "messages_delete_own_or_manage" ON public.messages;
CREATE POLICY "messages_delete_own_or_manage" ON public.messages
  FOR DELETE USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_id
        AND public.user_has_permission(auth.uid(), c.server_id, 16) -- MANAGE_MESSAGES
    )
  );

-- MESSAGE_REACTIONS
DROP POLICY IF EXISTS "reactions_select_member" ON public.message_reactions;
CREATE POLICY "reactions_select_member" ON public.message_reactions
  FOR SELECT USING (
    public.can_view_channel(auth.uid(), (SELECT m.channel_id FROM public.messages m WHERE m.id = message_id))
  );

DROP POLICY IF EXISTS "reactions_manage_own" ON public.message_reactions;
CREATE POLICY "reactions_manage_own" ON public.message_reactions
  FOR ALL USING (user_id = auth.uid());

-- DIRECT MESSAGE CHANNELS
DROP POLICY IF EXISTS "dm_channels_select_participant" ON public.direct_message_channels;
CREATE POLICY "dm_channels_select_participant" ON public.direct_message_channels
  FOR SELECT USING (user1_id = auth.uid() OR user2_id = auth.uid());

DROP POLICY IF EXISTS "dm_channels_insert_authenticated" ON public.direct_message_channels;
CREATE POLICY "dm_channels_insert_authenticated" ON public.direct_message_channels
  FOR INSERT WITH CHECK (
    (user1_id = auth.uid() OR user2_id = auth.uid()) AND
    NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = user1_id AND b.blocked_id = auth.uid())
         OR (b.blocker_id = user2_id AND b.blocked_id = auth.uid())
    )
  );

-- DIRECT MESSAGES
DROP POLICY IF EXISTS "direct_messages_select_participant" ON public.direct_messages;
CREATE POLICY "direct_messages_select_participant" ON public.direct_messages
  FOR SELECT USING (
    channel_id IN (
      SELECT id FROM public.direct_message_channels
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "direct_messages_insert_participant" ON public.direct_messages;
CREATE POLICY "direct_messages_insert_participant" ON public.direct_messages
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.direct_message_channels dmc
      WHERE dmc.id = channel_id
        AND (dmc.user1_id = auth.uid() OR dmc.user2_id = auth.uid())
        AND NOT public.is_blocked_between(dmc.user1_id, dmc.user2_id)
    )
  );

DROP POLICY IF EXISTS "direct_messages_update_own" ON public.direct_messages;
CREATE POLICY "direct_messages_update_own" ON public.direct_messages
  FOR UPDATE USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "direct_messages_delete_own" ON public.direct_messages;
CREATE POLICY "direct_messages_delete_own" ON public.direct_messages
  FOR DELETE USING (author_id = auth.uid());

-- FRIENDSHIPS
DROP POLICY IF EXISTS "friendships_select_participant" ON public.friendships;
CREATE POLICY "friendships_select_participant" ON public.friendships
  FOR SELECT USING (requester_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "friendships_insert_requester" ON public.friendships;
CREATE POLICY "friendships_insert_requester" ON public.friendships
  FOR INSERT WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "friendships_update_participant" ON public.friendships;
CREATE POLICY "friendships_update_participant" ON public.friendships
  FOR UPDATE USING (requester_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "friendships_delete_participant" ON public.friendships;
CREATE POLICY "friendships_delete_participant" ON public.friendships
  FOR DELETE USING (requester_id = auth.uid() OR receiver_id = auth.uid());

-- BLOCKS
DROP POLICY IF EXISTS "blocks_manage_own" ON public.blocks;
CREATE POLICY "blocks_manage_own" ON public.blocks
  FOR ALL USING (blocker_id = auth.uid());

-- INVITES
DROP POLICY IF EXISTS "invites_select_member_or_valid_code" ON public.invites;
CREATE POLICY "invites_select_member_or_valid_code" ON public.invites
  FOR SELECT USING (
    server_id IN (SELECT server_id FROM public.server_members WHERE user_id = auth.uid())
    OR (expires_at IS NULL OR expires_at > NOW())
  );

DROP POLICY IF EXISTS "invites_insert_permission" ON public.invites;
CREATE POLICY "invites_insert_permission" ON public.invites
  FOR INSERT WITH CHECK (
    creator_id = auth.uid() AND
    public.user_has_permission(auth.uid(), server_id, 128) -- CREATE_INVITES
  );

DROP POLICY IF EXISTS "invites_delete_creator_or_manage" ON public.invites;
CREATE POLICY "invites_delete_creator_or_manage" ON public.invites
  FOR DELETE USING (
    creator_id = auth.uid() OR
    public.user_has_permission(auth.uid(), server_id, 2) -- MANAGE_SERVER
  );

-- NOTIFICATIONS
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL USING (user_id = auth.uid());

-- VOICE_STATES
DROP POLICY IF EXISTS "voice_states_select_member" ON public.voice_states;
CREATE POLICY "voice_states_select_member" ON public.voice_states
  FOR SELECT USING (public.can_view_channel(auth.uid(), channel_id));

DROP POLICY IF EXISTS "voice_states_manage_own" ON public.voice_states;
CREATE POLICY "voice_states_manage_own" ON public.voice_states
  FOR ALL USING (user_id = auth.uid());

-- WEBRTC_SIGNALS
DROP POLICY IF EXISTS "webrtc_signals_select_participant" ON public.webrtc_signals;
CREATE POLICY "webrtc_signals_select_participant" ON public.webrtc_signals
  FOR SELECT USING (from_user = auth.uid() OR to_user = auth.uid());

DROP POLICY IF EXISTS "webrtc_signals_insert_voice_participant" ON public.webrtc_signals;
CREATE POLICY "webrtc_signals_insert_voice_participant" ON public.webrtc_signals
  FOR INSERT WITH CHECK (
    from_user = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.voice_states vs_from
      JOIN public.voice_states vs_to ON vs_to.channel_id = vs_from.channel_id
      WHERE vs_from.channel_id = webrtc_signals.channel_id
        AND vs_from.user_id = auth.uid()
        AND vs_to.user_id = webrtc_signals.to_user
    )
  );

DROP POLICY IF EXISTS "webrtc_signals_delete_own" ON public.webrtc_signals;
CREATE POLICY "webrtc_signals_delete_own" ON public.webrtc_signals
  FOR DELETE USING (from_user = auth.uid() OR to_user = auth.uid());

-- ROLES
DROP POLICY IF EXISTS "roles_select_member" ON public.roles;
CREATE POLICY "roles_select_member" ON public.roles
  FOR SELECT USING (
    server_id IN (SELECT server_id FROM public.server_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "roles_manage_permission" ON public.roles;
CREATE POLICY "roles_manage_permission" ON public.roles
  FOR ALL USING (
    public.user_has_permission(auth.uid(), server_id, 8)
    AND public.can_manage_role(auth.uid(), id)
  );

-- ROLE_MEMBERS
DROP POLICY IF EXISTS "role_members_select_member" ON public.role_members;
CREATE POLICY "role_members_select_member" ON public.role_members
  FOR SELECT USING (
    role_id IN (
      SELECT r.id FROM public.roles r
      JOIN public.server_members sm ON sm.server_id = r.server_id
      WHERE sm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "role_members_manage_role" ON public.role_members;
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

-- SERVER_BANS
DROP POLICY IF EXISTS "server_bans_select_moderator" ON public.server_bans;
CREATE POLICY "server_bans_select_moderator" ON public.server_bans
  FOR SELECT USING (
    public.user_has_permission(auth.uid(), server_id, 64)
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "server_bans_manage_moderator" ON public.server_bans;
CREATE POLICY "server_bans_manage_moderator" ON public.server_bans
  FOR ALL USING (public.user_has_permission(auth.uid(), server_id, 64))
  WITH CHECK (public.user_has_permission(auth.uid(), server_id, 64));

-- RATE_LIMITS
DROP POLICY IF EXISTS "rate_limits_service_only" ON public.rate_limits;
CREATE POLICY "rate_limits_service_only" ON public.rate_limits
  FOR ALL USING (FALSE)
  WITH CHECK (FALSE);

-- APP_ADMINS
DROP POLICY IF EXISTS "app_admins_select_self_or_admin" ON public.app_admins;
CREATE POLICY "app_admins_select_self_or_admin" ON public.app_admins
  FOR SELECT USING (user_id = auth.uid() OR public.is_app_admin(auth.uid()));

DROP POLICY IF EXISTS "app_admins_no_client_writes" ON public.app_admins;
CREATE POLICY "app_admins_no_client_writes" ON public.app_admins
  FOR ALL USING (FALSE)
  WITH CHECK (FALSE);

-- CHANNEL_ROLE_PERMISSIONS
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

-- AUDIT_LOGS
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

-- DM_CALL_SIGNALS
DROP POLICY IF EXISTS "dm_call_signals_select_participant" ON public.dm_call_signals;
CREATE POLICY "dm_call_signals_select_participant" ON public.dm_call_signals
  FOR SELECT USING (from_user = auth.uid() OR to_user = auth.uid());

DROP POLICY IF EXISTS "dm_call_signals_insert_authenticated" ON public.dm_call_signals;
CREATE POLICY "dm_call_signals_insert_authenticated" ON public.dm_call_signals
  FOR INSERT WITH CHECK (from_user = auth.uid());

DROP POLICY IF EXISTS "dm_call_signals_delete_participant" ON public.dm_call_signals;
CREATE POLICY "dm_call_signals_delete_participant" ON public.dm_call_signals
  FOR DELETE USING (from_user = auth.uid() OR to_user = auth.uid());

-- DM_CALL_RINGS
DROP POLICY IF EXISTS "dm_call_rings_select_participant" ON public.dm_call_rings;
CREATE POLICY "dm_call_rings_select_participant" ON public.dm_call_rings
  FOR SELECT USING (caller_id = auth.uid() OR callee_id = auth.uid());

DROP POLICY IF EXISTS "dm_call_rings_insert_caller" ON public.dm_call_rings;
CREATE POLICY "dm_call_rings_insert_caller" ON public.dm_call_rings
  FOR INSERT WITH CHECK (caller_id = auth.uid());

DROP POLICY IF EXISTS "dm_call_rings_update_participant" ON public.dm_call_rings;
CREATE POLICY "dm_call_rings_update_participant" ON public.dm_call_rings
  FOR UPDATE USING (caller_id = auth.uid() OR callee_id = auth.uid());

DROP POLICY IF EXISTS "dm_call_rings_delete_participant" ON public.dm_call_rings;
CREATE POLICY "dm_call_rings_delete_participant" ON public.dm_call_rings
  FOR DELETE USING (caller_id = auth.uid() OR callee_id = auth.uid());

-- ============================================================
-- 5) STORAGE — buckets de avatars e icones de servidores
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own_folder" ON storage.objects;
CREATE POLICY "avatars_insert_own_folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "avatars_update_own_folder" ON storage.objects;
CREATE POLICY "avatars_update_own_folder" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "avatars_delete_own_folder" ON storage.objects;
CREATE POLICY "avatars_delete_own_folder" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'server-icons',
  'server-icons',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "server_icons_public_read" ON storage.objects;
CREATE POLICY "server_icons_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'server-icons');

DROP POLICY IF EXISTS "server_icons_owner_insert" ON storage.objects;
CREATE POLICY "server_icons_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'server-icons'
    AND EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id::TEXT = (storage.foldername(name))[1]
        AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "server_icons_owner_update" ON storage.objects;
CREATE POLICY "server_icons_owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'server-icons'
    AND EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id::TEXT = (storage.foldername(name))[1]
        AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'server-icons'
    AND EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id::TEXT = (storage.foldername(name))[1]
        AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "server_icons_owner_delete" ON storage.objects;
CREATE POLICY "server_icons_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'server-icons'
    AND EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id::TEXT = (storage.foldername(name))[1]
        AND s.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 6) INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_messages_channel_created
  ON public.messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_author
  ON public.messages (author_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to
  ON public.messages (reply_to) WHERE reply_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_server_members_server
  ON public.server_members (server_id);
CREATE INDEX IF NOT EXISTS idx_server_members_user
  ON public.server_members (user_id);

CREATE INDEX IF NOT EXISTS idx_channels_server
  ON public.channels (server_id, position);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friendships_requester
  ON public.friendships (requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_receiver
  ON public.friendships (receiver_id, status);

CREATE INDEX IF NOT EXISTS idx_direct_messages_channel_created
  ON public.direct_messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_channels_user1
  ON public.direct_message_channels (user1_id);
CREATE INDEX IF NOT EXISTS idx_dm_channels_user2
  ON public.direct_message_channels (user2_id);

CREATE INDEX IF NOT EXISTS idx_reactions_message
  ON public.message_reactions (message_id);

CREATE INDEX IF NOT EXISTS idx_voice_states_channel
  ON public.voice_states (channel_id);

CREATE INDEX IF NOT EXISTS idx_webrtc_signals_to_user
  ON public.webrtc_signals (to_user, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_channel
  ON public.webrtc_signals (channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_server_bans_server_user
  ON public.server_bans (server_id, user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_bucket_window
  ON public.rate_limits (user_id, bucket, window_start DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_server_created
  ON public.audit_logs (server_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dm_call_signals_room
  ON public.dm_call_signals (call_room, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_call_signals_to_user
  ON public.dm_call_signals (to_user, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dm_call_rings_callee
  ON public.dm_call_rings (callee_id, status, created_at DESC);

-- ============================================================
-- 7) REALTIME — publicacao com todas as tabelas
-- ============================================================

DROP PUBLICATION IF EXISTS supabase_realtime;

CREATE PUBLICATION supabase_realtime FOR TABLE
  public.messages,
  public.message_reactions,
  public.direct_messages,
  public.channels,
  public.server_members,
  public.voice_states,
  public.webrtc_signals,
  public.notifications,
  public.friendships,
  public.profiles,
  public.dm_call_signals,
  public.dm_call_rings,
  public.channel_role_permissions;