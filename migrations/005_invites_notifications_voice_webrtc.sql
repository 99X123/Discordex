-- ============================================================
-- 005_invites.sql
-- Convites para servidores
-- ============================================================

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

-- ============================================================
-- 006_notifications.sql
-- Notificações do sistema
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('mention', 'dm', 'friend_request', 'invite', 'system')),
  reference_id UUID,
  data         JSONB,
  read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 007_voice_states.sql
-- Estado de participantes em canais de voz
-- ============================================================

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

-- ============================================================
-- 008_webrtc_signals.sql
-- Sinalização WebRTC (SDP + ICE candidates)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.webrtc_signals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  from_user   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('offer', 'answer', 'ice-candidate')),
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sinais são temporários — limpar automaticamente após 60 segundos
CREATE OR REPLACE FUNCTION public.clean_old_signals()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.webrtc_signals
  WHERE created_at < NOW() - INTERVAL '60 seconds';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
