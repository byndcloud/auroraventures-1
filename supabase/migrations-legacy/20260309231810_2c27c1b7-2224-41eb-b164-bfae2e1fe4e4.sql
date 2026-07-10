
CREATE TABLE public.submission_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_score numeric NOT NULL DEFAULT 0,
  has_veto boolean NOT NULL DEFAULT false,
  verdict text NOT NULL DEFAULT '',
  evaluated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.submission_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select scores"
  ON public.submission_scores FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert scores"
  ON public.submission_scores FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update scores"
  ON public.submission_scores FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Also allow admins to update submission status (for moving cards)
CREATE POLICY "Admins can update all submissions"
  ON public.submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
