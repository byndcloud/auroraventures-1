-- ============================================================================
-- 03 · MEETINGS + ONGOING WEEKS + WEEK DOCUMENTS + STORAGE BUCKETS
-- ============================================================================
-- Consolida:
--   • meetings base — 20260311180146
--   • Colunas Volund (transcript_url, source, volund_run_id, processing_status,
--     error_message, processed_at, minutes_structured) — 20260606120000
--   • category ('general'|'ongoing') — 20260608120000
--   • week_id FK para ongoing_weeks — 20260608130000
--   • transcript_path (C4 embutido — path é fonte de verdade; signed URL sob demanda)
--   • ongoing_weeks — 20260608130000
--   • week_documents — 20260608140000
--   • Bucket transcripts — 20260606120000
--   • Bucket week-documents — 20260608140000
--   • Colaborador SELECT em meetings, ongoing_weeks, week_documents +
--     storage 'week-documents' (C3 embutido)
--
-- Descartes:
--   • Bucket 'meeting-transcripts' (20260608_a3_2): órfão, código sempre usou
--     'transcripts'. Não criado (C7 dropa; from scratch, não existe).
--   • Duplicatas idempotentes: 20260606210425 (rerun Volund), 20260608143311
--     (rerun ongoing_weeks + category), 20260608181452 (duplicata
--     week_documents). Efeito absorvido pela versão canônica.
--   • Backfill de transcript_path a partir de transcript_url (C4): schema
--     from scratch, nada a preencher.
--
-- Pré-requisitos: extensão pgcrypto, has_role(), update_updated_at_column(),
-- app_role enum, public.submissions.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. ongoing_weeks (semanas de checkpoint na aba Ongoing)
-- Criada antes de meetings porque meetings.week_id referencia esta tabela.
-- ----------------------------------------------------------------------------
CREATE TABLE public.ongoing_weeks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID        NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  display_order INTEGER,
  created_by    UUID        REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ongoing_weeks IS
  'Semanas da aba Ongoing — agrupam reuniões durante a fase pós-investimento';

CREATE INDEX ongoing_weeks_submission_idx
  ON public.ongoing_weeks (submission_id, display_order NULLS LAST, created_at);

ALTER TABLE public.ongoing_weeks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER ongoing_weeks_updated_at
  BEFORE UPDATE ON public.ongoing_weeks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ----------------------------------------------------------------------------
-- 2. meetings
-- Todas as colunas do estado final numa única DDL — Volund, category, week_id,
-- transcript_path (C4) inclusos desde a criação.
-- ----------------------------------------------------------------------------
CREATE TABLE public.meetings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id       UUID        NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  title               TEXT        NOT NULL,
  meeting_date        TIMESTAMPTZ NOT NULL,
  pre_agenda          TEXT,
  transcript          TEXT,
  smart_minutes       TEXT,
  created_by          UUID        REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Integração Volund OS
  transcript_url      TEXT,
  source              TEXT,
  volund_run_id       TEXT,
  processing_status   TEXT DEFAULT 'pending',
  error_message       TEXT,
  processed_at        TIMESTAMPTZ,
  minutes_structured  JSONB,

  -- Categoria: 'general' = aba Reuniões, 'ongoing' = aba Checkpoint
  category            TEXT        NOT NULL DEFAULT 'general',

  -- FK para semana de checkpoint. NULL para reuniões da aba Reuniões.
  week_id             UUID        REFERENCES public.ongoing_weeks(id) ON DELETE CASCADE,

  -- C4 embutido: path no bucket transcripts (fonte de verdade; signed URL
  -- é gerada sob demanda via storage.createSignedUrl).
  transcript_path     TEXT,

  CONSTRAINT meetings_processing_status_check
    CHECK (processing_status IN ('pending','queued','processing','completed','failed')),
  CONSTRAINT meetings_category_check
    CHECK (category IN ('general','ongoing'))
);

COMMENT ON COLUMN public.meetings.transcript_url     IS 'Legado — signed URL com TTL curto; usar transcript_path como fonte de verdade';
COMMENT ON COLUMN public.meetings.source             IS 'volund_upload | manual | roam_webhook';
COMMENT ON COLUMN public.meetings.volund_run_id      IS 'ID do run no Volund OS (referência externa)';
COMMENT ON COLUMN public.meetings.processing_status  IS 'pending | queued | processing | completed | failed';
COMMENT ON COLUMN public.meetings.minutes_structured IS 'Ata estruturada gerada pelo agente Volund';
COMMENT ON COLUMN public.meetings.category           IS 'general (aba Reuniões pre-fechamento) | ongoing (aba Checkpoint pós-investimento)';
COMMENT ON COLUMN public.meetings.week_id            IS 'NULL para reuniões da aba Reuniões; FK para ongoing_weeks nas de checkpoint';
COMMENT ON COLUMN public.meetings.transcript_path    IS 'Path do arquivo no bucket transcripts — fonte de verdade; signed URL é gerada sob demanda';

