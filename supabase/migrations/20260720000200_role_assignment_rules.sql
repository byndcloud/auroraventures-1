-- ============================================================================
-- Role assignment via tabela `role_assignment_rules`
-- ============================================================================
-- Substitui os e-mails/domínios hardcoded em `public.handle_new_user()` por
-- uma tabela seedável. Ganho: admin/viewer novos entram sem migration; a lista
-- vive em `scripts/seed-role-rules.ts` (idempotente).
--
-- Ordem de resolução (mesma do BLUEPRINT §3.4):
--   1. match_type='email'  (case-insensitive)  → pattern EXATO
--   2. match_type='domain' (case-insensitive)  → pattern após '@'
--   3. default 'founder'
--
-- `priority` ordena regras de mesmo `match_type` (menor = mais forte). Deixa
-- espaço para futuras exceções.
--
-- View `role_audit_divergences` (do 20260710000100) é atualizada para
-- consultar a mesma função de resolução — evita drift.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Tabela role_assignment_rules
-- ----------------------------------------------------------------------------
CREATE TABLE public.role_assignment_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_type  TEXT NOT NULL CHECK (match_type IN ('email','domain')),
  -- 'email': endereço completo (`fulano@empresa.com`)
  -- 'domain': domínio SEM '@' (`empresa.com`)
  pattern     TEXT NOT NULL,
  role        public.app_role NOT NULL,
  priority    INTEGER NOT NULL DEFAULT 100,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Pattern único por match_type (evita duas regras para o mesmo email/domain
  -- que causariam ordem indeterminada).
  UNIQUE (match_type, pattern)
);

COMMENT ON TABLE public.role_assignment_rules IS
  'Regras de atribuição de role no signup. Consultada por handle_new_user() e por role_audit_divergences.';
COMMENT ON COLUMN public.role_assignment_rules.match_type IS
  '"email" = casamento exato do endereço; "domain" = casamento do domínio (parte após @)';
COMMENT ON COLUMN public.role_assignment_rules.pattern IS
  'Endereço (email) ou domínio (domain), sempre em lowercase — comparação normalizada';
COMMENT ON COLUMN public.role_assignment_rules.priority IS
  'Menor = mais forte. Usado para desempate quando o padrão de email ambiguamente casa (raro).';

ALTER TABLE public.role_assignment_rules ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER role_assignment_rules_updated_at
  BEFORE UPDATE ON public.role_assignment_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para leitura ordenada por prioridade
CREATE INDEX role_assignment_rules_lookup_idx
  ON public.role_assignment_rules (match_type, priority, pattern);

-- Tabela administrativa: só service_role escreve. authenticated pode ler para
-- eventuais telas de configuração; anon nunca vê.
GRANT SELECT ON public.role_assignment_rules TO authenticated;
GRANT ALL    ON public.role_assignment_rules TO service_role;
REVOKE ALL   ON public.role_assignment_rules FROM anon;

-- Policy defensiva: só admin lê pelo client (mesmo tendo o GRANT). O RLS
-- garante que dev não exponha via chamada não autorizada por acidente.
CREATE POLICY "admin_read_role_assignment_rules"
  ON public.role_assignment_rules FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));


-- ----------------------------------------------------------------------------
-- 2. resolve_role_for_email(email)
-- Fonte única de resolução; SECURITY DEFINER para funcionar dentro de trigger.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_role_for_email(_email TEXT)
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _e        text := lower(coalesce(_email, ''));
  _domain   text;
  _result   public.app_role;
BEGIN
  IF _e = '' THEN
    RETURN 'founder'::public.app_role;
  END IF;

  -- 1) email exato
  SELECT role INTO _result
    FROM public.role_assignment_rules
   WHERE match_type = 'email' AND lower(pattern) = _e
   ORDER BY priority ASC
   LIMIT 1;
  IF _result IS NOT NULL THEN RETURN _result; END IF;

  -- 2) domínio
  _domain := split_part(_e, '@', 2);
  IF _domain <> '' THEN
    SELECT role INTO _result
      FROM public.role_assignment_rules
     WHERE match_type = 'domain' AND lower(pattern) = _domain
     ORDER BY priority ASC
     LIMIT 1;
    IF _result IS NOT NULL THEN RETURN _result; END IF;
  END IF;

  -- 3) default seguro
  RETURN 'founder'::public.app_role;
END;
$$;

COMMENT ON FUNCTION public.resolve_role_for_email(text) IS
  'Consulta role_assignment_rules: email exato → domínio → default "founder". Case-insensitive.';

