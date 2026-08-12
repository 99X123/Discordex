-- ============================================================
-- 003_channels.sql
-- Canais de texto, voz e categorias
-- ============================================================

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

CREATE TRIGGER channels_updated_at
  BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 004_messages.sql
-- Mensagens de texto em canais (sem anexos)
-- ============================================================

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

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 005_reactions.sql
-- Reações emoji em mensagens
-- ============================================================

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL CHECK (LENGTH(emoji) BETWEEN 1 AND 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);
