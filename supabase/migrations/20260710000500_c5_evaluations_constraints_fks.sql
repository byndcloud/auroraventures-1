-- ============================================================================
-- C5 — Constraints e FKs que faltavam (T3.2 completo)
-- ============================================================================
-- A T3.2 original cobriu submission_scores/submissions/calls mas deixou
-- evaluations sem ranges e várias colunas *_by/user_id sem FK.

-- 1) Normaliza dados sujos antes dos CHECKs (verdict '' era o DEFAULT antigo)
UPDATE public.evaluations
SET verdict = CASE
  WHEN has_veto THEN 'REPROVADO'
  WHEN final_score > 80 THEN 'Aprovar'
  WHEN final_score >= 60 THEN 'Amadurecer'
  ELSE 'Kill'
END
WHERE verdict = '' AND processing_status = 'completed';

-- 2) Ranges e enum em evaluations
ALTER TABLE public.evaluations DROP CONSTRAINT IF EXISTS chk_evaluations_final_score_range;
ALTER TABLE public.evaluations
  ADD CONSTRAINT chk_evaluations_final_score_range
  CHECK (final_score >= 0 AND final_score <= 100);

ALTER TABLE public.evaluations DROP CONSTRAINT IF EXISTS chk_evaluations_verdict;
ALTER TABLE public.evaluations
  ADD CONSTRAINT chk_evaluations_verdict
  CHECK (verdict IN ('REPROVADO', 'Aprovar', 'Amadurecer', 'Kill', ''));
-- '' permanece válido apenas para linhas pending/processing (IA em andamento)

-- 3) FKs ausentes (NOT VALID valida só daqui pra frente; VALIDATE em seguida
--    confirma o legado sem travar a tabela em lock longo)
ALTER TABLE public.evaluations DROP CONSTRAINT IF EXISTS evaluations_author_id_fkey;
ALTER TABLE public.evaluations
  ADD CONSTRAINT evaluations_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL
  NOT VALID;
ALTER TABLE public.evaluations VALIDATE CONSTRAINT evaluations_author_id_fkey;

ALTER TABLE public.chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_user_id_fkey;
ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
  NOT VALID;
ALTER TABLE public.chat_sessions VALIDATE CONSTRAINT chat_sessions_user_id_fkey;

-- readouts.created_by pode conter profiles.id legado — corrige antes da FK
UPDATE public.readouts r
SET created_by = p.user_id
FROM public.profiles p
WHERE r.created_by = p.id
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.created_by);

ALTER TABLE public.readouts DROP CONSTRAINT IF EXISTS readouts_created_by_fkey;
ALTER TABLE public.readouts
  ADD CONSTRAINT readouts_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
  NOT VALID;
ALTER TABLE public.readouts VALIDATE CONSTRAINT readouts_created_by_fkey;