REVOKE EXECUTE ON FUNCTION public.resolve_role_for_email(text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.resolve_role_for_email(text) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 3. handle_new_user() reescrita para usar resolve_role_for_email()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text;
  _role  public.app_role;
BEGIN
  _email := lower(coalesce(NEW.email, ''));
  _role  := public.resolve_role_for_email(_email);

  -- profiles: omite role. O DEFAULT 'founder' preenche temporariamente;
  -- sync_user_role_to_profile_trigger sobrescreve imediatamente após o
  -- INSERT em user_roles (mesma transação — nenhuma sessão vê o intermediário).
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

COMMENT ON FUNCTION public.handle_new_user() IS
  'Trigger AFTER INSERT auth.users: cria profile e user_role via resolve_role_for_email(). Sem hardcode.';


-- ----------------------------------------------------------------------------
-- 4. role_audit_divergences: alinhar com a nova função de resolução
-- ----------------------------------------------------------------------------
-- Recria a view usando resolve_role_for_email(), garantindo que auditoria e
-- signup falem a mesma linguagem (drift zero).
DROP VIEW IF EXISTS public.role_audit_divergences;

CREATE OR REPLACE VIEW public.role_audit_divergences AS
SELECT DISTINCT ON (u.id)
  u.id                                                  AS user_id,
  u.email,
  ur.role                                               AS role_atual,
  public.resolve_role_for_email(u.email)                AS role_esperado_pela_regra,
  u.created_at
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.role IS DISTINCT FROM public.resolve_role_for_email(u.email)
  AND ur.role <> 'viewer'
ORDER BY u.id, ur.role;

REVOKE ALL ON public.role_audit_divergences FROM anon, authenticated;


-- ----------------------------------------------------------------------------
-- 5. Seed inicial IDEMPOTENTE
-- ----------------------------------------------------------------------------
-- Migra os hardcodes originais do handle_new_user (rodrigo/filipe + domínios
-- beyondcompany/extreme/volund) para a tabela. Novos admins/viewers entram
-- por `scripts/seed-role-rules.ts` sem migration nova.
--
-- Liliane já entra aqui via seed migration porque a task pediu explicitamente.
INSERT INTO public.role_assignment_rules (match_type, pattern, role, priority, note)
VALUES
  ('email',  'rodrigo.miranda@beyondcompany.com.br', 'admin',       10, 'seed inicial'),
  ('email',  'filipe.moreira@beyondcompany.com.br',  'admin',       10, 'seed inicial'),
  ('email',  'liliane.oliveira@beyondcompany.com.br','admin',       10, 'seed inicial'),
  ('domain', 'beyondcompany.com.br',                 'colaborador', 100, 'seed inicial'),
  ('domain', 'extreme.digital',                      'colaborador', 100, 'seed inicial'),
  ('domain', 'volund.com.br',                        'colaborador', 100, 'seed inicial')
ON CONFLICT (match_type, pattern) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 6. Reconciliação de usuários existentes
-- ----------------------------------------------------------------------------
-- Se algum usuário já cadastrado hoje é `colaborador` mas passou a bater uma
-- regra `admin` ou `viewer` (ex.: Liliane), ajusta imediatamente para não
-- deixar drift. NUNCA rebaixa: rebaixar via migration é destrutivo — só
-- promove (admin/viewer) e retira roles conflitantes na promoção.
DO $$
DECLARE
  r RECORD;
  _expected public.app_role;
BEGIN
  FOR r IN
    SELECT u.id AS user_id, u.email, ur.role AS current_role
      FROM auth.users u
      JOIN public.user_roles ur ON ur.user_id = u.id
     WHERE ur.role <> 'viewer'  -- viewer manual é intencional; nunca sobrescrever
  LOOP
    _expected := public.resolve_role_for_email(r.email);
    -- Só promove para admin ou viewer (não rebaixa colaborador → founder etc.)
    IF _expected IN ('admin','viewer') AND r.current_role <> _expected THEN
      -- Adiciona a role esperada (idempotente via UNIQUE)
      INSERT INTO public.user_roles (user_id, role)
      VALUES (r.user_id, _expected)
      ON CONFLICT (user_id, role) DO NOTHING;
      -- Remove a role antiga divergente (garante uma role por usuário — o front
      -- lê a primeira via `.limit(1)` no AuthContext)
      DELETE FROM public.user_roles
       WHERE user_id = r.user_id
         AND role = r.current_role
         AND r.current_role <> _expected;
      RAISE NOTICE 'Promovido user % (%) de % para %', r.user_id, r.email, r.current_role, _expected;
    END IF;
  END LOOP;
END $$;


-- ============================================================================
-- Rollback (referência):
--   DROP VIEW  IF EXISTS public.role_audit_divergences;
--   -- Recriar a view do 20260710000100 (versão hardcoded).
--   CREATE OR REPLACE FUNCTION public.handle_new_user() ...  -- v4 hardcoded
--   DROP FUNCTION IF EXISTS public.resolve_role_for_email(text);
--   DROP TABLE IF EXISTS public.role_assignment_rules;
-- ============================================================================
