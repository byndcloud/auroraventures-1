-- ============================================================================
-- 07 · WORKSPACE TASKS (backlog interno do time — tela /admin workspace)
-- ============================================================================
-- Consolida: 20260603174519 (base).
--   Painel administrativo de tarefas do próprio produto (ajustes/melhorias/
--   features solicitadas). Só admin acessa (rota /admin, WorkspaceBoard.tsx).
--
-- Descartes:
--   • 20260603182207 (UPDATE tem_decisao_aberta para external_ids específicos):
--     data fix pontual daquele momento, não faz sentido em schema from scratch.
--
-- Pré-requisitos: has_role(), update_updated_at_column(), app_role enum.
-- ============================================================================

CREATE TABLE public.workspace_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id       TEXT UNIQUE NOT NULL,
  tipo              TEXT NOT NULL
                      CHECK (tipo IN ('ajuste','melhoria','nova')),
  perfil            TEXT NOT NULL,
  screen            TEXT,
  route             TEXT,
  area              TEXT,
  title             TEXT NOT NULL,
  description       TEXT,
  comentario        TEXT,
  status            TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente','em_andamento','aceita','rejeitada','concluida')),
  priority          TEXT NOT NULL DEFAULT 'P2'
                      CHECK (priority IN ('P0','P1','P2','P3')),
  quick_win         BOOLEAN NOT NULL DEFAULT false,
  tem_decisao_aberta BOOLEAN NOT NULL DEFAULT false,
  depends_on        TEXT[] NOT NULL DEFAULT '{}',
  merged_from       TEXT,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX workspace_tasks_priority_idx
  ON public.workspace_tasks (priority) WHERE deleted_at IS NULL;

CREATE INDEX workspace_tasks_area_idx
  ON public.workspace_tasks (area) WHERE deleted_at IS NULL;

CREATE TRIGGER workspace_tasks_updated_at
  BEFORE UPDATE ON public.workspace_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ----------------------------------------------------------------------------
-- Policies RLS — só admin acessa
-- ----------------------------------------------------------------------------
CREATE POLICY "Admins manage workspace_tasks"
  ON public.workspace_tasks FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


-- ----------------------------------------------------------------------------
-- GRANTs
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_tasks TO authenticated;
GRANT ALL                            ON public.workspace_tasks TO service_role;

REVOKE ALL ON public.workspace_tasks FROM anon;
