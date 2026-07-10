
-- Add briefing column
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS briefing text;

-- Policy: admin and colaborador can update briefing (and other fields)
-- Note: existing policies already cover admin update and user own update.
-- Adding a colaborador update policy:
CREATE POLICY "colaborador_update_submissions"
  ON public.submissions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'colaborador'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'colaborador'::app_role));
