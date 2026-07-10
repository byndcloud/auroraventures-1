-- Migration 1: vesting_indicators table
CREATE TABLE IF NOT EXISTS public.vesting_indicators (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id    UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  name             TEXT NOT NULL CHECK (length(trim(name)) > 0),
  goal_description TEXT NOT NULL CHECK (length(trim(goal_description)) > 0),
  weight           NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 100),
  status           TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente','em_andamento','em_risco','atingido','nao_atingido')),
  target_value     NUMERIC,
  current_value    NUMERIC,
  unit             TEXT,
  direction        TEXT NOT NULL DEFAULT 'gte' CHECK (direction IN ('gte','lte')),
  progress_pct     NUMERIC(5,2) CHECK (progress_pct IS NULL OR (progress_pct >= 0 AND progress_pct <= 100)),
  owner_name       TEXT,
  evidence_url     TEXT,
  notes            TEXT,
  display_order    INTEGER,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vesting_indicators TO authenticated;
GRANT ALL ON public.vesting_indicators TO service_role;

CREATE INDEX IF NOT EXISTS vesting_indicators_submission_idx
  ON public.vesting_indicators (submission_id, display_order NULLS LAST, created_at);

ALTER TABLE public.vesting_indicators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage vesting_indicators" ON public.vesting_indicators;
CREATE POLICY "Admins manage vesting_indicators"
  ON public.vesting_indicators FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Leadership reads vesting_indicators" ON public.vesting_indicators;
CREATE POLICY "Leadership reads vesting_indicators"
  ON public.vesting_indicators FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS update_vesting_indicators_updated_at ON public.vesting_indicators;
CREATE TRIGGER update_vesting_indicators_updated_at
  BEFORE UPDATE ON public.vesting_indicators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migration 2: seed Zelar vesting indicators (idempotent)
INSERT INTO public.vesting_indicators
  (submission_id, name, goal_description, weight, status, target_value, unit, direction, display_order)
SELECT s.id, x.name, x.goal_description, x.weight, 'pendente', x.target_value, x.unit, x.direction, x.display_order
FROM public.submissions s
CROSS JOIN (VALUES
  ('Serviços completados (com avaliação registrada)',
   '≥ 200 serviços realizados e avaliados', 4.00::numeric, 200::numeric, 'serviços', 'gte', 1),
  ('Número de clientes ativos',
   '≥ 150 clientes únicos com ao menos 1 serviço concluído', 4.00::numeric, 150::numeric, 'clientes', 'gte', 2),
  ('Profissionais qualificados ativos',
   '≥ 27 profissionais com perfil verificado com pelo menos 1 serviço concluído', 4.00::numeric, 27::numeric, 'profissionais', 'gte', 3),
  ('CAC real 3 primeiras vendas',
   'CAC real das 3 primeiras vendas documentadas', 4.00::numeric, NULL::numeric, 'R$', 'lte', 4),
  ('ROAS sobre receita bruta',
   '≥ 1,5x', 4.00::numeric, 1.5::numeric, 'x', 'gte', 5)
) AS x(name, goal_description, weight, target_value, unit, direction, display_order)
WHERE s.project_name ILIKE '%zelar%'
  AND NOT EXISTS (
    SELECT 1 FROM public.vesting_indicators vi
    WHERE vi.submission_id = s.id AND vi.name = x.name
  );

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';