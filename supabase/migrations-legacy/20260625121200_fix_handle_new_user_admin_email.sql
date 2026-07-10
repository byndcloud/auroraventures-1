-- Corrige typo no email do admin dentro de public.handle_new_user.
--
-- Antes (migration 20260608_t1_3_role_domain_server_only):
--   IF _email IN ('rodrigomiranda@beyondcompany.com.br', ...)
--                          ^ sem ponto
-- Email real em auth.users:
--   'rodrigo.miranda@beyondcompany.com.br'  (com ponto)
--
-- Impacto: signups novos com o email correto caíam no ELSIF do domínio
-- '%@beyondcompany.com.br' e ganhavam role 'colaborador' em vez de 'admin'.
-- O usuário existente já está com role=admin (ajustado em algum momento),
-- mas se a row for recriada (delete cascade, restore parcial, signup do
-- zero), perderia o acesso à policy "Admins can view all profiles" e
-- destravaria de novo o spinner infinito do ProtectedRoute.
--
-- Esta migration mantém todo o resto idêntico à versão anterior; muda
-- apenas o literal do email na cláusula IN.

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

  IF _email IN ('rodrigo.miranda@beyondcompany.com.br', 'filipe.moreira@beyondcompany.com.br') THEN
    _role := 'admin';
  ELSIF _email LIKE '%@beyondcompany.com.br'
     OR _email LIKE '%@extreme.digital'
     OR _email LIKE '%@volund.com.br' THEN
    _role := 'colaborador';
  ELSE
    _role := 'founder';
  END IF;

  -- profiles: omite role — DEFAULT 'founder' preenche temporariamente.
  -- sync_user_role_to_profile_trigger sobrescreve com o valor correto
  -- imediatamente após o INSERT em user_roles (mesma transação).
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',
             COALESCE(NEW.raw_user_meta_data->>'name', ''))
  );

  -- Única escrita autoritativa de role: user_roles é a fonte de verdade (T1.2).
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  RETURN NEW;
END;
$function$;
