-- ============================================================================
-- Migration: Tabela ongoing_weeks + FK em meetings
-- ============================================================================
-- A aba "Ongoing" agora agrupa reuniões em "semanas". Cada semana tem um
-- título livre (ex: "Semana 0 - Onboarding") e contém N reuniões geradas
-- pelo Volund OS.
--
-- Relação:
--   submissions  ──< ongoing_weeks  ──< meetings (FK opcional via week_id)
--
-- Reuniões da aba "Reuniões" normal (category='general') têm week_id = NULL.
-- Reuniões da aba "Ongoing" (category='ongoing') têm week_id preenchido.
--
-- ON DELETE da semana = CASCADE: deletar uma semana apaga as reuniões dela.
-- (Se preferir SET NULL no futuro, alterar a constraint week_id.)
--
-- Rollback manual: ver bloco no fim do arquivo.
-- ============================================================================

-- 1) Tabela ongoing_weeks ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ongoing_weeks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  display_order INTEGER,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ongoing_weeks IS
  'Semanas da aba Ongoing — agrupam reuniões durante a fase pós-investimento';

CREATE INDEX IF NOT EXISTS ongoing_weeks_submission_idx
  ON public.ongoing_weeks (submission_id, display_order NULLS LAST, created_at);

-- 2) RLS — admin gerencia, demais sem acesso por enquanto -------------------
ALTER TABLE public.ongoing_weeks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage ongoing_weeks" ON public.ongoing_weeks;
CREATE POLICY "Admins manage ongoing_weeks"
  ON public.ongoing_weeks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) FK week_id em meetings --------------------------------------------------
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS week_id UUID
    REFERENCES public.ongoing_weeks(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.meetings.week_id IS
  'NULL para reuniões da aba Reuniões. Preenchido com a semana correspondente para reuniões da aba Ongoing.';

CREATE INDEX IF NOT EXISTS meetings_week_id_idx
  ON public.meetings (week_id) WHERE week_id IS NOT NULL;

-- ============================================================================
-- ROLLBACK (manual)
-- ============================================================================
-- DROP INDEX IF EXISTS meetings_week_id_idx;
-- ALTER TABLE public.meetings DROP COLUMN IF EXISTS week_id;
-- DROP POLICY IF EXISTS "Admins manage ongoing_weeks" ON public.ongoing_weeks;
-- DROP INDEX IF EXISTS ongoing_weeks_submission_idx;
-- DROP TABLE IF EXISTS public.ongoing_weeks;
