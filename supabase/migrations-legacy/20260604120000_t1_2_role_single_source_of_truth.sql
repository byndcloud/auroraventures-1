-- T1.2 / T1.3 — profiles.role como campo derivado; user_roles é a única fonte de verdade
--
-- O que fecha:
--   Porta A) sync_user_role_to_profile: qualquer INSERT/UPDATE em user_roles
--            propaga automaticamente para profiles.role (SECURITY DEFINER,
--            sem precisar de privilégio especial no caller).
--   Porta B) prevent_profile_role_change (endurecida): bloqueia TODA escrita
--            direta em profiles.role — inclusive de admin. A única exceção
--            é o próprio trigger de sync (detectado via pg_trigger_depth() >= 2).
--
-- Efeito líquido:
--   • Admins mudam role via user_roles → trigger propaga → profiles.role nunca diverge.
--   • Nenhum UPDATE direto em profiles.role vinga, independente do chamador.
--   • A subscription Realtime em user_roles (AuthContext) detecta a mudança
--     e re-faz o fetchProfile sem exigir re-login.

-- ── 1. Realtime: habilitar publicação em user_roles ───────────────────────────
-- REPLICA IDENTITY FULL permite filtros por coluna no canal Realtime
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  END IF;
END $$;

-- ── 2. Função de sync: user_roles → profiles.role ────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_user_role_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET role = NEW.role
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_user_role_to_profile_trigger ON public.user_roles;
CREATE TRIGGER sync_user_role_to_profile_trigger
  AFTER INSERT OR UPDATE OF role ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_role_to_profile();

-- ── 3. prevent_profile_role_change endurecido ────────────────────────────────
-- Antes: só bloqueava não-admins (admins podiam escrever direto).
-- Agora: bloqueia qualquer chamador fora do cascade do trigger de sync.
--
-- pg_trigger_depth() indica o nível de aninhamento de triggers:
--   • UPDATE direto em profiles → prevent roda em depth=1 → bloqueado
--   • sync_user_role_to_profile (depth=1) faz UPDATE profiles →
--     prevent roda em depth=2 → permitido
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'profiles.role é somente-leitura — altere roles via a tabela user_roles.';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 4. Revogar execução direta das funções de trigger ────────────────────────
-- Funções SECURITY DEFINER chamadas apenas pelo mecanismo de trigger.
REVOKE EXECUTE ON FUNCTION public.sync_user_role_to_profile() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_role_change() FROM anon, authenticated, public;

-- ── 5. Sync único: corrigir divergências já existentes ───────────────────────
-- Dispara o trigger sync_user_role_to_profile para cada linha existente,
-- trazendo profiles.role em linha com user_roles.role em toda a base.
-- Parece no-op mas usa o cascade (depth=2) pra passar pelo prevent.
UPDATE public.user_roles SET role = role;
