
-- T3.2: CHECK constraints + NOT NULL nos campos obrigatórios; ranges válidos em scores

-- 1. Normalizar verdict='' (único dado sujo confirmado — DEFAULT original era '')
UPDATE public.submission_scores SET verdict = 'Kill' WHERE verdict = '';

-- 2. submission_scores.final_score: range obrigatório 0–100
ALTER TABLE public.submission_scores
  ADD CONSTRAINT chk_final_score_range
  CHECK (final_score >= 0 AND final_score <= 100);

-- 3. submission_scores.verdict: enum de 4 valores válidos
ALTER TABLE public.submission_scores
  ADD CONSTRAINT chk_verdict_enum
  CHECK (verdict IN ('REPROVADO', 'Aprovar', 'Amadurecer', 'Kill'));

-- 4. submissions.status: 7 fases do Kanban (KANBAN_PHASES em kanban.ts)
ALTER TABLE public.submissions
  ADD CONSTRAINT chk_submission_status
  CHECK (status IN (
    'Discovery & Pitch',
    'Submissões',
    'Screening',
    'Proposta',
    'Ongoing',
    'Handover',
    'Despriorizado'
  ));

-- 5. calls.call_type: apenas os tipos suportados
ALTER TABLE public.calls
  ADD CONSTRAINT chk_calls_call_type
  CHECK (call_type IN ('mercado', 'interno'));

-- 6. calls.visibility: público ou privado
ALTER TABLE public.calls
  ADD CONSTRAINT chk_calls_visibility
  CHECK (visibility IN ('publica', 'privada'));

-- 7. calls.status: ciclo de vida da chamada
ALTER TABLE public.calls
  ADD CONSTRAINT chk_calls_status
  CHECK (status IN ('ativa', 'encerrada'));

-- 8. readouts.submission_id: FK ausente — risco de orphan records
ALTER TABLE public.readouts
  ADD CONSTRAINT readouts_submission_id_fk
  FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE;
