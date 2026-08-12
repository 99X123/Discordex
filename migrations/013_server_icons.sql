-- ============================================================
-- 013_server_icons.sql
-- Bucket publico para icones de servidores.
-- Leitura publica, escrita apenas pelo dono do servidor.
-- Path de upload: <server_id>/<arquivo>
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'server-icons',
  'server-icons',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "server_icons_public_read" ON storage.objects;
CREATE POLICY "server_icons_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'server-icons');

DROP POLICY IF EXISTS "server_icons_owner_insert" ON storage.objects;
CREATE POLICY "server_icons_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'server-icons'
    AND EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id::TEXT = (storage.foldername(name))[1]
        AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "server_icons_owner_update" ON storage.objects;
CREATE POLICY "server_icons_owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'server-icons'
    AND EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id::TEXT = (storage.foldername(name))[1]
        AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'server-icons'
    AND EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id::TEXT = (storage.foldername(name))[1]
        AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "server_icons_owner_delete" ON storage.objects;
CREATE POLICY "server_icons_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'server-icons'
    AND EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id::TEXT = (storage.foldername(name))[1]
        AND s.owner_id = auth.uid()
    )
  );
