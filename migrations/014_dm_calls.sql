-- ============================================================
-- 014_dm_calls.sql
-- Chamadas privadas (DM) entre amigos.
-- Sinalizacao WebRTC para chamadas 1:1 sem depender de canais
-- de servidor. A presenca da chamada e controlada via Realtime
-- (presence) no cl�ente, e os sinais SDP/ICE sao trocados nesta
-- tabela usando uma chave deterministica da sala (`call_room`).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dm_call_signals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_room   TEXT NOT NULL,
  from_user   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('offer', 'answer', 'ice-candidate')),
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_call_signals_room
  ON public.dm_call_signals (call_room, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dm_call_signals_to_user
  ON public.dm_call_signals (to_user, created_at DESC);

ALTER TABLE public.dm_call_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm_call_signals_select_participant" ON public.dm_call_signals
  FOR SELECT USING (from_user = auth.uid() OR to_user = auth.uid());

CREATE POLICY "dm_call_signals_insert_authenticated" ON public.dm_call_signals
  FOR INSERT WITH CHECK (from_user = auth.uid());

CREATE POLICY "dm_call_signals_delete_participant" ON public.dm_call_signals
  FOR DELETE USING (from_user = auth.uid() OR to_user = auth.uid());

-- Sinais sao temporarios — limpar automaticamente apos 60 segundos
CREATE OR REPLACE FUNCTION public.clean_old_dm_signals()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.dm_call_signals
  WHERE created_at < NOW() - INTERVAL '60 seconds';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar Realtime para a nova tabela (publicacao configurada em 007)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'dm_call_signals'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_call_signals;
    END IF;
  END IF;
END $$;