
-- Part 1: meetings.category
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

COMMENT ON COLUMN public.meetings.category IS
  'general (aba Reuniões) | ongoing (aba Ongoing, fase pós-investimento)';

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_category_check;

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_category_check
    CHECK (category IN ('general', 'ongoing'));

CREATE INDEX IF NOT EXISTS meetings_submission_category_date_idx
  ON public.meetings (submission_id, category, meeting_date DESC);

-- Part 2: ongoing_weeks table
CREATE TABLE IF NOT EXISTS public.ongoing_weeks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  display_order INTEGER,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ongoing_weeks IS
  'Semanas da aba Ongoing — agrupam reuniões durante a fase pós-investimento';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ongoing_weeks TO authenticated;
GRANT ALL ON public.ongoing_weeks TO service_role;

CREATE INDEX IF NOT EXISTS ongoing_weeks_submission_idx
  ON public.ongoing_weeks (submission_id, display_order NULLS LAST, created_at);

ALTER TABLE public.ongoing_weeks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage ongoing_weeks" ON public.ongoing_weeks;
CREATE POLICY "Admins manage ongoing_weeks"
  ON public.ongoing_weeks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Part 3: meetings.week_id FK
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS week_id UUID
    REFERENCES public.ongoing_weeks(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.meetings.week_id IS
  'NULL para reuniões da aba Reuniões. Preenchido com a semana correspondente para reuniões da aba Ongoing.';

CREATE INDEX IF NOT EXISTS meetings_week_id_idx
  ON public.meetings (week_id) WHERE week_id IS NOT NULL;
