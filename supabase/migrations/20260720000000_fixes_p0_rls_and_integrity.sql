-- ============================================================================
-- FIXES P0 · RLS de call_responses + integridade de week_documents
-- ============================================================================
-- Fecha 2 dívidas críticas apuradas na auditoria de 2026-07-20:
--
-- 1. call_responses.INSERT: a policy autoriza qualquer respondent_email e não
--    valida a janela da chamada. Permite:
--      - spoofing de e-mail (respondent_email arbitrário no INSERT);
--      - resposta em chamada 'encerrada' ou 'rascunho';
--      - resposta após deadline expirar.
--    Reescreve a policy exigindo call ativa + prazo válido + e-mail do JWT.
--
-- 2. week_documents.mime_type: NULLABLE herdado da consolidação — o front
--    grava sempre com valor; forçar NOT NULL evita drift futuro.
--
-- Reversível: comentários no fim do arquivo mostram o rollback.
-- Pré-requisitos: 20260710000300 (week_documents), 20260710000500 (calls +
--                 call_responses).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. call_responses: policy de INSERT endurecida
-- ----------------------------------------------------------------------------
-- Descarta a policy antiga (só validava user_id).
DROP POLICY IF EXISTS "authenticated_insert_responses" ON public.call_responses;

-- Nova policy: exige chamada ativa dentro do prazo, e-mail casando com o JWT
-- e user_id casando com auth.uid(). auth.email() vem do JWT — não é possível
-- forjar pelo cliente. LOWER() garante case-insensitive na comparação.
CREATE POLICY "authenticated_insert_responses"
  ON public.call_responses FOR INSERT
  TO authenticated
  WITH CHECK (
        auth.uid() = user_id
    AND LOWER(respondent_email) = LOWER(COALESCE(auth.email(), ''))
    AND EXISTS (
      SELECT 1 FROM public.calls c
      WHERE c.id = call_responses.call_id
        AND c.status = 'ativa'
        AND (c.deadline IS NULL OR c.deadline >= CURRENT_DATE)
    )
  );

COMMENT ON POLICY "authenticated_insert_responses" ON public.call_responses IS
  'INSERT só se: user_id = auth.uid(), respondent_email = auth.email() (case-insensitive), e chamada ativa dentro do prazo.';


-- ----------------------------------------------------------------------------
-- 2. week_documents.mime_type NOT NULL
-- ----------------------------------------------------------------------------
-- Backfill defensivo: qualquer linha antiga com NULL recebe um MIME genérico.
-- Em bases limpas (from-scratch) o UPDATE é NO-OP.
UPDATE public.week_documents
   SET mime_type = 'application/octet-stream'
 WHERE mime_type IS NULL;

ALTER TABLE public.week_documents
  ALTER COLUMN mime_type SET NOT NULL;

COMMENT ON COLUMN public.week_documents.mime_type IS
  'MIME type do arquivo. NOT NULL — o front sempre grava com valor; default seguro é application/octet-stream.';


-- ============================================================================
-- Rollback (referência — não executar como parte da migration):
--
--   DROP POLICY IF EXISTS "authenticated_insert_responses" ON public.call_responses;
--   CREATE POLICY "authenticated_insert_responses"
--     ON public.call_responses FOR INSERT TO authenticated
--     WITH CHECK (auth.uid() = user_id);
--
--   ALTER TABLE public.week_documents ALTER COLUMN mime_type DROP NOT NULL;
-- ============================================================================
