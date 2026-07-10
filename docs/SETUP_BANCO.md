# Setup do banco — restaurar o backup e aplicar as correções

O banco deste projeto nasce do backup completo do ambiente original
(`auroraventures_260710.backup`, formato `pg_dump` custom — inclui `auth.users`,
todo o schema `public` com dados, policies, triggers e os metadados do `storage`).

> ⚠️ **O que o backup NÃO contém:** os **arquivos físicos** dos buckets
> (`transcripts` e `week-documents`). O dump traz apenas as *rows* de
> `storage.objects`. Os arquivos precisam ser copiados à parte (passo 4).

## 1. Criar o projeto Supabase novo

1. [supabase.com](https://supabase.com) → New project (região: `sa-east-1` se o
   público é BR). Guarde a senha do Postgres.
2. Anote o **project ref** (na URL do dashboard) e as chaves em
   Settings → API (`anon` e `service_role`).

## 2. Restaurar o backup

Com o [PostgreSQL client tools](https://www.postgresql.org/download/) instalado
(`pg_restore` 15+):

```bash
# connection string em Settings → Database → Connection string (URI, porta 5432)
pg_restore \
  --dbname "postgresql://postgres:[SENHA]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  --no-owner --no-privileges \
  --clean --if-exists \
  auroraventures_260710.backup
```

Notas:
- Erros de "role does not exist" / objetos internos do Supabase (`auth.schema_migrations`,
  `storage.migrations`, extensões) podem aparecer e são inofensivos — o que importa
  é `auth.users`, `public.*` e `storage.buckets/objects` restaurarem sem erro.
- Se preferir granularidade, restaure por schema: `--schema=auth --schema=public --schema=storage`.
- **Senhas dos usuários são preservadas** (hashes em `auth.users`). O login por
  e-mail/senha continua funcionando.

## 3. Aplicar as migrations corretivas

```bash
supabase login
supabase link --project-ref [PROJECT_REF]   # atualize também supabase/config.toml
supabase db push                            # aplica supabase/migrations/20260710*
```

As 8 migrations corrigem, nesta ordem:

| Migration | O que faz |
|---|---|
| C1 | enum `viewer` garantido + CHECK de `calls.status` com `'rascunho'` (destrava o Salvar Rascunho) |
| C2 | policy de SELECT para viewer em `submissions` (conserta o DashboardViewer) |
| C3 | SELECT para colaborador em `meetings`/`ongoing_weeks`/`week_documents`/`submission_history` + storage (consertam as abas de `/iniciativa/:id`) |
| C4 | `meetings.transcript_path` + backfill (fim das transcrições que somem — a signed URL expirava em 1h) |
| C5 | CHECKs/FKs faltantes em `evaluations`, `chat_sessions`, `readouts` |
| C6 | corrige `calls.created_by` gravado com `profiles.id` |
| C7 | DROP da tabela legada `submission_scores` (com salvaguarda de backfill) + bucket órfão |
| C8 | view `role_audit_divergences` para auditar roles herdados da era insegura |

As migrations antigas do projeto original estão em `supabase/migrations-legacy/`
apenas como referência — **não executar** (o restore já traz o schema).

## 4. Copiar os arquivos do Storage

Os buckets `transcripts` e `week-documents` precisam dos arquivos físicos.
Com acesso ao projeto antigo:

```bash
# exemplo com supabase CLI (repita por bucket)
supabase storage cp -r --linked ss://transcripts ./storage-export/transcripts --project-ref [REF_ANTIGO]
supabase storage cp -r --linked ./storage-export/transcripts ss://transcripts --project-ref [REF_NOVO]
```

(Alternativa: script com `service_role` dos dois projetos usando
`storage.from(...).download()/upload()` — os paths devem ser idênticos, pois as
rows de `storage.objects` e `meetings.transcript_path`/`week_documents.file_path`
já apontam para eles.)

Se os arquivos do projeto antigo não estiverem mais acessíveis, rode
`DELETE FROM storage.objects WHERE bucket_id IN ('transcripts','week-documents')`
para não exibir downloads quebrados — as atas estruturadas (JSONB) continuam no banco.

## 5. Configurar Auth

Em Authentication → Settings do projeto novo:

1. **Site URL** = domínio do front (e adicionar em Redirect URLs).
2. **E-mail**: confirmar signup habilitado (fluxo T1.1).
3. **Google OAuth**: criar credenciais próprias no
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   (OAuth client ID, tipo Web) com redirect
   `https://[PROJECT_REF].supabase.co/auth/v1/callback`, e habilitar o provider
   Google com esse client id/secret. O login antigo era via Lovable; usuários
   Google existentes continuam funcionando desde que o e-mail seja o mesmo.

## 6. Secrets e deploy das Edge Functions

```bash
supabase secrets set \
  VOLUND_API_KEY=... \
  VOLUND_AGENT_ID=... \
  VOLUND_EVALUATION_AGENT_ID=... \
  VOLUND_COPILOT_AGENT_ID=... \
  VOLUND_CALLBACK_SECRET=... \
  MCP_AGENT_API_KEY=... \
  RESEND_API_KEY=... \
  SITE_URL=https://seu-dominio.com \
  CORS_ORIGIN=https://seu-dominio.com

supabase functions deploy evaluate-with-ai
supabase functions deploy volund-evaluation-callback
supabase functions deploy upload-meetings
supabase functions deploy volund-callback
supabase functions deploy copilot-chat
supabase functions deploy send-confirmation-email
supabase functions deploy initiative-mcp
```

> A função `sign-transcripts` do projeto original **não existe mais** — ela não
> tinha autenticação e assinava qualquer arquivo com service_role. O download de
> transcrições agora é feito no client via `transcript_path` + RLS.

## 7. Validar

1. `SELECT * FROM role_audit_divergences;` — corrigir roles divergentes via `user_roles`.
2. Login com um usuário de cada role (admin, colaborador, founder, viewer).
3. Founder A não enxerga submissões do founder B (`npm run test:e2e` cobre auth).
4. Kanban, scorecard (manual + IA), reuniões/upload, ongoing e chamadas.
