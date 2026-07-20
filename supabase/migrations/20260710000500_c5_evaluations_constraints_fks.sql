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
--
-- Pré-condição para ON DELETE SET NULL: evaluations.author_id foi criado como
-- NOT NULL em 20260610130000. Se um auth.users for deletado, o SET NULL viola
-- o NOT NULL e a deleção do usuário aborta. Dropar o NOT NULL preserva o
-- histórico de avaliações (autor vira NULL) sem travar deleções futuras.
ALTER TABLE public.evaluations ALTER COLUMN author_id DROP NOT NULL;

-- Backfill defensivo: se houver author_id órfão (auth.users deletado por fora),
-- o VALIDATE aborta a migration inteira. Zerar antes de criar a FK garante
-- que o VALIDATE passe. Autor original fica registrado só no log/audit.
UPDATE public.evaluations
   SET author_id = NULL
 WHERE author_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = evaluations.author_id);

ALTER TABLE public.evaluations DROP CONSTRAINT IF EXISTS evaluations_author_id_fkey;
ALTER TABLE public.evaluations
  ADD CONSTRAINT evaluations_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL
  NOT VALID;
ALTER TABLE public.evaluations VALIDATE CONSTRAINT evaluations_author_id_fkey;

-- chat_sessions.user_id é NOT NULL — não podemos zerar. Como a semântica
-- pretendida da FK é ON DELETE CASCADE, deletar órfãos legados agora é
-- coerente: seriam apagados de qualquer forma na próxima deleção do usuário.
DELETE FROM public.chat_sessions
 WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = chat_sessions.user_id);

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
