CREATE TABLE public.readouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_readouts_submission_id ON public.readouts(submission_id);

ALTER TABLE public.readouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beyondco_view_readouts"
ON public.readouts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'colaborador'::app_role));

CREATE POLICY "viewer_view_readouts"
ON public.readouts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "beyondco_insert_readouts"
ON public.readouts
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'colaborador'::app_role));

CREATE POLICY "beyondco_update_readouts"
ON public.readouts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'colaborador'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'colaborador'::app_role));

CREATE POLICY "admin_delete_readouts"
ON public.readouts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'colaborador'::app_role));

CREATE TRIGGER update_readouts_updated_at
BEFORE UPDATE ON public.readouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();