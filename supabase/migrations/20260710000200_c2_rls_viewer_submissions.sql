-- ============================================================================
-- C2 — Viewer precisa ler submissions (DashboardViewer estava quebrado)
-- ============================================================================
-- O role 'viewer' não tinha NENHUMA policy de SELECT em submissions: o kanban
-- read-only (/dashboard-viewer) sempre retornava zero linhas. Espelha a policy
-- de colaborador (leitura total, sem escrita).

DROP POLICY IF EXISTS "viewer_view_all_submissions" ON public.submissions;
CREATE POLICY "viewer_view_all_submissions"
  ON public.submissions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'::app_role));
