-- ============================================================================
-- 06 · VESTING + ONGOING PUBLIC SHARE
-- ============================================================================
-- Consolida:
--   • vesting_indicators — 20260610120000 (canônica) + 20260609145755 (dedup)
--   • vesting_measurements + vesting_week_notes — 20260611120000
--     + 20260611212748 (dedup)
--   • vesting_measurements.value_before — 20260612120000
--   • ongoing_share_links + RPC get_public_ongoing — 20260611150000
--     + 20260611214610 (dedup)
--   • RPC atualizada para expor value_before — 20260612120000
--
-- Descartes:
--   • set_vesting_weekly_updated_at(): função dedicada. Consolidada no
--     update_updated_at_column() compartilhado (mesmo corpo, mesma semântica) —
--     evita duplicação sem custo funcional. Confirmado via grep: nenhuma
--     referência externa (código, outra migration) esperando a função dedicada.
--   • Seed do Zelar (20260610120100_seed_zelar_vesting.sql): não portado —
--     seed inicial fica em task separada (docs/FOLLOWUPS.md).
--
-- Ordem crítica: ongoing_share_links depende de submissions; a RPC
-- get_public_ongoing depende de todas as tabelas anteriores neste arquivo.
--
-- Pré-requisitos: has_role(), update_updated_at_column(), app_role enum,
-- public.submissions.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. vesting_indicators (indicadores dos 90 dias iniciais)
-- ----------------------------------------------------------------------------
CREATE TABLE public.vesting_indicators (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id    UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  name             TEXT NOT NULL CHECK (length(trim(name)) > 0),
  goal_description TEXT NOT NULL CHECK (length(trim(goal_description)) > 0),
  weight           NUMERIC(5,2) NOT NULL DEFAULT 0
                     CHECK (weight >= 0 AND weight <= 100),
  status           TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente','em_andamento','em_risco','atingido','nao_atingido')),
  target_value     NUMERIC,
  current_value    NUMERIC,
  unit             TEXT,
  direction        TEXT NOT NULL DEFAULT 'gte'
                     CHECK (direction IN ('gte','lte')),
  progress_pct     NUMERIC(5,2)
                     CHECK (progress_pct IS NULL OR (progress_pct >= 0 AND progress_pct <= 100)),
  owner_name       TEXT,
  evidence_url     TEXT,
  notes            TEXT,
  display_order    INTEGER,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.vesting_indicators IS
  'Indicadores de vesting (primeiros 90 dias) por iniciativa — CRUD admin, leitura liderança';
COMMENT ON COLUMN public.vesting_indicators.weight IS
  'Peso percentual do marco no vesting total (não precisa somar 100 — parte de conjunto maior)';
COMMENT ON COLUMN public.vesting_indicators.direction IS
  'gte = maior é melhor (serviços, clientes, ROAS); lte = menor é melhor (CAC)';
COMMENT ON COLUMN public.vesting_indicators.progress_pct IS
  'Override manual de progresso 0-100. Tem prioridade sobre target/current quando preenchido';

CREATE INDEX vesting_indicators_submission_idx
  ON public.vesting_indicators (submission_id, display_order NULLS LAST, created_at);

ALTER TABLE public.vesting_indicators ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER vesting_indicators_updated_at
  BEFORE UPDATE ON public.vesting_indicators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ----------------------------------------------------------------------------
-- 2. vesting_measurements (medições semanais — 12 semanas fixas)
-- ----------------------------------------------------------------------------
CREATE TABLE public.vesting_measurements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  indicator_id  UUID NOT NULL REFERENCES public.vesting_indicators(id) ON DELETE CASCADE,
  week_number   INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 12),

  -- Valor no INÍCIO da semana (antes)
  value_before  NUMERIC,
  -- Valor ao FIM da semana (depois)
  value         NUMERIC,

  status        TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','em_andamento','em_risco','atingido','nao_atingido')),
  comment       TEXT,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (indicator_id, week_number)
);

COMMENT ON TABLE  public.vesting_measurements IS
  'Medição semanal de um indicador de vesting — eixo próprio (12 semanas), independente de ongoing_weeks';
COMMENT ON COLUMN public.vesting_measurements.value_before IS
  'Valor do indicador no início da semana (antes). value = valor ao fim (depois)';

CREATE INDEX vesting_measurements_submission_week_idx
  ON public.vesting_measurements (submission_id, week_number);
CREATE INDEX vesting_measurements_indicator_idx
  ON public.vesting_measurements (indicator_id, week_number);

ALTER TABLE public.vesting_measurements ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER vesting_measurements_updated_at
  BEFORE UPDATE ON public.vesting_measurements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ----------------------------------------------------------------------------
-- 3. vesting_week_notes (dificuldades / destaques da semana)
-- ----------------------------------------------------------------------------
CREATE TABLE public.vesting_week_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  week_number   INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 12),
  difficulties  TEXT,
  highlights    TEXT,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (submission_id, week_number)
);

COMMENT ON TABLE public.vesting_week_notes IS
  'Dificuldades e destaques da semana (12 semanas fixas do período de vesting)';

CREATE INDEX vesting_week_notes_submission_idx
  ON public.vesting_week_notes (submission_id, week_number);

ALTER TABLE public.vesting_week_notes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER vesting_week_notes_updated_at
  BEFORE UPDATE ON public.vesting_week_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ----------------------------------------------------------------------------
