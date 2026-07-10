-- ============================================================================
-- Migration: Integração com Volund OS para atas estruturadas de reuniões
-- ============================================================================
-- Adiciona suporte para upload de múltiplos arquivos de transcrição que são
-- enviados ao agente Volund OS, que retorna uma ata estruturada (JSONB) via
-- callback. NÃO remove campos existentes — coexiste com o fluxo manual atual.
--
-- Coexistência:
--   - meetings.smart_minutes (TEXT) continua existindo para o fluxo manual
--   - meetings.minutes_structured (JSONB) é a nova ata gerada pelo Volund
--   - O frontend prioriza minutes_structured quando presente
--
-- Rollback:
--   - Drop columns adicionadas (ver bloco no final, comentado)
--   - Drop bucket transcripts (manualmente)
-- ============================================================================

-- 1. Novas colunas em meetings ------------------------------------------------
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS transcript_url   TEXT,
  ADD COLUMN IF NOT EXISTS source           TEXT,
  ADD COLUMN IF NOT EXISTS volund_run_id    TEXT,
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS error_message    TEXT,
  ADD COLUMN IF NOT EXISTS processed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS minutes_structured JSONB;

COMMENT ON COLUMN public.meetings.transcript_url   IS 'URL (signed) do arquivo de transcrição no Storage';
COMMENT ON COLUMN public.meetings.source           IS 'volund_upload | manual | roam_webhook';
COMMENT ON COLUMN public.meetings.volund_run_id    IS 'ID do run no Volund OS (referência externa)';
COMMENT ON COLUMN public.meetings.processing_status IS 'pending | queued | processing | completed | failed';
COMMENT ON COLUMN public.meetings.minutes_structured IS 'Ata estruturada gerada pelo agente Volund (vide schema no prompt)';

-- 2. CHECK constraint para o status ------------------------------------------
ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_processing_status_check;

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_processing_status_check
    CHECK (processing_status IN ('pending', 'queued', 'processing', 'completed', 'failed'));

-- 3. Índice para volund_run_id (lookup pelo callback) ------------------------
CREATE UNIQUE INDEX IF NOT EXISTS meetings_volund_run_id_unique_idx
  ON public.meetings (volund_run_id)
  WHERE volund_run_id IS NOT NULL;

-- 4. Índice para queries de meetings em processamento -----------------------
CREATE INDEX IF NOT EXISTS meetings_processing_status_idx
  ON public.meetings (processing_status)
  WHERE processing_status NOT IN ('completed', 'pending');

-- 5. Storage bucket privado para transcrições -------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('transcripts', 'transcripts', false)
ON CONFLICT (id) DO NOTHING;

-- 6. RLS policies do bucket transcripts -------------------------------------
-- Apenas admins fazem upload e leitura. As Edge Functions usam service_role e
-- bypassam essas policies, mas as policies protegem acesso direto via client.

DROP POLICY IF EXISTS "Admins upload transcripts" ON storage.objects;
CREATE POLICY "Admins upload transcripts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'transcripts'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins read transcripts" ON storage.objects;
CREATE POLICY "Admins read transcripts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'transcripts'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins delete transcripts" ON storage.objects;
CREATE POLICY "Admins delete transcripts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'transcripts'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- ============================================================================
-- ROLLBACK (executar manualmente se necessário)
-- ============================================================================
-- ALTER TABLE public.meetings
--   DROP COLUMN IF EXISTS transcript_url,
--   DROP COLUMN IF EXISTS source,
--   DROP COLUMN IF EXISTS volund_run_id,
--   DROP COLUMN IF EXISTS processing_status,
--   DROP COLUMN IF EXISTS error_message,
--   DROP COLUMN IF EXISTS processed_at,
--   DROP COLUMN IF EXISTS minutes_structured;
--
-- DROP INDEX IF EXISTS meetings_volund_run_id_unique_idx;
-- DROP INDEX IF EXISTS meetings_processing_status_idx;
--
-- DROP POLICY IF EXISTS "Admins upload transcripts" ON storage.objects;
-- DROP POLICY IF EXISTS "Admins read transcripts" ON storage.objects;
-- DROP POLICY IF EXISTS "Admins delete transcripts" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'transcripts';
