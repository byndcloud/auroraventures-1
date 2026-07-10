ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS volund_run_id text;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS metadata jsonb;