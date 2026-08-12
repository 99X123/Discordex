-- ============================================================
-- 015_dm_call_rings.sql
-- Toques de chamada privada (DM).
-- Permite que o destinatario veja/aceite/rejeite uma chamada
-- iniciada por um amigo, mesmo sem estar dentro de uma sala.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dm_call_rings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_room   TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('voice', 'video')),
  status      TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'accepted', 'declined')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_call_rings_callee
  ON public.dm_call_rings (callee_id, status, created_at DESC);

ALTER TABLE public.dm_call_rings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm_call_rings_select_participant" ON public.dm_call_rings
  FOR SELECT USING (caller_id = auth.uid() OR callee_id = auth.uid());

CREATE POLICY "dm_call_rings_insert_caller" ON public.dm_call_rings
  FOR INSERT WITH CHECK (caller_id = auth.uid());

CREATE POLICY "dm_call_rings_update_participant" ON public.dm_call_rings
  FOR UPDATE USING (caller_id = auth.uid() OR callee_id = auth.uid());

CREATE POLICY "dm_call_rings_delete_participant" ON public.dm_call_rings
  FOR DELETE USING (caller_id = auth.uid() OR callee_id = auth.uid());

-- Habilitar Realtime para a nova tabela (publicacao configurada em 007)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'dm_call_rings'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_call_rings;
    END IF;
  END IF;
END $$;