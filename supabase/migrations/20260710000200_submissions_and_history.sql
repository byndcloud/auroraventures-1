-- ============================================================================
-- 02 · SUBMISSIONS + SUBMISSION_HISTORY (kanban)
-- ============================================================================
-- Consolida:
--   • Base submissions + policies "próprias" — 20260309225339
--   • Admin update/delete — 20260309231810, 20260311140736
--   • DEFAULT status = 'Submissões' — 20260312193419
--   • ADD COLUMN briefing — 20260317174816
--   • ADD COLUMN due_date — 20260323174059
--   • INSERT com escape-hatch type='mercado' — 20260528173343
--   • Colaborador SELECT tudo — 20260608_xmpvas0he
--   • chk_submission_status com as 7 fases — 20260608_t3_2
--   • Viewer SELECT (C2 embutido)
--   • submission_history base — 20260311121831
--   • Insert policy admin+colaborador — 20260317213140
--   • Colaborador SELECT + viewer SELECT (C3 embutido)
--
-- Descartes:
--   • colaborador_update_submissions (20260317174816): o legado dava UPDATE
--     amplo pra colaborador, mas o front atual só edita submissions em rotas
--     admin-only (Admin.tsx kanban drag/drop, ScorecardForm). Colaborador em
--     /iniciativa/:id renderiza briefing como read-only (ver comment no
--     código: "Briefing (read-only on this page; edited from Kanban panel)").
--   • authenticated_can_insert_history (20260311121831): já dropada por
--     20260317213140, substituída pela admin_colaborador_insert_history.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Tabela submissions
-- ----------------------------------------------------------------------------
CREATE TABLE public.submissions (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL,
  project_name TEXT        NOT NULL DEFAULT '',
  status       TEXT        NOT NULL DEFAULT 'Submissões',
  data         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  briefing     TEXT,
  due_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_submission_type
    CHECK (type IN ('mercado', 'interna', 'editais')),

  -- As 7 fases do kanban. Strings exatas (case-sensitive) — devem bater com
  -- KANBAN_PHASES em src/lib/kanban.ts. Alterar aqui exige atualizar o front.
  CONSTRAINT chk_submission_status
    CHECK (status IN (
      'Discovery & Pitch',
      'Submissões',
      'Screening',
      'Proposta',
      'Ongoing',
      'Handover',
      'Despriorizado'
    ))
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ----------------------------------------------------------------------------
-- 2. Tabela submission_history
-- moved_by permanece SEM FK — fidelidade ao legado (linhas históricas devem
-- persistir mesmo se o auth.users original for deletado). Se um dia isso mudar,
-- padrão é FK + ON DELETE SET NULL + DROP NOT NULL.
-- ----------------------------------------------------------------------------
CREATE TABLE public.submission_history (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID        NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  from_status   TEXT,
  to_status     TEXT        NOT NULL,
  moved_by      UUID        NOT NULL,
  moved_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.submission_history ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 3. Policies RLS — submissions
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can view their own submissions"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: founder só pode criar type='mercado' (submissão externa); colaborador
-- e admin criam qualquer tipo (interna, editais, mercado). Fidelidade ao legado
-- 20260528173343.
CREATE POLICY "Users can create their own submissions"
  ON public.submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      type = 'mercado'
      OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

CREATE POLICY "Users can update their own submissions"
  ON public.submissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Consolidação das 3 policies admin do legado (view/update/delete) num único FOR ALL
CREATE POLICY "admin_manage_all_submissions"
  ON public.submissions FOR ALL
  TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "colaborador_view_all_submissions"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'colaborador'::public.app_role));

-- C2 embutido
CREATE POLICY "viewer_view_all_submissions"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'::public.app_role));


-- ----------------------------------------------------------------------------
-- 4. Policies RLS — submission_history
-- ----------------------------------------------------------------------------

CREATE POLICY "admin_can_read_history"
  ON public.submission_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_colaborador_insert_history"
  ON public.submission_history FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
    )
    AND auth.uid() = moved_by
  );

-- C3 embutido
CREATE POLICY "colaborador_read_history"
  ON public.submission_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'colaborador'::public.app_role));

-- C3 embutido (viewer também vê o histórico via timeline read-only)
CREATE POLICY "viewer_read_history"
  ON public.submission_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'::public.app_role));


-- ----------------------------------------------------------------------------
-- 5. GRANTs / REVOKEs
-- Padroniza com as tabelas mais novas (chat_sessions/evaluations/etc.) —
-- RLS continua sendo o gate real; grants são defesa em profundidade.
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions        TO authenticated;
GRANT ALL                            ON public.submissions        TO service_role;

GRANT SELECT, INSERT                 ON public.submission_history TO authenticated;
GRANT ALL                            ON public.submission_history TO service_role;

REVOKE ALL ON public.submissions        FROM anon;
REVOKE ALL ON public.submission_history FROM anon;
