
-- Update default status to match Kanban phase
ALTER TABLE public.submissions ALTER COLUMN status SET DEFAULT 'Submissões';

-- Fix existing submissions with old default status
UPDATE public.submissions SET status = 'Submissões' WHERE status = 'Em Avaliação';
