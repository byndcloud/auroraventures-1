-- ============================================================================
-- C1 — Correções de enum e constraint de chamadas
-- ============================================================================
-- (a) Garante o valor 'viewer' no enum app_role. No banco original ele existia
--     apenas no banco vivo (nunca ganhou migration versionada); esta migration
--     torna o estado reprodutível. IF NOT EXISTS = idempotente.
-- (b) O CHECK chk_calls_status (T3.2) só permitia ('ativa','encerrada'), mas a
--     UI de admin (ChamadaForm/CallsManager) trabalha com 'rascunho' — salvar
--     rascunho estourava a constraint. Recria o CHECK incluindo 'rascunho'.
--
-- IMPORTANTE: ALTER TYPE ADD VALUE funciona dentro de transação (PG 12+),
-- mas o valor recém-adicionado NÃO pode ser referenciado na MESMA transação.
-- Por isso 'viewer'::app_role só aparece em C2, C3 e C8 (migrations separadas,
-- portanto transações distintas). NÃO consolidar C1 com essas migrations —
-- o db push aborta com "unsafe use of new value 'viewer' of enum type app_role".

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';

ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS chk_calls_status;
ALTER TABLE public.calls
  ADD CONSTRAINT chk_calls_status
  CHECK (status IN ('rascunho', 'ativa', 'encerrada'));

-- Rascunho nunca pode vazar para leitura pública/autenticada: as policies
-- existentes já exigem status='ativa' para não-admins, então nenhuma mudança
-- de RLS é necessária aqui.
