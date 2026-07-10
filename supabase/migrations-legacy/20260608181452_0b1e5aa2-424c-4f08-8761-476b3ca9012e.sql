CREATE TABLE public.week_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.ongoing_weeks(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.week_documents TO authenticated;
GRANT ALL ON public.week_documents TO service_role;

ALTER TABLE public.week_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage week_documents"
  ON public.week_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_week_documents_week_id_created_at ON public.week_documents (week_id, created_at DESC);
CREATE INDEX idx_week_documents_submission_id ON public.week_documents (submission_id);

CREATE POLICY "Admins can upload week documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'week-documents' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can read week documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'week-documents' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete week documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'week-documents' AND public.has_role(auth.uid(), 'admin'::app_role));