-- ============================================================================
-- 00 · BASE — extensões e utilitários compartilhados
-- ============================================================================
-- Fundação usada por todas as migrations subsequentes. Definida separada para
-- evitar dependência circular quando um domínio quer a função de trigger que
-- outro define. Roda primeiro na ordem cronológica (_00000_).
-- ============================================================================

-- pgcrypto: gen_random_uuid() é usado em todas as PKs. Já vem habilitado por
-- padrão em projetos Supabase, mas o CREATE EXTENSION IF NOT EXISTS é
-- idempotente e torna a migration reproduzível em qualquer Postgres 13+.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Trigger genérico que atualiza a coluna updated_at para now() antes de cada
-- UPDATE. Usado por profiles, submissions, meetings, ongoing_weeks,
-- chat_sessions, evaluations, readouts, calls, vesting_measurements,
-- vesting_week_notes, ongoing_share_links e workspace_tasks.
--
-- SECURITY: função de trigger interna, não deve ser chamada por role
-- autenticado ou anônimo — revoga EXECUTE após criar.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
