-- ============================================================================
-- 04 · EVALUATIONS + CHAT (COPILOT) + READOUTS
-- ============================================================================
-- Consolida:
--   • evaluations base — 20260610130000
--   • Redefinição idempotente + GRANTs — 20260610174148
--   • C5 embutido: author_id NULLABLE + FK ON DELETE SET NULL; CHECKs range
--     0..100 em final_score e enum de verdict incluindo '' vazia
--   • chat_sessions + chat_messages — 20260609003338
--   • chat_sessions.volund_run_id + chat_messages.metadata — 20260609013456
--   • C5 embutido: chat_sessions.user_id FK ON DELETE CASCADE
--   • readouts — 20260502010602
--   • T3.2 embutido: readouts.submission_id FK ON DELETE CASCADE
--   • C5 embutido: readouts.created_by FK ON DELETE SET NULL
--
-- Descartes (C7 embutido):
--   • submission_scores — tabela legada substituída por evaluations. Como o
--     schema é from scratch, apenas não é criada. Nenhum backfill.
--
-- Pré-requisitos: has_role(), update_updated_at_column(), app_role enum,
-- public.submissions.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. evaluations
-- Suporta N avaliações por submission (1 IA + várias manuais).
-- ----------------------------------------------------------------------------
CREATE TABLE public.evaluations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     UUID NOT NULL
                       REFERENCES public.submissions(id) ON DELETE CASCADE,

  -- C5: NULLABLE + FK ON DELETE SET NULL.
  -- Objetivo: DELETE em auth.users não pode abortar por uma avaliação
  -- historicamente atribuída a esse usuário.
  author_id         UUID
                       REFERENCES auth.users(id) ON DELETE SET NULL,

  source            TEXT NOT NULL
                       CHECK (source IN ('ai', 'manual')),
  scores            JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- C5: range 0..100
  final_score       NUMERIC NOT NULL DEFAULT 0
                       CHECK (final_score >= 0 AND final_score <= 100),

  has_veto          BOOLEAN NOT NULL DEFAULT false,

  -- C5: enum de verdicts. '' permanece válido para linhas em pending/processing
  -- (IA rodando; verdict só é preenchido pela app após o callback).
  verdict           TEXT NOT NULL DEFAULT ''
                       CHECK (verdict IN ('REPROVADO','Aprovar','Amadurecer','Kill','')),

  descriptions      JSONB,
  report            TEXT,
  summary           TEXT,
  volund_run_id     TEXT,
  processing_status TEXT NOT NULL DEFAULT 'completed'
                       CHECK (processing_status IN ('pending','processing','completed','failed')),
  error_message     TEXT,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.evaluations
  IS 'Avaliações de scorecard de uma submission. Suporta N avaliações (1 IA + várias manuais)';
COMMENT ON COLUMN public.evaluations.author_id
  IS 'auth.users.id do autor. NULLABLE: delete de auth.users seta NULL (histórico preservado)';
COMMENT ON COLUMN public.evaluations.source
  IS 'ai = agente Volund OS · manual = admin preencheu na UI';
COMMENT ON COLUMN public.evaluations.scores
  IS 'Notas 0-10 por chave de SCORECARD_META + flags veto_<key>: bool';
COMMENT ON COLUMN public.evaluations.processing_status
  IS 'Manuais entram completed. IA: pending → processing → completed/failed';

CREATE INDEX evaluations_submission_id_idx
  ON public.evaluations (submission_id, created_at DESC);

CREATE UNIQUE INDEX evaluations_volund_run_id_unique_idx
  ON public.evaluations (volund_run_id)
  WHERE volund_run_id IS NOT NULL;

