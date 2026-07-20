-- ============================================================================
-- 01 · AUTH / ROLES / PROFILES / SIGNUP HANDLER
-- ============================================================================
-- Consolida o efeito líquido de ~15 migrations legacy (série 20260309..20260625)
-- do domínio de identidade, incluindo:
--   • profiles + user_roles + has_role (base)                    — 20260309225339
--   • profiles.role como campo derivado (user_roles = SoT)       — 20260604120000 (T1.2)
--   • sync_user_role_to_profile + prevent_profile_role_change    — T1.2
--   • handle_new_user server-only, role via domínio de email     — 20260608_t1_3, 20260625121200
--   • GRANTs em profiles/user_roles; REVOKE anon                 — 20260623130150, 20260625121100
--   • enum app_role inclui 'viewer' desde a criação (C1 embutido)
--   • view role_audit_divergences com DISTINCT ON (C8 embutido)
--
-- Descartes deliberados:
--   • handle_new_user v0 (20260309225339) — confia em raw_user_meta_data['role']
--     enviado pelo cliente (permite auto-elevação a admin no signup). Insegura.
--   • prevent_profile_role_change v1 (20260506195721) — só bloqueava não-admins;
--     admins conseguiam contornar a fonte de verdade. Substituída pela v2 da T1.2
--     que usa pg_trigger_depth() para permitir só o cascade do sync trigger.
--   • ALTER PUBLICATION supabase_realtime ADD user_roles (T1.2) — a decisão
--     final do projeto é NÃO expor mudanças de role via Realtime (evita que
--     qualquer authenticated se inscreva em eventos de role de outros users).
--     O AuthContext no front espera reload/refresh, ver comentário em L76-79.
--   • Backfill "UPDATE user_roles SET role = role" da T1.2 — schema from scratch.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Enum app_role (com 'viewer' desde o início — C1 embutido)
-- origem: 20260309225339 (base 3 valores) + C1 20260710000100 (viewer)
-- ----------------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('founder', 'colaborador', 'admin', 'viewer');


-- ----------------------------------------------------------------------------
-- 2. Tabela profiles
-- origem: 20260309225339
-- Nota: profiles.role é campo DERIVADO da T1.2 em diante (write path
-- autoritativo = user_roles; sync trigger propaga; prevent trigger bloqueia
-- writes diretos). NOT NULL DEFAULT 'founder' preserva a compatibilidade com o
-- INSERT do handle_new_user que omite role (default preenche antes do sync).
-- ----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT        NOT NULL DEFAULT '',
  role       app_role    NOT NULL DEFAULT 'founder',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ----------------------------------------------------------------------------
-- 3. Tabela user_roles (fonte de verdade das roles)
-- origem: 20260309225339 + 20260604120000 (REPLICA IDENTITY FULL)
-- ----------------------------------------------------------------------------
CREATE TABLE public.user_roles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- REPLICA IDENTITY FULL: exigido por qualquer subscription Realtime com filtro
-- por coluna. Mesmo com user_roles FORA da publicação supabase_realtime hoje,
-- deixamos configurado para custo zero de mudança de decisão no futuro.
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;


-- ----------------------------------------------------------------------------
-- 4. has_role: função de autorização usada por TODA policy RLS que checa role
-- origem: 20260309225339
-- SECURITY DEFINER + STABLE — chamada dentro de policy precisa bypassar a
-- própria RLS de user_roles.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;


-- ----------------------------------------------------------------------------
-- 5. sync_user_role_to_profile: propaga user_roles.role → profiles.role
-- origem: 20260604120000 (T1.2)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_role_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET role = NEW.role
   WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_user_role_to_profile_trigger
  AFTER INSERT OR UPDATE OF role ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_role_to_profile();

REVOKE EXECUTE ON FUNCTION public.sync_user_role_to_profile() FROM anon, authenticated, public;


-- ----------------------------------------------------------------------------
-- 6. prevent_profile_role_change (endurecido via pg_trigger_depth)
-- origem: 20260604120000 (T1.2, versão endurecida)
-- Bloqueia QUALQUER escrita direta em profiles.role, inclusive de admin. Só
-- deixa passar quando o UPDATE veio via cascade do sync trigger (depth >= 2).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'profiles.role é somente-leitura — altere roles via a tabela user_roles.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_profile_role_change_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_change();

REVOKE EXECUTE ON FUNCTION public.prevent_profile_role_change() FROM anon, authenticated, public;


