-- 1. Tabela evaluations
CREATE TABLE IF NOT EXISTS public.evaluations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  author_id         uuid NOT NULL,
  source            text NOT NULL,
  scores            jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_score       numeric NOT NULL DEFAULT 0,
  has_veto          boolean NOT NULL DEFAULT false,
  verdict           text NOT NULL DEFAULT '',
  descriptions      jsonb,
  report            text,
  summary           text,
  volund_run_id     text,
  processing_status text NOT NULL DEFAULT 'completed',
  error_message     text,
  processed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.evaluations IS 'Avaliações de scorecard de uma submission. Suporta N avaliações (1 IA + várias manuais).';
COMMENT ON COLUMN public.evaluations.source            IS 'ai = gerada pelo agente Volund OS · manual = preenchida por um admin';
COMMENT ON COLUMN public.evaluations.scores            IS 'Notas 0-10 por chave de SCORECARD_META + flags veto_<key>: bool';
COMMENT ON COLUMN public.evaluations.descriptions      IS 'Justificativa por indicador (preenchida pelo agente IA)';
COMMENT ON COLUMN public.evaluations.report            IS 'Relatório markdown completo (PG framework + scorecard) — só IA';
COMMENT ON COLUMN public.evaluations.processing_status IS 'Manuais entram com completed. IA: processing → completed/failed via callback.';

-- 2. GRANTs (obrigatório no public schema)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluations TO authenticated;
GRANT ALL ON public.evaluations TO service_role;

-- 3. Constraints
ALTER TABLE public.evaluations DROP CONSTRAINT IF EXISTS evaluations_source_check;
ALTER TABLE public.evaluations
  ADD CONSTRAINT evaluations_source_check CHECK (source IN ('ai', 'manual'));

ALTER TABLE public.evaluations DROP CONSTRAINT IF EXISTS evaluations_processing_status_check;
ALTER TABLE public.evaluations
  ADD CONSTRAINT evaluations_processing_status_check
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));

-- 4. Índices
CREATE INDEX IF NOT EXISTS evaluations_submission_id_idx
  ON public.evaluations (submission_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS evaluations_volund_run_id_unique_idx
  ON public.evaluations (volund_run_id)
  WHERE volund_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS evaluations_processing_status_idx
  ON public.evaluations (processing_status)
  WHERE processing_status NOT IN ('completed');

-- 5. Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_evaluations_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evaluations_updated_at ON public.evaluations;
CREATE TRIGGER evaluations_updated_at
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_evaluations_updated_at();

-- 6. RLS
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage evaluations" ON public.evaluations;
CREATE POLICY "Admins manage evaluations"
  ON public.evaluations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Colaboradores read evaluations" ON public.evaluations;
CREATE POLICY "Colaboradores read evaluations"
  ON public.evaluations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'colaborador'::public.app_role));

DROP POLICY IF EXISTS "Viewers read evaluations" ON public.evaluations;
CREATE POLICY "Viewers read evaluations"
  ON public.evaluations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'::public.app_role));

DROP POLICY IF EXISTS "Founders read own submission evaluations" ON public.evaluations;
CREATE POLICY "Founders read own submission evaluations"
  ON public.evaluations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'founder'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = evaluations.submission_id
        AND s.user_id = auth.uid()
    )
  );

-- 7. Backfill idempotente de submission_scores
INSERT INTO public.evaluations (
  id, submission_id, author_id, source,
  scores, final_score, has_veto, verdict,
  processing_status, created_at, updated_at
)
SELECT
  ss.id, ss.submission_id, ss.evaluated_by, 'manual',
  ss.scores, ss.final_score, ss.has_veto, ss.verdict,
  'completed', ss.created_at, ss.updated_at
FROM public.submission_scores ss
WHERE NOT EXISTS (
  SELECT 1 FROM public.evaluations e WHERE e.id = ss.id
);