-- ============================================================================
-- 05 · OPEN CALLS (chamadas / editais)
-- ============================================================================
-- Consolida:
--   • calls / call_fields / call_responses base — 20260312134433
--   • Deadline nas policies public_read_active_calls e public_read_call_fields
--     — 20260312150821
--   • authenticated_read_calls (respeita deadline OU quem já respondeu) — 20260312170358
--   • authenticated_read_call_fields — 20260312170802
--   • CHECKs T3.2 em call_type, visibility, status — 20260608_t3_2
--   • C1 embutido: status inclui 'rascunho' desde a criação (UI de admin
--     precisa salvar chamada em rascunho antes de publicar)
--
-- C6 (fix de calls.created_by legado): em schema from scratch, o front atual
-- já grava auth.uid() em created_by — não há dados legados com profiles.id.
-- O UPDATE de C6 se torna NO-OP; documentado no comentário abaixo.
--
-- Pré-requisitos: has_role(), update_updated_at_column(), app_role enum.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Tabela calls
-- ----------------------------------------------------------------------------
CREATE TABLE public.calls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  vertical    TEXT,
  call_type   TEXT NOT NULL DEFAULT 'mercado',
  visibility  TEXT NOT NULL DEFAULT 'publica',
  status      TEXT NOT NULL DEFAULT 'ativa',
  deadline    DATE,
  -- created_by referencia auth.users. C6 legado corrigia dados antigos que
  -- gravavam profiles.id aqui — front atual já grava auth.uid(), portanto
  -- em schema from scratch não há correção a fazer.
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_calls_call_type
    CHECK (call_type IN ('mercado', 'interno')),

  CONSTRAINT chk_calls_visibility
    CHECK (visibility IN ('publica', 'privada')),

  -- C1 embutido: 'rascunho' desde a criação. Sem essa opção, ChamadaForm
  -- (admin) estourava a constraint ao tentar salvar rascunho.
  CONSTRAINT chk_calls_status
    CHECK (status IN ('rascunho', 'ativa', 'encerrada'))
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ----------------------------------------------------------------------------
-- 2. Tabela call_fields (campos dinâmicos do formulário de resposta)
-- ----------------------------------------------------------------------------
CREATE TABLE public.call_fields (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id       UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  field_type    TEXT NOT NULL DEFAULT 'text',
  label         TEXT NOT NULL,
  placeholder   TEXT,
  required      BOOLEAN NOT NULL DEFAULT false,
  options       JSONB,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.call_fields ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 3. Tabela call_responses
-- ----------------------------------------------------------------------------
CREATE TABLE public.call_responses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id          UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  respondent_email TEXT,
  response_data    JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.call_responses ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 4. Policies RLS — calls
-- ----------------------------------------------------------------------------

CREATE POLICY "admin_manage_calls"
  ON public.calls FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Público (sem login) lê chamadas ativas, públicas e dentro do deadline
CREATE POLICY "public_read_active_calls"
  ON public.calls FOR SELECT TO public
  USING (
    status = 'ativa'
    AND visibility = 'publica'
    AND (deadline IS NULL OR deadline >= CURRENT_DATE)
  );

-- Authenticated: além do público, também vê chamadas às quais já respondeu.
-- Cobre o caso de chamada encerrada ou privada onde o usuário precisa
-- consultar a própria resposta.
CREATE POLICY "authenticated_read_calls"
  ON public.calls FOR SELECT TO authenticated
  USING (
    (status = 'ativa' AND (deadline IS NULL OR deadline >= CURRENT_DATE))
    OR (id IN (SELECT call_id FROM public.call_responses WHERE user_id = auth.uid()))
  );


-- ----------------------------------------------------------------------------
-- 5. Policies RLS — call_fields
-- ----------------------------------------------------------------------------

CREATE POLICY "admin_manage_call_fields"
  ON public.call_fields FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "public_read_call_fields"
  ON public.call_fields FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.calls
      WHERE calls.id = call_fields.call_id
        AND calls.status = 'ativa'
        AND (calls.deadline IS NULL OR calls.deadline >= CURRENT_DATE)
    )
  );

CREATE POLICY "authenticated_read_call_fields"
  ON public.call_fields FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calls
      WHERE calls.id = call_fields.call_id
        AND calls.status = 'ativa'
        AND (calls.deadline IS NULL OR calls.deadline >= CURRENT_DATE)
    )
  );


-- ----------------------------------------------------------------------------
-- 6. Policies RLS — call_responses
-- ----------------------------------------------------------------------------

CREATE POLICY "admin_manage_call_responses"
  ON public.call_responses FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "authenticated_insert_responses"
  ON public.call_responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_read_own_responses"
  ON public.call_responses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 7. GRANTs / REVOKEs
-- ----------------------------------------------------------------------------

-- calls: público (anon) SELECT via policy public_read_active_calls
GRANT SELECT                         ON public.calls          TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls          TO authenticated;
GRANT ALL                            ON public.calls          TO service_role;

-- call_fields: público (anon) SELECT via policy public_read_call_fields
GRANT SELECT                         ON public.call_fields    TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_fields    TO authenticated;
GRANT ALL                            ON public.call_fields    TO service_role;

-- call_responses: nunca anon (respostas exigem auth.uid())
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_responses TO authenticated;
GRANT ALL                            ON public.call_responses TO service_role;

REVOKE ALL ON public.call_responses FROM anon;
