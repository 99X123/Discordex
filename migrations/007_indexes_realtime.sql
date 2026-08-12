-- ============================================================
-- 007_indexes.sql
-- Índices para performance
-- ============================================================

-- Messages — listagem e paginação
CREATE INDEX IF NOT EXISTS idx_messages_channel_created
  ON public.messages (channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_author
  ON public.messages (author_id);

CREATE INDEX IF NOT EXISTS idx_messages_reply_to
  ON public.messages (reply_to) WHERE reply_to IS NOT NULL;

-- Server members
CREATE INDEX IF NOT EXISTS idx_server_members_server
  ON public.server_members (server_id);

CREATE INDEX IF NOT EXISTS idx_server_members_user
  ON public.server_members (user_id);

-- Channels
CREATE INDEX IF NOT EXISTS idx_channels_server
  ON public.channels (server_id, position);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read, created_at DESC);

-- Friendships
CREATE INDEX IF NOT EXISTS idx_friendships_requester
  ON public.friendships (requester_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_receiver
  ON public.friendships (receiver_id, status);

-- Direct messages
CREATE INDEX IF NOT EXISTS idx_direct_messages_channel_created
  ON public.direct_messages (channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dm_channels_user1
  ON public.direct_message_channels (user1_id);

CREATE INDEX IF NOT EXISTS idx_dm_channels_user2
  ON public.direct_message_channels (user2_id);

-- Reactions
CREATE INDEX IF NOT EXISTS idx_reactions_message
  ON public.message_reactions (message_id);

-- Voice states
CREATE INDEX IF NOT EXISTS idx_voice_states_channel
  ON public.voice_states (channel_id);

-- WebRTC signals
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_to_user
  ON public.webrtc_signals (to_user, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webrtc_signals_channel
  ON public.webrtc_signals (channel_id, created_at DESC);

-- ============================================================
-- 008_realtime.sql
-- Habilitar Realtime nas tabelas necessárias
-- (Execute também no Supabase Dashboard → Database → Replication)
-- ============================================================

-- Publicações para Realtime
BEGIN;
  -- Remove e recria a publicação para incluir todas as tabelas necessárias
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
    public.profiles;
COMMIT;
