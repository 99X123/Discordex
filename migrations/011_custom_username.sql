-- ============================================================
-- 011_custom_username.sql
-- Username unico escolhido pelo usuario no cadastro
-- (antes era sempre derivado do email, com sufixo numerico)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 0;
BEGIN
  -- Username base gerado do email (fallback)
  base_username := LOWER(SPLIT_PART(NEW.email, '@', 1));
  base_username := REGEXP_REPLACE(base_username, '[^a-z0-9_]', '_', 'g');

  -- Username escolhido pelo usuario (raw_user_meta_data->>'username')
  IF NEW.raw_user_meta_data->>'username' IS NOT NULL
     AND NEW.raw_user_meta_data->>'username' <> '' THEN

    final_username := LOWER(REGEXP_REPLACE(
      REGEXP_REPLACE(TRIM(NEW.raw_user_meta_data->>'username'), '\s+', '_', 'g'),
      '[^a-z0-9_]', '', 'g'
    ));

    -- Valida tamanho minimo; cai para o do email se invalido
    IF final_username IS NULL OR LENGTH(final_username) < 2 THEN
      final_username := base_username;
    END IF;

    -- Unicidade: falha o cadastro inteiro se o username ja existe
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) THEN
      RAISE EXCEPTION 'Username ja em uso: %', final_username;
    END IF;
  ELSE
    -- Fallback: gera do email garantindo unicidade (comportamento antigo)
    final_username := base_username;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
      counter := counter + 1;
      final_username := base_username || counter::TEXT;
    END LOOP;
  END IF;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), final_username),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;