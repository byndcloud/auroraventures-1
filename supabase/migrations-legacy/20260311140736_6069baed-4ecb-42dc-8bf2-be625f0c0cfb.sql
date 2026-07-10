
CREATE POLICY "Admins can delete submissions"
ON public.submissions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
