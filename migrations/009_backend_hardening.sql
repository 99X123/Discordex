-- ============================================================
-- 009_backend_hardening.sql
-- Guards de producao: bans, rate limit, RLS mais estrita,
-- notificacoes automaticas e RPCs sem confiar em IDs do cliente.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.server_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  banned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT CHECK (reason IS NULL OR LENGTH(reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (server_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
  UNIQUE (user_id, bucket, window_start)
);

ALTER TABLE public.server_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_server_bans_server_user ON public.server_bans (server_id, user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_bucket_window ON public.rate_limits (user_id, bucket, window_start DESC);

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

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

  IF NOT public.user_has_permission(NEW.author_id, v_server_id, 512) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  IF TG_OP = 'INSERT' AND NOT public.check_rate_limit('messages', 20, 60) THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS messages_assert_channel ON public.messages;
CREATE TRIGGER messages_assert_channel
  BEFORE INSERT OR UPDATE OF channel_id, author_id, content ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.assert_message_channel();

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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS voice_states_assert_channel ON public.voice_states;
CREATE TRIGGER voice_states_assert_channel
  BEFORE INSERT OR UPDATE OF channel_id, user_id ON public.voice_states
  FOR EACH ROW EXECUTE FUNCTION public.assert_voice_state();

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

DROP TRIGGER IF EXISTS messages_mentions_notify ON public.messages;
CREATE TRIGGER messages_mentions_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.create_mention_notifications();

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

DROP TRIGGER IF EXISTS direct_messages_notify ON public.direct_messages;
CREATE TRIGGER direct_messages_notify
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.create_dm_notification();

DROP FUNCTION IF EXISTS public.create_server_with_defaults(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.join_server_with_invite(TEXT, UUID);
DROP FUNCTION IF EXISTS public.kick_member(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.timeout_member(UUID, UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_or_create_dm_channel(UUID, UUID);

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

CREATE OR REPLACE FUNCTION public.kick_member(p_server_id UUID, p_target_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
BEGIN
  IF NOT public.user_has_permission(v_executor, p_server_id, 32) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para expulsar membros.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.servers WHERE id = p_server_id AND owner_id = p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_KICK_OWNER', 'message', 'Nao e possivel expulsar o proprietario do servidor.');
  END IF;

  DELETE FROM public.server_members WHERE server_id = p_server_id AND user_id = p_target_id;
  DELETE FROM public.voice_states WHERE user_id = p_target_id AND channel_id IN (SELECT id FROM public.channels WHERE server_id = p_server_id);
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
  IF NOT public.user_has_permission(v_executor, p_server_id, 32) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Permissao negada.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.servers WHERE id = p_server_id AND owner_id = p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_TIMEOUT_OWNER', 'message', 'Nao e possivel aplicar timeout no proprietario.');
  END IF;

  UPDATE public.server_members
  SET timeout_until = NOW() + (p_minutes || ' minutes')::INTERVAL
  WHERE server_id = p_server_id AND user_id = p_target_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

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

CREATE OR REPLACE FUNCTION public.ban_member(p_server_id UUID, p_target_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_executor UUID := public.current_user_id();
BEGIN
  IF NOT public.user_has_permission(v_executor, p_server_id, 64) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION_DENIED', 'message', 'Voce nao possui permissao para banir membros.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.servers WHERE id = p_server_id AND owner_id = p_target_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_BAN_OWNER', 'message', 'Nao e possivel banir o proprietario do servidor.');
  END IF;

  INSERT INTO public.server_bans (server_id, user_id, banned_by, reason)
  VALUES (p_server_id, p_target_id, v_executor, p_reason)
  ON CONFLICT (server_id, user_id) DO UPDATE SET banned_by = EXCLUDED.banned_by, reason = EXCLUDED.reason;
  DELETE FROM public.server_members WHERE server_id = p_server_id AND user_id = p_target_id;
  DELETE FROM public.voice_states WHERE user_id = p_target_id AND channel_id IN (SELECT id FROM public.channels WHERE server_id = p_server_id);
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP POLICY IF EXISTS "server_members_insert_self" ON public.server_members;
CREATE POLICY "server_members_insert_self_not_banned" ON public.server_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.server_bans b WHERE b.server_id = server_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "messages_insert_member" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
CREATE POLICY "messages_insert_member" ON public.messages
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.channels c
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE c.id = channel_id
        AND c.type = 'text'
        AND sm.user_id = auth.uid()
        AND (sm.timeout_until IS NULL OR sm.timeout_until < NOW())
        AND public.user_has_permission(auth.uid(), c.server_id, 512)
    )
  );

CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "direct_messages_insert_participant" ON public.direct_messages;
DROP POLICY IF EXISTS "direct_messages_update_own" ON public.direct_messages;
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

CREATE POLICY "direct_messages_update_own" ON public.direct_messages
  FOR UPDATE USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "invites_select_public" ON public.invites;
CREATE POLICY "invites_select_member_or_valid_code" ON public.invites
  FOR SELECT USING (
    server_id IN (SELECT server_id FROM public.server_members WHERE user_id = auth.uid())
    OR (expires_at IS NULL OR expires_at > NOW())
  );

DROP POLICY IF EXISTS "server_bans_select_moderator" ON public.server_bans;
DROP POLICY IF EXISTS "server_bans_manage_moderator" ON public.server_bans;
DROP POLICY IF EXISTS "rate_limits_service_only" ON public.rate_limits;

CREATE POLICY "server_bans_select_moderator" ON public.server_bans
  FOR SELECT USING (
    public.user_has_permission(auth.uid(), server_id, 64)
    OR user_id = auth.uid()
  );

CREATE POLICY "server_bans_manage_moderator" ON public.server_bans
  FOR ALL USING (public.user_has_permission(auth.uid(), server_id, 64))
  WITH CHECK (public.user_has_permission(auth.uid(), server_id, 64));

CREATE POLICY "rate_limits_service_only" ON public.rate_limits
  FOR ALL USING (FALSE)
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS "webrtc_signals_insert_authenticated" ON public.webrtc_signals;
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