CREATE INDEX evaluations_processing_status_idx
  ON public.evaluations (processing_status)
  WHERE processing_status NOT IN ('completed');

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER evaluations_updated_at
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ----------------------------------------------------------------------------
-- 2. chat_sessions (copilot da iniciativa)
-- ----------------------------------------------------------------------------
CREATE TABLE public.chat_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL
                    REFERENCES public.submissions(id) ON DELETE CASCADE,

  -- C5: FK ON DELETE CASCADE. Delete de auth.users limpa as sessões do usuário.
  user_id        UUID NOT NULL
                    REFERENCES auth.users(id) ON DELETE CASCADE,

  title          TEXT NOT NULL DEFAULT 'Nova conversa',
  volund_run_id  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_sessions_submission
  ON public.chat_sessions (submission_id, created_at DESC);
CREATE INDEX idx_chat_sessions_user
  ON public.chat_sessions (user_id, created_at DESC);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ----------------------------------------------------------------------------
-- 3. chat_messages
-- ----------------------------------------------------------------------------
CREATE TABLE public.chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL
                 REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL
                 CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session
  ON public.chat_messages (session_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 4. readouts
-- ----------------------------------------------------------------------------
CREATE TABLE public.readouts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- T3.2: FK CASCADE inline
  submission_id  UUID NOT NULL
                    REFERENCES public.submissions(id) ON DELETE CASCADE,

  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',

  -- C5: FK inline, NULLABLE + ON DELETE SET NULL
  created_by     UUID
                    REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_readouts_submission_id
  ON public.readouts (submission_id);

ALTER TABLE public.readouts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_readouts_updated_at
  BEFORE UPDATE ON public.readouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ----------------------------------------------------------------------------
-- 5. Policies RLS — evaluations
-- ----------------------------------------------------------------------------

CREATE POLICY "Admins manage evaluations"
  ON public.evaluations FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Colaboradores read evaluations"
  ON public.evaluations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'colaborador'::public.app_role));

CREATE POLICY "Viewers read evaluations"
  ON public.evaluations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'::public.app_role));

-- Founders leem só o scorecard das PRÓPRIAS submissions
CREATE POLICY "Founders read own submission evaluations"
  ON public.evaluations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'founder'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = evaluations.submission_id
        AND s.user_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 6. Policies RLS — chat_sessions e chat_messages
-- ----------------------------------------------------------------------------

CREATE POLICY "Owner manages own chat_sessions"
  ON public.chat_sessions FOR ALL TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and colaboradores read all chat_sessions"
  ON public.chat_sessions FOR SELECT TO authenticated
  USING (
       public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );

CREATE POLICY "Owner manages own chat_messages"
  ON public.chat_messages FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = chat_messages.session_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = chat_messages.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and colaboradores read all chat_messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
       public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );


-- ----------------------------------------------------------------------------
-- 7. Policies RLS — readouts
-- ----------------------------------------------------------------------------

CREATE POLICY "beyondco_view_readouts"
  ON public.readouts FOR SELECT TO authenticated
  USING (
       public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );

CREATE POLICY "viewer_view_readouts"
  ON public.readouts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'viewer'::public.app_role));

CREATE POLICY "beyondco_insert_readouts"
  ON public.readouts FOR INSERT TO authenticated
  WITH CHECK (
       public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );

CREATE POLICY "beyondco_update_readouts"
  ON public.readouts FOR UPDATE TO authenticated
  USING (
       public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  )
  WITH CHECK (
       public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );

-- Nome herdado do legado; USING sempre incluiu colaborador (não só admin) —
-- readouts são artefatos colaborativos.
CREATE POLICY "admin_delete_readouts"
  ON public.readouts FOR DELETE TO authenticated
  USING (
       public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );


-- ----------------------------------------------------------------------------
-- 8. GRANTs / REVOKEs
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluations   TO authenticated;
GRANT ALL                            ON public.evaluations   TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_sessions TO authenticated;
GRANT ALL                            ON public.chat_sessions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL                            ON public.chat_messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.readouts      TO authenticated;
GRANT ALL                            ON public.readouts      TO service_role;

REVOKE ALL ON public.evaluations   FROM anon;
REVOKE ALL ON public.chat_sessions FROM anon;
REVOKE ALL ON public.chat_messages FROM anon;
REVOKE ALL ON public.readouts      FROM anon;