CREATE INDEX meetings_submission_id_idx
  ON public.meetings (submission_id);

CREATE UNIQUE INDEX meetings_volund_run_id_unique_idx
  ON public.meetings (volund_run_id)
  WHERE volund_run_id IS NOT NULL;

CREATE INDEX meetings_processing_status_idx
  ON public.meetings (processing_status)
  WHERE processing_status NOT IN ('completed', 'pending');

CREATE INDEX meetings_submission_category_date_idx
  ON public.meetings (submission_id, category, meeting_date DESC);

CREATE INDEX meetings_week_id_idx
  ON public.meetings (week_id) WHERE week_id IS NOT NULL;

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ----------------------------------------------------------------------------
-- 3. week_documents (documentos por semana de Ongoing)
-- ----------------------------------------------------------------------------
CREATE TABLE public.week_documents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id       UUID        NOT NULL REFERENCES public.ongoing_weeks(id) ON DELETE CASCADE,
  -- denormalizado: simplifica filtros por iniciativa e RLS
  submission_id UUID        NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  file_name     TEXT        NOT NULL,
  file_path     TEXT        NOT NULL,
  file_size     BIGINT      NOT NULL,
  mime_type     TEXT,
  uploaded_by   UUID        REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.week_documents IS
  'Documentos (PDF/PPTX/DOCX/etc.) anexados a uma semana de Ongoing';

CREATE INDEX week_documents_week_idx
  ON public.week_documents (week_id, created_at DESC);

CREATE INDEX week_documents_submission_idx
  ON public.week_documents (submission_id);

ALTER TABLE public.week_documents ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 4. Storage buckets privados
-- Bucket 'meeting-transcripts' (órfão de A3.2) DELIBERADAMENTE não é criado.
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES
  ('transcripts',    'transcripts',    false),
  ('week-documents', 'week-documents', false);


-- ----------------------------------------------------------------------------
-- 5. Policies RLS nas tabelas
-- ----------------------------------------------------------------------------

-- meetings
CREATE POLICY "admin_can_manage_meetings"
  ON public.meetings FOR ALL
  TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- C3 embutido
CREATE POLICY "colaborador_read_meetings"
  ON public.meetings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'colaborador'::public.app_role));

-- ongoing_weeks
CREATE POLICY "Admins manage ongoing_weeks"
  ON public.ongoing_weeks FOR ALL
  TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- C3 embutido
CREATE POLICY "colaborador_read_ongoing_weeks"
  ON public.ongoing_weeks FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'colaborador'::public.app_role));

-- week_documents
CREATE POLICY "Admins manage week_documents"
  ON public.week_documents FOR ALL
  TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- C3 embutido
CREATE POLICY "colaborador_read_week_documents"
  ON public.week_documents FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'colaborador'::public.app_role));


-- ----------------------------------------------------------------------------
-- 6. Policies RLS em storage.objects
-- Edge Functions (Volund callback, upload-meetings) usam service_role e
-- bypassam essas policies; elas protegem o acesso direto via client.
-- ----------------------------------------------------------------------------

-- Bucket 'transcripts' — admin CRUD
CREATE POLICY "Admins upload transcripts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'transcripts'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins read transcripts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'transcripts'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins update transcripts"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING      (bucket_id = 'transcripts' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'transcripts' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete transcripts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'transcripts'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Bucket 'week-documents' — admin CRUD + colaborador SELECT (C3 embutido)
CREATE POLICY "Admins upload week-documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'week-documents'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins read week-documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'week-documents'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins update week-documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING      (bucket_id = 'week-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'week-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete week-documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'week-documents'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- C3 embutido: front baixa direto do bucket, colaborador precisa de SELECT
CREATE POLICY "colaborador_read_week_documents_storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'week-documents'
    AND public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );


-- ----------------------------------------------------------------------------
-- 7. GRANTs / REVOKEs
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings       TO authenticated;
GRANT ALL                            ON public.meetings       TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ongoing_weeks  TO authenticated;
GRANT ALL                            ON public.ongoing_weeks  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.week_documents TO authenticated;
GRANT ALL                            ON public.week_documents TO service_role;

REVOKE ALL ON public.meetings       FROM anon;
REVOKE ALL ON public.ongoing_weeks  FROM anon;
REVOKE ALL ON public.week_documents FROM anon;
