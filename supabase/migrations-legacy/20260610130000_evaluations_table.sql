-- ============================================================================
-- Migration: Tabela evaluations — N avaliações por submission (IA + manuais)
-- ============================================================================
-- Substitui a antiga submission_scores (1:1) por evaluations (1:N), suportando:
--   - Uma avaliação por IA (source='ai') gerada via Volund OS
--   - Múltiplas avaliações manuais (source='manual') de diferentes admins
--
-- COEXISTÊNCIA: submission_scores NÃO é dropada nesta migration. O backfill
-- copia todas as linhas existentes para evaluations como source='manual'.
-- A tabela antiga será removida em migration futura, após o front estar 100%
-- migrado e validado. Isso garante zero perda de dados e rollback fácil.
--
-- Rollback: bloco comentado no final.
-- ============================================================================

-- 1. Tabela evaluations -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evaluations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  author_id         uuid NOT NULL,                       -- quem criou (admin que clicou IA ou autor da manual)
  source            text NOT NULL,                       -- 'ai' | 'manual'
  scores            jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { diferencial: 7, alinhamento: 8, veto_riscoRegulatorio: false, ... }
  final_score       numeric NOT NULL DEFAULT 0,
  has_veto          boolean NOT NULL DEFAULT false,
  verdict           text NOT NULL DEFAULT '',
  descriptions      jsonb,                               -- { diferencial: "...", ... } — opcional, usado em avaliações IA
  report            text,                                -- markdown longo do agente — só preenchido quando source='ai'
  summary           text,                                -- resumo curto (preview no card)
  volund_run_id     text,                                -- ID do run no Volund OS (somente source='ai')
  processing_status text NOT NULL DEFAULT 'completed',   -- pending | processing | completed | failed
  error_message     text,
  processed_at      timestamptz,                         -- quando o callback do Volund concluiu
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.evaluations IS 'Avaliações de scorecard de uma submission. Suporta N avaliações (1 IA + várias manuais).';
COMMENT ON COLUMN public.evaluations.source            IS 'ai = gerada pelo agente Volund OS · manual = preenchida por um admin';
COMMENT ON COLUMN public.evaluations.scores            IS 'Notas 0-10 por chave de SCORECARD_META + flags veto_<key>: bool';
COMMENT ON COLUMN public.evaluations.descriptions      IS 'Justificativa por indicador (preenchida pelo agente IA)';
COMMENT ON COLUMN public.evaluations.report            IS 'Relatório markdown completo (PG framework + scorecard) — só IA';
COMMENT ON COLUMN public.evaluations.processing_status IS 'Manuais entram com completed. IA: processing → completed/failed via callback.';

-- 2. Constraints --------------------------------------------------------------
ALTER TABLE public.evaluations
  DROP CONSTRAINT IF EXISTS evaluations_source_check;
ALTER TABLE public.evaluations
  ADD CONSTRAINT evaluations_source_check
    CHECK (source IN ('ai', 'manual'));

ALTER TABLE public.evaluations
  DROP CONSTRAINT IF EXISTS evaluations_processing_status_check;
ALTER TABLE public.evaluations
  ADD CONSTRAINT evaluations_processing_status_check
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));

-- 3. Índices ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS evaluations_submission_id_idx
  ON public.evaluations (submission_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS evaluations_volund_run_id_unique_idx
  ON public.evaluations (volund_run_id)
  WHERE volund_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS evaluations_processing_status_idx
  ON public.evaluations (processing_status)
  WHERE processing_status NOT IN ('completed');

-- 4. Trigger de updated_at ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_evaluations_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evaluations_updated_at ON public.evaluations;
CREATE TRIGGER evaluations_updated_at
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_evaluations_updated_at();

-- 5. RLS ----------------------------------------------------------------------
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- Admins: tudo
DROP POLICY IF EXISTS "Admins manage evaluations" ON public.evaluations;
CREATE POLICY "Admins manage evaluations"
  ON public.evaluations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Colaboradores: leitura completa (não escrevem — por enquanto)
DROP POLICY IF EXISTS "Colaboradores read evaluations" ON public.evaluations;
CREATE POLICY "Colaboradores read evaluations"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'colaborador'::public.app_role));

-- Viewers: leitura completa
DROP POLICY IF EXISTS "Viewers read evaluations" ON public.evaluations;
CREATE POLICY "Viewers read evaluations"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'::public.app_role));

-- Founders: leem APENAS avaliações das próprias submissions
DROP POLICY IF EXISTS "Founders read own submission evaluations" ON public.evaluations;
CREATE POLICY "Founders read own submission evaluations"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'founder'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = evaluations.submission_id
        AND s.user_id = auth.uid()
    )
  );

-- 6. Backfill de submission_scores -------------------------------------------
-- Copia toda submission_scores existente como evaluations manuais.
-- Idempotente: usa NOT EXISTS para não duplicar em re-execução.
INSERT INTO public.evaluations (
  id, submission_id, author_id, source,
  scores, final_score, has_veto, verdict,
  processing_status, created_at, updated_at
)
SELECT
  ss.id,                          -- preserva id original p/ rastreabilidade
  ss.submission_id,
  ss.evaluated_by,
  'manual',
  ss.scores,
  ss.final_score,
  ss.has_veto,
  ss.verdict,
  'completed',
  ss.created_at,
  ss.updated_at
FROM public.submission_scores ss
WHERE NOT EXISTS (
  SELECT 1 FROM public.evaluations e WHERE e.id = ss.id
);

-- ============================================================================
-- ROLLBACK (executar manualmente se necessário)
-- ============================================================================
-- DROP TRIGGER IF EXISTS evaluations_updated_at ON public.evaluations;
-- DROP FUNCTION IF EXISTS public.set_evaluations_updated_at();
-- DROP TABLE IF EXISTS public.evaluations CASCADE;
-- ============================================================================
