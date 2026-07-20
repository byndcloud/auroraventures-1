# Setup do banco — schema from scratch

O banco deste projeto é criado **do zero** por 8 migrations consolidadas em
`supabase/migrations/`. Não há mais dependência do backup `pg_dump` do
ambiente original.

> **Histórico:** as migrations antigas (uma-por-mudança) do projeto original
> estão preservadas em `supabase/migrations-legacy/` apenas como referência.
> **Não executar.** O estado final delas já está embutido nas 8 migrations
> consolidadas.

## 1. Criar o projeto Supabase novo

1. [supabase.com](https://supabase.com) → New project (região: `sa-east-1` se
   o público é BR). Guarde a senha do Postgres.
2. Anote o **project ref** (na URL do dashboard) e as chaves em
   Settings → API (`anon` e `service_role`).
3. Atualize `supabase/config.toml` (`project_id = "..."`) e `.env` com as chaves.

## 2. Aplicar as migrations

```bash
supabase login
supabase link --project-ref [PROJECT_REF]
supabase db push
```

As 8 migrations rodam em ordem cronológica (`20260710000000_..` → `20260710000700_..`):

| # | Arquivo | Domínio |
|---|---|---|
| 00 | `20260710000000_base.sql` | Extensões (`pgcrypto`), função `update_updated_at_column()` |
| 01 | `20260710000100_auth_roles_profiles.sql` | Enum `app_role` (com `viewer`), `profiles`, `user_roles`, `has_role()`, `handle_new_user()`, sync/prevent triggers, view `role_audit_divergences` |
| 02 | `20260710000200_submissions_and_history.sql` | `submissions`, `submission_history`, kanban CHECK, RLS por role (admin/colaborador/viewer/founder) |
| 03 | `20260710000300_meetings_ongoing_storage.sql` | `meetings` (com todas colunas Volund + `transcript_path`), `ongoing_weeks`, `week_documents`, buckets `transcripts` e `week-documents` |
| 04 | `20260710000400_evaluations_chat_readouts.sql` | `evaluations` (substitui `submission_scores`), `chat_sessions`/`chat_messages` (copilot), `readouts` |
| 05 | `20260710000500_open_calls.sql` | `calls` (status `rascunho`\|`ativa`\|`encerrada`), `call_fields`, `call_responses` |
| 06 | `20260710000600_vesting_and_ongoing_share.sql` | `vesting_indicators`, `vesting_measurements` (com `value_before`), `vesting_week_notes`, `ongoing_share_links` + RPC `get_public_ongoing` |
| 07 | `20260710000700_workspace_tasks.sql` | Painel interno de tarefas do produto (rota `/admin` workspace) |

Cada arquivo tem no cabeçalho um bloco `Consolida:` listando as migrations
legacy que foram absorvidas, além de `Descartes:` com o que foi
deliberadamente removido (data-fixes, versões inseguras substituídas, etc.).

## 3. Popular dados iniciais (opcional)

O schema nasce **vazio** — sem chamadas de exemplo, sem roles pré-atribuídas.
Fluxos automáticos:

- **Signup** → `handle_new_user()` cria linha em `profiles` e atribui a role
  automaticamente pelo domínio do email:
  - `admin`: emails literais `rodrigo.miranda@beyondcompany.com.br` e
    `filipe.moreira@beyondcompany.com.br`
  - `colaborador`: qualquer `@beyondcompany.com.br`, `@extreme.digital`,
    `@volund.com.br`
  - `founder`: qualquer outro domínio

- **Ajuste manual de role**: via Dashboard Supabase → Table Editor →
  `public.user_roles` (o trigger `sync_user_role_to_profile` propaga
  automaticamente para `profiles.role`).

Um seed script (chamadas de exemplo, atribuição de `viewer` para stakeholders
específicos) está registrado como follow-up em [FOLLOWUPS.md](./FOLLOWUPS.md).

## 4. Configurar Auth

Em Authentication → Settings do projeto novo:

1. **Site URL** = domínio do front (e adicionar em Redirect URLs).
2. **E-mail**: confirmar signup habilitado.
3. **Google OAuth**: criar credenciais próprias no
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   (OAuth client ID, tipo Web) com redirect
   `https://[PROJECT_REF].supabase.co/auth/v1/callback`, e habilitar o
   provider Google com esse client id/secret.

## 5. Secrets e deploy das Edge Functions

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

## 6. Validar

1. `SELECT * FROM role_audit_divergences;` — deve estar vazia inicialmente
   (só é útil quando roles são editadas manualmente contra a regra do domínio).
2. Fazer signup com um email `@beyondcompany.com.br` → confirmar que a linha
   apareceu em `profiles` E em `user_roles` com role `colaborador`.
3. Fazer signup com um email externo → deve virar `founder`.
4. Testar navegação nas rotas `/admin`, `/dashboard-colaborador`,
   `/dashboard-founder`, `/dashboard-viewer`.
5. Rodar `npm run test:e2e` para cobrir o fluxo end-to-end de auth + kanban.
