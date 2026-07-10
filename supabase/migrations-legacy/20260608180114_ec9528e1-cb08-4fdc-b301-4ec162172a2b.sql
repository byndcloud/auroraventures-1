CREATE POLICY "colaborador_view_all_submissions"
  ON public.submissions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'colaborador'::app_role));