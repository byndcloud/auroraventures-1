-- Revoga privilégios do role `anon` em profiles e user_roles.
--
-- Diagnóstico (2026-06-23): SELECT em information_schema.role_table_grants
-- mostrou que `anon` tinha DELETE, INSERT, REFERENCES, SELECT, TRIGGER,
-- TRUNCATE e UPDATE em ambas as tabelas. Provavelmente sequela de algum
-- `GRANT ALL ... TO PUBLIC` ad-hoc rodado durante debug.
--
-- Estas tabelas só fazem sentido para usuários autenticados:
--   - profiles: cada usuário lê/atualiza a própria linha (RLS auth.uid()=user_id).
--   - user_roles: cada usuário lê o próprio role; admin escreve.
--
-- A RLS já barra na prática, mas privilégio sobrando no `anon` é armadilha
-- esperando uma policy mal escrita pra virar buraco. Defesa em profundidade.

REVOKE ALL ON public.profiles  FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
