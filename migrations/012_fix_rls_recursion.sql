-- ============================================================
-- 012_fix_rls_recursion.sql
-- Corrige a politica recursiva em server_members que causava
-- HTTP 500 no PostgREST ("infinite recursion detected in policy
-- for relation server_members").
--
-- A politica antiga referenciava public.server_members dentro da
-- propria politica, recursando infinitamente em qualquer SELECT
-- que tocasse em server_members (direto via join em servers, ou
-- indireto via policies de channels/voice_states).
--
-- Substitui pela funcao SECURITY DEFINER is_server_member(), que
-- ignora RLS e elimina a recursao.
-- ============================================================

DROP POLICY IF EXISTS "server_members_select_member" ON public.server_members;

CREATE POLICY "server_members_select_member" ON public.server_members
  FOR SELECT USING (
    public.is_server_member(auth.uid(), server_id)
  );
