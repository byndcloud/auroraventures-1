-- ============================================================================
-- Migration: Indicadores de Vesting (primeiros 90 dias da iniciativa)
-- ============================================================================
-- Indicadores modulares que ditam o vesting de uma iniciativa na fase Ongoing.
-- Aparecem no topo da aba Ongoing (admin, editável) e na página /iniciativa
-- (read-only para a liderança).
--
-- Cálculo de progresso é feito no frontend (hook useVestingProgress) — esta
-- tabela só guarda os dados.
--
-- RLS — DUAS policies (não só admin):
--   1. Admin gerencia (FOR ALL).
--   2. Admin + colaborador leem (FOR SELECT) — NECESSÁRIO porque a página
--      /iniciativa/:id é ProtectedRoute allowedRoles=['admin','colaborador'];
--      sem esta policy o colaborador (liderança) veria a seção vazia.
--   O enum app_role é ('founder','colaborador','admin') — 'viewer' NÃO é
--   referenciado aqui de propósito (route guard só admite admin/colaborador).
--
-- Rollback manual: ver bloco no fim do arquivo.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vesting_indicators (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id    UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  name             TEXT NOT NULL CHECK (length(trim(name)) > 0),
  goal_description TEXT NOT NULL CHECK (length(trim(goal_description)) > 0),
  weight           NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 100),
  status           TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente','em_andamento','em_risco','atingido','nao_atingido')),
  target_value     NUMERIC,
  current_value    NUMERIC,
  unit             TEXT,
  direction        TEXT NOT NULL DEFAULT 'gte' CHECK (direction IN ('gte','lte')),
  progress_pct     NUMERIC(5,2) CHECK (progress_pct IS NULL OR (progress_pct >= 0 AND progress_pct <= 100)),
  owner_name       TEXT,
  evidence_url     TEXT,
  notes            TEXT,
  display_order    INTEGER,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vesting_indicators IS
  'Indicadores de vesting (primeiros 90 dias) por iniciativa — modular, CRUD admin, leitura liderança';
COMMENT ON COLUMN public.vesting_indicators.weight IS
  'Peso percentual do marco no vesting total (não precisa somar 100 — é parte de um conjunto maior)';
COMMENT ON COLUMN public.vesting_indicators.direction IS
  'gte = maior é melhor (serviços, clientes, ROAS); lte = menor é melhor (CAC)';
COMMENT ON COLUMN public.vesting_indicators.progress_pct IS
  'Override manual de progresso 0-100. Tem prioridade sobre target/current quando preenchido';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vesting_indicators TO authenticated;
GRANT ALL ON public.vesting_indicators TO service_role;

CREATE INDEX IF NOT EXISTS vesting_indicators_submission_idx
  ON public.vesting_indicators (submission_id, display_order NULLS LAST, created_at);

ALTER TABLE public.vesting_indicators ENABLE ROW LEVEL SECURITY;

-- (1) Admin gerencia tudo
DROP POLICY IF EXISTS "Admins manage vesting_indicators" ON public.vesting_indicators;
CREATE POLICY "Admins manage vesting_indicators"
  ON public.vesting_indicators FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- (2) Admin + colaborador leem (liderança) — crítico para a página /iniciativa
DROP POLICY IF EXISTS "Leadership reads vesting_indicators" ON public.vesting_indicators;
CREATE POLICY "Leadership reads vesting_indicators"
  ON public.vesting_indicators FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );

-- ============================================================================
-- ROLLBACK (manual)
-- ============================================================================
-- DROP POLICY IF EXISTS "Leadership reads vesting_indicators" ON public.vesting_indicators;
-- DROP POLICY IF EXISTS "Admins manage vesting_indicators" ON public.vesting_indicators;
-- DROP INDEX IF EXISTS vesting_indicators_submission_idx;
-- DROP TABLE IF EXISTS public.vesting_indicators;