-- 4. ongoing_share_links (link público sem login da seção Ongoing)
-- ----------------------------------------------------------------------------
CREATE TABLE public.ongoing_share_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES public.submissions(id) ON DELETE CASCADE,
  token         UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ongoing_share_links IS
  'Token de compartilhamento público (sem login) da seção Ongoing — 1 por iniciativa, revogável via enabled=false';

ALTER TABLE public.ongoing_share_links ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER ongoing_share_links_updated_at
  BEFORE UPDATE ON public.ongoing_share_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ----------------------------------------------------------------------------
-- 5. Policies RLS — vesting_*
-- Padrão: admin gerencia + liderança (admin OU colaborador) lê.
-- A página /iniciativa/:id é ProtectedRoute allowedRoles=['admin','colaborador'].
-- 'viewer' NÃO tem acesso aqui — vesting é dado sensível de execução.
-- ----------------------------------------------------------------------------

CREATE POLICY "Admins manage vesting_indicators"
  ON public.vesting_indicators FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Leadership reads vesting_indicators"
  ON public.vesting_indicators FOR SELECT TO authenticated
  USING (
       public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );

CREATE POLICY "Admins manage vesting_measurements"
  ON public.vesting_measurements FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Leadership reads vesting_measurements"
  ON public.vesting_measurements FOR SELECT TO authenticated
  USING (
       public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );

CREATE POLICY "Admins manage vesting_week_notes"
  ON public.vesting_week_notes FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Leadership reads vesting_week_notes"
  ON public.vesting_week_notes FOR SELECT TO authenticated
  USING (
       public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );


-- ----------------------------------------------------------------------------
-- 6. Policies RLS — ongoing_share_links
-- Só admins criam/leem/desabilitam links. Anon NÃO acessa a tabela.
-- Acesso público acontece EXCLUSIVAMENTE via RPC get_public_ongoing abaixo.
-- ----------------------------------------------------------------------------

CREATE POLICY "Admins manage ongoing_share_links"
  ON public.ongoing_share_links FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


-- ----------------------------------------------------------------------------
-- 7. GRANTs / REVOKEs
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vesting_indicators    TO authenticated;
GRANT ALL                            ON public.vesting_indicators    TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vesting_measurements  TO authenticated;
GRANT ALL                            ON public.vesting_measurements  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vesting_week_notes    TO authenticated;
GRANT ALL                            ON public.vesting_week_notes    TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ongoing_share_links   TO authenticated;
GRANT ALL                            ON public.ongoing_share_links   TO service_role;

REVOKE ALL ON public.vesting_indicators   FROM anon;
REVOKE ALL ON public.vesting_measurements FROM anon;
REVOKE ALL ON public.vesting_week_notes   FROM anon;
REVOKE ALL ON public.ongoing_share_links  FROM anon;


-- ----------------------------------------------------------------------------
-- 8. RPC get_public_ongoing — único caminho de acesso público
-- SECURITY DEFINER: roda como owner e bypassa RLS. Por isso o corpo seleciona
-- EXPLICITAMENTE apenas o necessário para o link público (nunca submissions.data,
-- nunca dados de usuário/email). O token UUID em ongoing_share_links é a
-- credencial de acesso; desabilitar (enabled=false) revoga imediatamente.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_ongoing(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'project_name', s.project_name,
    'status', s.status,
    'indicators', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', vi.id,
          'submission_id', vi.submission_id,
          'name', vi.name,
          'goal_description', vi.goal_description,
          'weight', vi.weight,
          'status', vi.status,
          'target_value', vi.target_value,
          'current_value', vi.current_value,
          'unit', vi.unit,
          'direction', vi.direction,
          'progress_pct', vi.progress_pct,
          'owner_name', vi.owner_name,
          'evidence_url', vi.evidence_url,
          'notes', vi.notes,
          'display_order', vi.display_order,
          'created_at', vi.created_at,
          'updated_at', vi.updated_at
        )
        ORDER BY vi.display_order NULLS LAST, vi.created_at
      )
      FROM public.vesting_indicators vi
      WHERE vi.submission_id = s.id
    ), '[]'::jsonb),
    'measurements', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', vm.id,
          'submission_id', vm.submission_id,
          'indicator_id', vm.indicator_id,
          'week_number', vm.week_number,
          'value', vm.value,
          'value_before', vm.value_before,
          'status', vm.status,
          'comment', vm.comment
        )
        ORDER BY vm.week_number
      )
      FROM public.vesting_measurements vm
      WHERE vm.submission_id = s.id
    ), '[]'::jsonb),
    'week_notes', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', vn.id,
          'submission_id', vn.submission_id,
          'week_number', vn.week_number,
          'difficulties', vn.difficulties,
          'highlights', vn.highlights
        )
        ORDER BY vn.week_number
      )
      FROM public.vesting_week_notes vn
      WHERE vn.submission_id = s.id
    ), '[]'::jsonb)
  )
  FROM public.ongoing_share_links l
  JOIN public.submissions s ON s.id = l.submission_id
  WHERE l.token = p_token
    AND l.enabled = true;
$$;

-- Lockdown: anon e authenticated podem EXECUTAR (o token é a credencial);
-- ninguém mais.
REVOKE ALL ON FUNCTION public.get_public_ongoing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_ongoing(uuid) TO anon, authenticated;
