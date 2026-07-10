CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text;
  _role  app_role;
BEGIN
  _email := LOWER(COALESCE(NEW.email, ''));

  IF _email IN ('rodrigomiranda@beyondcompany.com.br', 'filipe.moreira@beyondcompany.com.br') THEN
    _role := 'admin';
  ELSIF _email LIKE '%@beyondcompany.com.br'
     OR _email LIKE '%@extreme.digital'
     OR _email LIKE '%@volund.com.br' THEN
    _role := 'colaborador';
  ELSE
    _role := 'founder';
  END IF;

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',
             COALESCE(NEW.raw_user_meta_data->>'name', ''))
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  RETURN NEW;
END;
$function$;