-- ----------------------------------------------------------------------------
-- 7. handle_new_user: signup handler server-side
-- origem: 20260625121200 (v4 final — corrige typo 'rodrigo.miranda@' com ponto)
-- Descarta v0..v3 (v0 aceitava role do cliente; v1..v3 tinham typo no email do
-- admin ou ainda gravavam role em profiles fora do modelo T1.2).
-- ----------------------------------------------------------------------------
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

  IF _email IN ('rodrigo.miranda@beyondcompany.com.br',
                'filipe.moreira@beyondcompany.com.br') THEN
    _role := 'admin';
  ELSIF _email LIKE '%@beyondcompany.com.br'
     OR _email LIKE '%@extreme.digital'
     OR _email LIKE '%@volund.com.br' THEN
    _role := 'colaborador';
  ELSE
    _role := 'founder';
  END IF;

  -- profiles: omite role. O DEFAULT 'founder' preenche temporariamente;
  -- sync_user_role_to_profile_trigger sobrescreve imediatamente após o
  -- INSERT em user_roles (mesma transação — nenhuma sessão vê o intermediário).
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',
             COALESCE(NEW.raw_user_meta_data->>'name', ''))
  );

  -- Única escrita autoritativa de role.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;


-- ----------------------------------------------------------------------------
-- 8. Policies RLS em profiles
-- origem: 20260309225339 (view/insert/update own), 20260506200800 (endurece
-- INSERT/UPDATE contra tampering em role), 20260506195721 (admin view all).
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'founder'::app_role
  );

-- role fica travado em defesa em profundidade além do trigger
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));


-- ----------------------------------------------------------------------------
-- 9. Policies RLS em user_roles
-- origem: 20260309225339 (SELECT own)
-- Nota: o front NUNCA escreve em user_roles pelo client (mudanças de role
-- rodam via Dashboard SQL editor / Edge Function com service_role), então
-- não há policies de INSERT/UPDATE/DELETE nem GRANT correspondente.
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 10. GRANTs / REVOKEs finais
-- origem: 20260623130150 (GRANTs), 20260625121100 (REVOKE anon)
-- Escritas em user_roles: só service_role. Cliente autenticado só lê a
-- própria linha (via policy).
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.profiles   TO authenticated;
GRANT ALL                    ON public.profiles   TO service_role;

GRANT SELECT                 ON public.user_roles TO authenticated;
GRANT ALL                    ON public.user_roles TO service_role;

REVOKE ALL ON public.profiles   FROM anon;
REVOKE ALL ON public.user_roles FROM anon;


-- ----------------------------------------------------------------------------
-- 11. View de auditoria role_audit_divergences (C8 embutido)
-- Identifica usuários cuja role atual DIVERGE da regra de domínio esperada
-- (por email). 'viewer' é atribuição manual legítima — excluído do filtro.
--
-- DISTINCT ON (u.id) + ORDER BY u.id, ur.role: user_roles tem UNIQUE(user_id,
-- role) mas não UNIQUE(user_id); um usuário com múltiplas roles atribuídas
-- apareceria duplicado sem o DISTINCT ON.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.role_audit_divergences AS
SELECT DISTINCT ON (u.id)
  u.id            AS user_id,
  u.email,
  ur.role         AS role_atual,
  CASE
    WHEN LOWER(u.email) IN (
      'rodrigo.miranda@beyondcompany.com.br',
      'filipe.moreira@beyondcompany.com.br'
    ) THEN 'admin'::public.app_role
    WHEN LOWER(u.email) LIKE '%@beyondcompany.com.br'
      OR LOWER(u.email) LIKE '%@extreme.digital'
      OR LOWER(u.email) LIKE '%@volund.com.br'
    THEN 'colaborador'::public.app_role
    ELSE 'founder'::public.app_role
  END             AS role_esperado_pela_regra,
  u.created_at
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.role IS DISTINCT FROM (
  CASE
    WHEN LOWER(u.email) IN (
      'rodrigo.miranda@beyondcompany.com.br',
      'filipe.moreira@beyondcompany.com.br'
    ) THEN 'admin'::public.app_role
    WHEN LOWER(u.email) LIKE '%@beyondcompany.com.br'
      OR LOWER(u.email) LIKE '%@extreme.digital'
      OR LOWER(u.email) LIKE '%@volund.com.br'
    THEN 'colaborador'::public.app_role
    ELSE 'founder'::public.app_role
  END
)
AND ur.role <> 'viewer'
ORDER BY u.id, ur.role;

-- View administrativa: só service_role/dashboard enxergam
REVOKE ALL ON public.role_audit_divergences FROM anon, authenticated;
