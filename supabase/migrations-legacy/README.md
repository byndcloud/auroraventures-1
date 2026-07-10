# Migrations legadas (histórico do projeto original)

Estas 59 migrations documentam a evolução do banco no projeto original (Lovable).
**NÃO devem ser executadas no projeto novo**: o schema completo já vem do restore
do backup (`auroraventures_260710.backup`, formato pg_dump custom).

O fluxo do banco neste repositório é:

1. Criar o projeto Supabase novo.
2. Restaurar o backup (`pg_restore`) — traz schema + dados + policies + triggers.
3. Aplicar apenas as migrations de `supabase/migrations/` (série `20260710*`),
   que corrigem os problemas conhecidos do schema original.

Mantidas aqui somente como referência histórica e para auditoria.
