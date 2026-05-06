ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome_usuario text;
ALTER TABLE public.profiles ADD CONSTRAINT nome_usuario_max_len CHECK (nome_usuario IS NULL OR char_length(nome_usuario) <= 30);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, usuario_plano, nome_usuario)
  VALUES (
    NEW.id,
    NEW.email,
    'FREE',
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'nome_usuario', '')), '')
  );
  RETURN NEW;
END;
$function$;