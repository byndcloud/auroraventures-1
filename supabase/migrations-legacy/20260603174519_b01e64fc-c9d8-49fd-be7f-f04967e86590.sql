
CREATE TABLE public.workspace_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ajuste','melhoria','nova')),
  perfil text NOT NULL,
  screen text,
  route text,
  area text,
  title text NOT NULL,
  description text,
  comentario text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','aceita','rejeitada','concluida')),
  priority text NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0','P1','P2','P3')),
  quick_win boolean NOT NULL DEFAULT false,
  tem_decisao_aberta boolean NOT NULL DEFAULT false,
  depends_on text[] NOT NULL DEFAULT '{}',
  merged_from text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_tasks TO authenticated;
GRANT ALL ON public.workspace_tasks TO service_role;

ALTER TABLE public.workspace_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view workspace tasks"
  ON public.workspace_tasks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert workspace tasks"
  ON public.workspace_tasks FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update workspace tasks"
  ON public.workspace_tasks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete workspace tasks"
  ON public.workspace_tasks FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER workspace_tasks_updated_at
  BEFORE UPDATE ON public.workspace_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX workspace_tasks_priority_idx ON public.workspace_tasks(priority) WHERE deleted_at IS NULL;
CREATE INDEX workspace_tasks_area_idx ON public.workspace_tasks(area) WHERE deleted_at IS NULL;
