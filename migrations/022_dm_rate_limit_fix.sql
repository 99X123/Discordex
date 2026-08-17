-- 022: get_or_create_dm_channel sem gastar rate limit em conversa existente.
-- O app chama essa funcao a cada abertura/reload/envio de DM; o limite
-- antigo (30/h) estourava no meio de uma conversa normal (400 RATE_LIMITED).
-- Agora o rate limit so e cobrado quando um canal NOVO precisa ser criado.

CREATE OR REPLACE FUNCTION public.get_or_create_dm_channel(p_other_user UUID)
RETURNS UUID AS $$
DECLARE
  v_current UUID := public.current_user_id();
  v_channel_id UUID;
  v_low UUID := LEAST(v_current, p_other_user);
  v_high UUID := GREATEST(v_current, p_other_user);
BEGIN
  IF v_current = p_other_user THEN
    RAISE EXCEPTION 'INVALID_DM_TARGET';
  END IF;
  IF public.is_blocked_between(v_current, p_other_user) THEN
    RAISE EXCEPTION 'USER_BLOCKED';
  END IF;

  SELECT id INTO v_channel_id
  FROM public.direct_message_channels
  WHERE user1_id = v_low AND user2_id = v_high;

  IF v_channel_id IS NULL THEN
    IF NOT public.check_rate_limit('create_dm', 30, 3600) THEN
      RAISE EXCEPTION 'RATE_LIMITED';
    END IF;

    INSERT INTO public.direct_message_channels (user1_id, user2_id)
    VALUES (v_low, v_high)
    ON CONFLICT (user1_id, user2_id) DO NOTHING
    RETURNING id INTO v_channel_id;

    IF v_channel_id IS NULL THEN
      SELECT id INTO v_channel_id
      FROM public.direct_message_channels
      WHERE user1_id = v_low AND user2_id = v_high;
    END IF;
  END IF;

  RETURN v_channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;