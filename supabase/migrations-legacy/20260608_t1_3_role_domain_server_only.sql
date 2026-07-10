-- T1.3 — handle_new_user: domain→role via user_roles only (single write path)
--
-- Diagnóstico:
--   O handle_new_user atual (migration 20260428) insere role diretamente em AMBAS
--   as tabelas: profiles e user_roles. Com a T1.2 em vigor, profiles.role é campo
--   derivado (somente-leitura via prevent_profile_role_change) e user_roles é a
--   fonte de verdade. O INSERT direto em profiles.role contorna esse modelo.
--
-- Solução:
--   Reescrever handle_new_user para inserir role APENAS em user_roles.
--   O sync_user_role_to_profile_trigger (T1.2) propaga para profiles.role dentro
--   da mesma transação — nenhuma outra sessão vê o estado intermediário.
--
-- Cadeia de triggers em um signup:
--   on_auth_user_created (depth=1)
--     → handle_new_user: INSERT profiles (sem role, usa DEFAULT 'founder')
--     → handle_new_user: INSERT user_roles (role correto por domínio)
--       → sync_user_role_to_profile_trigger (depth=2): UPDATE profiles SET role
--         → prevent_profile_role_change (depth=3): depth >= 2 → permitido ✓
--
-- Sem mudança de schema: profiles.role já tem NOT NULL DEFAULT 'founder'.

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
