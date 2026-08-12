-- ============================================================
-- 004_dms.sql
-- Mensagens Diretas (DMs) entre dois usuários
-- ============================================================

CREATE TABLE IF NOT EXISTS public.direct_message_channels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user1_id, user2_id),
  CHECK (user1_id < user2_id) -- Garante apenas 1 canal por par (menor UUID sempre em user1)
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

CREATE TRIGGER direct_messages_updated_at
  BEFORE UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Função para obter ou criar um canal DM entre dois usuários
CREATE OR REPLACE FUNCTION public.get_or_create_dm_channel(
  p_user1 UUID,
  p_user2 UUID
)
RETURNS UUID AS $$
DECLARE
  v_channel_id UUID;
  v_low  UUID := LEAST(p_user1, p_user2);
  v_high UUID := GREATEST(p_user1, p_user2);
BEGIN
  SELECT id INTO v_channel_id
  FROM public.direct_message_channels
  WHERE user1_id = v_low AND user2_id = v_high;

  IF v_channel_id IS NULL THEN
    INSERT INTO public.direct_message_channels (user1_id, user2_id)
    VALUES (v_low, v_high)
    RETURNING id INTO v_channel_id;
  END IF;

  RETURN v_channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 005_friendships.sql
-- Sistema de amizade entre usuários
-- ============================================================

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

CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 006_blocks.sql
-- Sistema de bloqueio de usuários
-- ============================================================

CREATE TABLE IF NOT EXISTS public.blocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
