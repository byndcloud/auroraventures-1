-- ============================================================================
-- Migration: Adiciona categoria de reunião (general | ongoing)
-- ============================================================================
-- Permite separar visualmente as reuniões da aba "Reuniões" normal das
-- reuniões da aba "Ongoing" (que aparece quando a iniciativa está na fase
-- 'Ongoing' do Kanban). A aba Ongoing reusa toda a lógica de upload +
-- geração de ata pelo Volund OS.
--
-- Coexistência:
--   - meetings.category = 'general' (default) — aba "Reuniões"
--   - meetings.category = 'ongoing'           — aba "Ongoing"
--
-- Backfill: todos os registros existentes ganham 'general' automaticamente
-- pelo DEFAULT.
--
-- Rollback (manual): ver bloco no fim do arquivo.
-- ============================================================================

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

COMMENT ON COLUMN public.meetings.category IS
  'general (aba Reuniões) | ongoing (aba Ongoing, fase pós-investimento)';

-- CHECK constraint: valores aceitos
ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_category_check;

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_category_check
    CHECK (category IN ('general', 'ongoing'));

-- Índice composto para queries da UI (filtrar reuniões de uma iniciativa
-- por categoria com ordem por data — usado em ambas as abas)
CREATE INDEX IF NOT EXISTS meetings_submission_category_date_idx
  ON public.meetings (submission_id, category, meeting_date DESC);

-- ============================================================================
-- ROLLBACK (manual)
-- ============================================================================
-- DROP INDEX IF EXISTS meetings_submission_category_date_idx;
-- ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_category_check;
-- ALTER TABLE public.meetings DROP COLUMN IF EXISTS category;
