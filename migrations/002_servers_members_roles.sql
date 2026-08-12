-- ============================================================
-- 002_servers.sql
-- Servidores (comunidades) do Discordex
-- ============================================================

CREATE TABLE IF NOT EXISTS public.servers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (LENGTH(name) BETWEEN 2 AND 100),
  description TEXT,
  icon_url    TEXT,
  owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER servers_updated_at
  BEFORE UPDATE ON public.servers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 003_server_members.sql
-- Membros de cada servidor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.server_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id     UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nickname      TEXT,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  timeout_until TIMESTAMPTZ,
  UNIQUE (server_id, user_id)
);

-- ============================================================
-- 004_roles.sql
-- Cargos e permissões dentro de um servidor
-- ============================================================

-- Permissões como bitmask (bigint)
-- Bits:
-- 1  = ADMINISTRATOR
-- 2  = MANAGE_SERVER
-- 4  = MANAGE_CHANNELS
-- 8  = MANAGE_ROLES
-- 16 = MANAGE_MESSAGES
-- 32 = KICK_MEMBERS
-- 64 = BAN_MEMBERS
-- 128 = CREATE_INVITES
-- 256 = VIEW_CHANNELS
-- 512 = SEND_MESSAGES
-- 1024 = CONNECT
-- 2048 = SPEAK
-- 4096 = VIDEO
-- 8192 = SCREEN_SHARE

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

-- Função helper para verificar permissão de um usuário
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
  -- Verifica se é dono
  SELECT owner_id INTO v_owner_id FROM public.servers WHERE id = p_server_id;
  IF v_owner_id = p_user_id THEN RETURN TRUE; END IF;

  -- Soma permissões de todos os cargos do usuário no servidor
  SELECT COALESCE(BIT_OR(r.permissions), 0)
  INTO v_combined
  FROM public.role_members rm
  JOIN public.roles r ON r.id = rm.role_id
  WHERE rm.user_id = p_user_id
    AND r.server_id = p_server_id;

  -- Verifica bit ADMINISTRATOR (1)
  IF (v_combined & 1) = 1 THEN RETURN TRUE; END IF;

  -- Verifica permissão específica
  RETURN (v_combined & p_permission) = p_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
