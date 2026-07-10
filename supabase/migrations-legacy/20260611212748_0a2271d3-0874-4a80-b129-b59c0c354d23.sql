CREATE TABLE IF NOT EXISTS public.vesting_measurements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  indicator_id  UUID NOT NULL REFERENCES public.vesting_indicators(id) ON DELETE CASCADE,
  week_number   INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 12),
  value         NUMERIC,
  status        TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','em_andamento','em_risco','atingido','nao_atingido')),
  comment       TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (indicator_id, week_number)
);

COMMENT ON TABLE public.vesting_measurements IS
  'Medição semanal de um indicador de vesting (12 semanas fixas dos 90 dias)';
COMMENT ON COLUMN public.vesting_measurements.week_number IS
  'Semana 1-12 do período de vesting — eixo próprio, independente de ongoing_weeks';
COMMENT ON COLUMN public.vesting_measurements.value IS
  'Valor medido na semana, na mesma unidade de vesting_indicators.unit';

CREATE INDEX IF NOT EXISTS vesting_measurements_submission_week_idx
  ON public.vesting_measurements (submission_id, week_number);
CREATE INDEX IF NOT EXISTS vesting_measurements_indicator_idx
  ON public.vesting_measurements (indicator_id, week_number);

CREATE TABLE IF NOT EXISTS public.vesting_week_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  week_number   INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 12),
  difficulties  TEXT,
  highlights    TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (submission_id, week_number)
);

COMMENT ON TABLE public.vesting_week_notes IS
  'Dificuldades e destaques de cada semana do período de vesting (12 semanas)';

CREATE INDEX IF NOT EXISTS vesting_week_notes_submission_idx
  ON public.vesting_week_notes (submission_id, week_number);

CREATE OR REPLACE FUNCTION public.set_vesting_weekly_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vesting_measurements_updated_at ON public.vesting_measurements;
CREATE TRIGGER vesting_measurements_updated_at
  BEFORE UPDATE ON public.vesting_measurements
  FOR EACH ROW EXECUTE FUNCTION public.set_vesting_weekly_updated_at();

DROP TRIGGER IF EXISTS vesting_week_notes_updated_at ON public.vesting_week_notes;
CREATE TRIGGER vesting_week_notes_updated_at
  BEFORE UPDATE ON public.vesting_week_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_vesting_weekly_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vesting_measurements TO authenticated;
GRANT ALL ON public.vesting_measurements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vesting_week_notes TO authenticated;
GRANT ALL ON public.vesting_week_notes TO service_role;

ALTER TABLE public.vesting_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vesting_week_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage vesting_measurements" ON public.vesting_measurements;
CREATE POLICY "Admins manage vesting_measurements"
  ON public.vesting_measurements FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Leadership reads vesting_measurements" ON public.vesting_measurements;
CREATE POLICY "Leadership reads vesting_measurements"
  ON public.vesting_measurements FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins manage vesting_week_notes" ON public.vesting_week_notes;
CREATE POLICY "Admins manage vesting_week_notes"
  ON public.vesting_week_notes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Leadership reads vesting_week_notes" ON public.vesting_week_notes;
CREATE POLICY "Leadership reads vesting_week_notes"
  ON public.vesting_week_notes FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );