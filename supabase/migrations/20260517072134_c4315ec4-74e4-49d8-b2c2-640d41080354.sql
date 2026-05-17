ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS termos_aceitos_em timestamptz,
  ADD COLUMN IF NOT EXISTS termos_versao text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_aceite_iso text;
  v_aceite timestamptz;
BEGIN
  v_aceite_iso := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'termos_aceitos_em', '')), '');
  BEGIN
    v_aceite := v_aceite_iso::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    v_aceite := NULL;
  END;
  INSERT INTO public.profiles (user_id, email, usuario_plano, nome_usuario, termos_aceitos_em, termos_versao)
  VALUES (
    NEW.id,
    NEW.email,
    'FREE',
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'nome_usuario', '')), ''),
    v_aceite,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'termos_versao', '')), '')
  );
  RETURN NEW;
END;
$function$;