-- ============================================================
-- 006_rls_policies.sql
-- Row Level Security — todas as políticas de segurança
-- ============================================================

-- Habilita RLS em todas as tabelas
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

-- ============================================================
-- PROFILES
-- ============================================================
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT USING (TRUE); -- Todos podem ver perfis públicos

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- SERVERS
-- ============================================================
CREATE POLICY "servers_select_member" ON public.servers
  FOR SELECT USING (
    id IN (SELECT server_id FROM public.server_members WHERE user_id = auth.uid())
  );

CREATE POLICY "servers_insert_authenticated" ON public.servers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "servers_update_owner" ON public.servers
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "servers_delete_owner" ON public.servers
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================================
-- SERVER_MEMBERS
-- ============================================================
CREATE POLICY "server_members_select_member" ON public.server_members
  FOR SELECT USING (
    server_id IN (SELECT server_id FROM public.server_members WHERE user_id = auth.uid())
  );

CREATE POLICY "server_members_insert_self" ON public.server_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "server_members_delete_self" ON public.server_members
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- CHANNELS
-- ============================================================
CREATE POLICY "channels_select_member" ON public.channels
  FOR SELECT USING (
    server_id IN (SELECT server_id FROM public.server_members WHERE user_id = auth.uid())
  );

CREATE POLICY "channels_manage_permission" ON public.channels
  FOR ALL USING (
    public.user_has_permission(auth.uid(), server_id, 4) -- MANAGE_CHANNELS
  );

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE POLICY "messages_select_member" ON public.messages
  FOR SELECT USING (
    channel_id IN (
      SELECT c.id FROM public.channels c
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE sm.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_insert_member" ON public.messages
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND
    channel_id IN (
      SELECT c.id FROM public.channels c
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE sm.user_id = auth.uid()
        AND sm.timeout_until IS NULL OR sm.timeout_until < NOW()
    )
  );

CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY "messages_delete_own_or_manage" ON public.messages
  FOR DELETE USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_id
        AND public.user_has_permission(auth.uid(), c.server_id, 16) -- MANAGE_MESSAGES
    )
  );

-- ============================================================
-- MESSAGE_REACTIONS
-- ============================================================
CREATE POLICY "reactions_select_member" ON public.message_reactions
  FOR SELECT USING (
    message_id IN (
      SELECT m.id FROM public.messages m
      JOIN public.channels c ON c.id = m.channel_id
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE sm.user_id = auth.uid()
    )
  );

CREATE POLICY "reactions_manage_own" ON public.message_reactions
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- DIRECT MESSAGES
-- ============================================================
CREATE POLICY "dm_channels_select_participant" ON public.direct_message_channels
  FOR SELECT USING (user1_id = auth.uid() OR user2_id = auth.uid());

CREATE POLICY "dm_channels_insert_authenticated" ON public.direct_message_channels
  FOR INSERT WITH CHECK (
    (user1_id = auth.uid() OR user2_id = auth.uid()) AND
    -- Bloqueia se o outro usuário bloqueou quem está inserindo
    NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = user1_id AND b.blocked_id = auth.uid())
         OR (b.blocker_id = user2_id AND b.blocked_id = auth.uid())
    )
  );

CREATE POLICY "direct_messages_select_participant" ON public.direct_messages
  FOR SELECT USING (
    channel_id IN (
      SELECT id FROM public.direct_message_channels
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

CREATE POLICY "direct_messages_insert_participant" ON public.direct_messages
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND
    channel_id IN (
      SELECT id FROM public.direct_message_channels
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

CREATE POLICY "direct_messages_update_own" ON public.direct_messages
  FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY "direct_messages_delete_own" ON public.direct_messages
  FOR DELETE USING (author_id = auth.uid());

-- ============================================================
-- FRIENDSHIPS
-- ============================================================
CREATE POLICY "friendships_select_participant" ON public.friendships
  FOR SELECT USING (requester_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "friendships_insert_requester" ON public.friendships
  FOR INSERT WITH CHECK (requester_id = auth.uid());

CREATE POLICY "friendships_update_participant" ON public.friendships
  FOR UPDATE USING (requester_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "friendships_delete_participant" ON public.friendships
  FOR DELETE USING (requester_id = auth.uid() OR receiver_id = auth.uid());

-- ============================================================
-- BLOCKS
-- ============================================================
CREATE POLICY "blocks_manage_own" ON public.blocks
  FOR ALL USING (blocker_id = auth.uid());

-- ============================================================
-- INVITES
-- ============================================================
CREATE POLICY "invites_select_public" ON public.invites
  FOR SELECT USING (
    -- Membros do servidor ou qualquer um com o código
    server_id IN (SELECT server_id FROM public.server_members WHERE user_id = auth.uid())
    OR TRUE -- Permitir leitura pelo código (filtragem feita pela aplicação)
  );

CREATE POLICY "invites_insert_permission" ON public.invites
  FOR INSERT WITH CHECK (
    creator_id = auth.uid() AND
    public.user_has_permission(auth.uid(), server_id, 128) -- CREATE_INVITES
  );

CREATE POLICY "invites_delete_creator_or_manage" ON public.invites
  FOR DELETE USING (
    creator_id = auth.uid() OR
    public.user_has_permission(auth.uid(), server_id, 2) -- MANAGE_SERVER
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- VOICE_STATES
-- ============================================================
CREATE POLICY "voice_states_select_member" ON public.voice_states
  FOR SELECT USING (
    channel_id IN (
      SELECT c.id FROM public.channels c
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE sm.user_id = auth.uid()
    )
  );

CREATE POLICY "voice_states_manage_own" ON public.voice_states
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- WEBRTC_SIGNALS
-- ============================================================
CREATE POLICY "webrtc_signals_select_participant" ON public.webrtc_signals
  FOR SELECT USING (from_user = auth.uid() OR to_user = auth.uid());

CREATE POLICY "webrtc_signals_insert_authenticated" ON public.webrtc_signals
  FOR INSERT WITH CHECK (from_user = auth.uid());

CREATE POLICY "webrtc_signals_delete_own" ON public.webrtc_signals
  FOR DELETE USING (from_user = auth.uid() OR to_user = auth.uid());

-- ============================================================
-- ROLES
-- ============================================================
CREATE POLICY "roles_select_member" ON public.roles
  FOR SELECT USING (
    server_id IN (SELECT server_id FROM public.server_members WHERE user_id = auth.uid())
  );

CREATE POLICY "roles_manage_permission" ON public.roles
  FOR ALL USING (
    public.user_has_permission(auth.uid(), server_id, 8) -- MANAGE_ROLES
  );

CREATE POLICY "role_members_select_member" ON public.role_members
  FOR SELECT USING (
    role_id IN (
      SELECT r.id FROM public.roles r
      JOIN public.server_members sm ON sm.server_id = r.server_id
      WHERE sm.user_id = auth.uid()
    )
  );

CREATE POLICY "role_members_manage_permission" ON public.role_members
  FOR ALL USING (
    role_id IN (
      SELECT r.id FROM public.roles r
      WHERE public.user_has_permission(auth.uid(), r.server_id, 8) -- MANAGE_ROLES
    )
  );
