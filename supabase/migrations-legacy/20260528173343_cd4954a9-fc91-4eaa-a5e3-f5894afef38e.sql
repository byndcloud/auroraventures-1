DROP POLICY IF EXISTS "Users can create their own submissions" ON public.submissions;

CREATE POLICY "Users can create their own submissions"
ON public.submissions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    type = 'mercado'
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);