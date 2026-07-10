
-- 1. Bucket privado para transcrições de reuniões
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meeting-transcripts',
  'meeting-transcripts',
  false,
  5242880,
  ARRAY['text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS: somente admins fazem upload/download
CREATE POLICY "admin_manage_transcripts" ON storage.objects
  FOR ALL TO authenticated
  USING  (bucket_id = 'meeting-transcripts' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'meeting-transcripts' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Adiciona coluna de path no Storage (sem dropar transcript — preserva dados existentes)
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS transcript_url TEXT;
