-- ============================================================
-- 021_presence_realtime.sql
-- 1) Presenca: coluna last_seen_at em profiles para saber quem
--    esta online de verdade (heartbeat a cada 30s enquanto o
--    site esta aberto; offline = sumiu por mais de 2 minutos).
-- 2) Realtime: inclui roles, role_members, servers e server_bans
--    na publicacao supabase_realtime para que mudanca de cargo,
--    kick/ban e edicao de servidor aparecam sem F5.
-- 3) Admin stats passa a contar online de verdade (last_seen_at).
-- ============================================================

-- ------------------------------------------------------------------
-- last_seen_at
-- ------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON public.profiles (last_seen_at DESC);

-- ------------------------------------------------------------------
-- Realtime: tabelas faltantes na publicacao
-- ------------------------------------------------------------------
BEGIN;
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.roles;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.role_members;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.servers;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.server_bans;
  END IF;
COMMIT;

-- ------------------------------------------------------------------
-- Admin stats: online = last_seen_at nos ultimos 2 minutos
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT jsonb_build_object(
    'total_users',       (SELECT COUNT(*) FROM public.profiles),
    'online_users',      (SELECT COUNT(*) FROM public.profiles WHERE last_seen_at > now() - interval '2 minutes'),
    'total_servers',     (SELECT COUNT(*) FROM public.servers),
    'total_channels',    (SELECT COUNT(*) FROM public.channels),
    'total_messages',    (SELECT COUNT(*) FROM public.messages),
    'total_dm_messages', (SELECT COUNT(*) FROM public.direct_messages),
    'total_friendships', (SELECT COUNT(*) FROM public.friendships WHERE status = 'accepted'),
    'active_voice',      (SELECT COUNT(*) FROM public.voice_states),
    'total_calls',       (SELECT COUNT(*) FROM public.dm_call_rings)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
