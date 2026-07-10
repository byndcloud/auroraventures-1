
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS transcript_url   TEXT,
  ADD COLUMN IF NOT EXISTS source           TEXT,
  ADD COLUMN IF NOT EXISTS volund_run_id    TEXT,
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS error_message    TEXT,
  ADD COLUMN IF NOT EXISTS processed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS minutes_structured JSONB;

COMMENT ON COLUMN public.meetings.transcript_url    IS 'URL (signed) do arquivo de transcrição no Storage';
COMMENT ON COLUMN public.meetings.source            IS 'volund_upload | manual | roam_webhook';
COMMENT ON COLUMN public.meetings.volund_run_id     IS 'ID do run no Volund OS (referência externa)';
COMMENT ON COLUMN public.meetings.processing_status IS 'pending | queued | processing | completed | failed';
COMMENT ON COLUMN public.meetings.minutes_structured IS 'Ata estruturada gerada pelo agente Volund';

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_processing_status_check;
ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_processing_status_check
    CHECK (processing_status IN ('pending', 'queued', 'processing', 'completed', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS meetings_volund_run_id_unique_idx
  ON public.meetings (volund_run_id)
  WHERE volund_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS meetings_processing_status_idx
  ON public.meetings (processing_status)
  WHERE processing_status NOT IN ('completed', 'pending');

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
