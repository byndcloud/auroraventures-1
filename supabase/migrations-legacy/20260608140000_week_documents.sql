-- ============================================================================
-- Migration: Documentos por semana de Ongoing (PDF, PPTX, DOCX, etc.)
-- ============================================================================
-- Cada semana da aba Ongoing pode ter documentos anexos (slides, propostas,
-- contratos, materiais de apoio). Por enquanto são apenas armazenados como
-- referência — no futuro, um MCP poderá ler todos os arquivos+atas+transcrições
-- e gerar insights da base de conhecimento.
--
-- Estrutura:
--   ongoing_weeks  ──< week_documents (FK CASCADE)
--                         |
--                         └─ file_path → bucket 'week-documents' (privado)
--
-- ON DELETE da semana = CASCADE: deletar a semana apaga os registros aqui.
-- O frontend é responsável por remover os arquivos do Storage antes do
-- DELETE (igual ao fluxo de transcripts).
--
-- Rollback manual: ver bloco no fim do arquivo.
-- ============================================================================

-- 1) Tabela week_documents ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.week_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id       UUID NOT NULL REFERENCES public.ongoing_weeks(id) ON DELETE CASCADE,
  -- Denormalizado para facilitar queries por iniciativa e simplificar RLS
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  file_size     BIGINT NOT NULL,
  mime_type     TEXT,
  uploaded_by   UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.week_documents IS
  'Documentos (PDF/PPTX/DOCX/etc.) anexados a uma semana de Ongoing — base de conhecimento da iniciativa';

CREATE INDEX IF NOT EXISTS week_documents_week_idx
  ON public.week_documents (week_id, created_at DESC);

CREATE INDEX IF NOT EXISTS week_documents_submission_idx
  ON public.week_documents (submission_id);

-- 2) RLS — admin gerencia ----------------------------------------------------
ALTER TABLE public.week_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage week_documents" ON public.week_documents;
CREATE POLICY "Admins manage week_documents"
  ON public.week_documents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Storage bucket privado para os documentos ------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('week-documents', 'week-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 4) RLS policies do bucket --------------------------------------------------
DROP POLICY IF EXISTS "Admins upload week-documents" ON storage.objects;
CREATE POLICY "Admins upload week-documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'week-documents'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins read week-documents" ON storage.objects;
CREATE POLICY "Admins read week-documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'week-documents'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins delete week-documents" ON storage.objects;
CREATE POLICY "Admins delete week-documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'week-documents'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- ============================================================================
-- ROLLBACK (manual)
-- ============================================================================
-- DROP POLICY IF EXISTS "Admins upload week-documents" ON storage.objects;
-- DROP POLICY IF EXISTS "Admins read week-documents" ON storage.objects;
-- DROP POLICY IF EXISTS "Admins delete week-documents" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'week-documents';
--
-- DROP POLICY IF EXISTS "Admins manage week_documents" ON public.week_documents;
-- DROP INDEX IF EXISTS week_documents_submission_idx;
-- DROP INDEX IF EXISTS week_documents_week_idx;
-- DROP TABLE IF EXISTS public.week_documents;
