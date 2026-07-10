-- ============================================================================
-- C3 — Colaborador precisa LER meetings / ongoing_weeks / week_documents /
--      submission_history (abas de /iniciativa/:id estavam quebradas)
-- ============================================================================
-- Essas tabelas tinham RLS apenas para admin (FOR ALL). A rota /iniciativa/:id
-- é acessível a colaborador, mas as seções Reuniões, Checkpoint (semanas +
-- documentos) e Histórico retornavam vazio por falta de policy de SELECT.
-- Escrita continua exclusiva de admin.

-- Reuniões
DROP POLICY IF EXISTS "colaborador_read_meetings" ON public.meetings;
CREATE POLICY "colaborador_read_meetings"
  ON public.meetings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'colaborador'::app_role));

-- Semanas de checkpoint
DROP POLICY IF EXISTS "colaborador_read_ongoing_weeks" ON public.ongoing_weeks;
CREATE POLICY "colaborador_read_ongoing_weeks"
  ON public.ongoing_weeks
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'colaborador'::app_role));

-- Documentos das semanas
DROP POLICY IF EXISTS "colaborador_read_week_documents" ON public.week_documents;
CREATE POLICY "colaborador_read_week_documents"
  ON public.week_documents
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'colaborador'::app_role));

-- Download dos documentos no Storage (a UI baixa direto do bucket)
DROP POLICY IF EXISTS "colaborador_read_week_documents_storage" ON storage.objects;
CREATE POLICY "colaborador_read_week_documents_storage"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'week-documents'
    AND public.has_role(auth.uid(), 'colaborador'::app_role)
  );

-- Histórico de movimentações (colaborador só tinha INSERT)
DROP POLICY IF EXISTS "colaborador_read_history" ON public.submission_history;
CREATE POLICY "colaborador_read_history"
  ON public.submission_history
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'colaborador'::app_role));

-- Viewer também lê o histórico (timeline do kanban read-only)
DROP POLICY IF EXISTS "viewer_read_history" ON public.submission_history;
CREATE POLICY "viewer_read_history"
  ON public.submission_history
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'::app_role));
