DROP POLICY IF EXISTS authenticated_can_insert_history ON public.submission_history;
CREATE POLICY admin_colaborador_insert_history ON public.submission_history
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'colaborador'::app_role))
    AND auth.uid() = moved_by
  );