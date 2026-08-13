-- ============================================================
-- 019_profile_banners.sql
-- Banner de perfil do usuario via Supabase Storage.
-- Adiciona banner_url em public.profiles e um bucket publico
-- com escrita limitada ao proprio usuario (mesmo padrao do
-- bucket de avatars).
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS banner_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "banners_public_read" ON storage.objects;
CREATE POLICY "banners_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "banners_insert_own_folder" ON storage.objects;
CREATE POLICY "banners_insert_own_folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'banners'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "banners_update_own_folder" ON storage.objects;
CREATE POLICY "banners_update_own_folder" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'banners'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'banners'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "banners_delete_own_folder" ON storage.objects;
CREATE POLICY "banners_delete_own_folder" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'banners'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );