# AURORA — Plataforma de Inovação (Beyond Company / Extreme Group)

Portal de venture building: funil de iniciativas (mercado, internas, editais) com
submissão → avaliação por scorecard (manual + IA Volund OS) → kanban de 7 fases →
acompanhamento Ongoing/vesting → handover. Inclui gestão de open calls, reuniões com
atas geradas por IA, copilot por iniciativa e board interno (WorkSpace).

Este repositório é a recriação do projeto original (gerado no Lovable) com os débitos
técnicos e fluxos quebrados corrigidos. O racional completo está em
[`docs/BLUEPRINT_RECRIACAO.md`](docs/BLUEPRINT_RECRIACAO.md).

## Stack

- **Front:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Query
  + @dnd-kit + Framer Motion + Recharts
- **Back:** Supabase (Postgres + Auth + RLS + Storage + Edge Functions + Realtime)
- **IA:** agentes Volund OS (avaliação de scorecard, atas de reunião, copilot) via
  Edge Functions com callbacks HMAC

## Setup

### 1. Banco de dados

Siga [`docs/SETUP_BANCO.md`](docs/SETUP_BANCO.md): criar o projeto Supabase,
aplicar as 8 migrations consolidadas (`supabase db push`) e configurar Auth
(Google OAuth próprio + Site URL). O schema é criado do zero — não há
backup a restaurar; as roles são atribuídas automaticamente por domínio
de email no signup.

### 2. Frontend

```bash
npm install
cp .env.example .env    # preencher com URL e anon key do projeto novo
npm run dev             # http://localhost:5173
```

### 3. Scripts

| Script | Função |
|---|---|
| `npm run dev` | dev server (porta 5173) |
| `npm run build` | build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | unit (Vitest) |
| `npm run test:e2e` | Playwright (requer `.env.test` com `SUPABASE_SERVICE_ROLE_KEY`) |
| `npm run gen:types` | regenera `src/integrations/supabase/types.ts` do projeto linkado |

Após o restore + migrations, rode `npm run gen:types` para os tipos refletirem o
schema real (remove a necessidade dos casts `as any` remanescentes).

## O que foi corrigido em relação ao projeto original

**Fluxos quebrados**
- DashboardViewer sem policy RLS (retornava vazio) → policy de SELECT para viewer.
- Abas Reuniões/Checkpoint/Histórico vazias para colaborador em `/iniciativa/:id`
  → policies de SELECT para colaborador.
- Transcrições "sumiam" (signed URL expirada + bucket errado no download)
  → coluna `transcript_path` com backfill; download assina o path sob demanda.
- "Salvar Rascunho" de chamadas estourava o CHECK do banco → CHECK inclui `rascunho`.
- Chamadas respondidas nunca apareciam no dashboard (`profiles.id` usado como
  `user_id`) → auth uid em `useCallsForDashboard` e `calls.created_by`.
- `/dashboard-founder` reativado (página, redirect pós-login, e-mail e e2e coerentes).

**Segurança**
- Edge Function `sign-transcripts` (sem autenticação + service_role) **removida**.
- OAuth Google via Lovable substituído pelo provider nativo do Supabase.
- CORS das functions configurável por secret `CORS_ORIGIN`.
- `.env` fora do git; view `role_audit_divergences` para auditar roles herdados.

**Higiene**
- Tabela legada `submission_scores` dropada (MCP migrado para `evaluations`);
  bucket órfão `meeting-transcripts` removido.
- CHECKs/FKs faltantes em `evaluations`, `chat_sessions`, `readouts`.
- `confirm()` nativo → `AlertDialog`; avatar hardcoded removido; validação do
  wizard alinhada com a UI; dependências Lovable e lockfiles duplicados removidos;
  script `typecheck` e porta de dev unificada (5173).

## Estrutura

```
src/
  pages/               # rotas (landing, login, dashboards, wizards, admin, iniciativa)
  components/
    admin/             # kanban, scorecard, reuniões, ongoing/vesting, workspace
    submission*/       # steps dos 3 wizards
    dashboard/         # carrossel de chamadas
    landing/           # seções da landing
    ui/                # shadcn/ui
  contexts/AuthContext # sessão + role (fonte: user_roles; RLS decide permissão)
  lib/                 # roles, labels de campos, utils
supabase/
  migrations/          # 8 migrations consolidadas — schema completo do projeto
  migrations-legacy/   # histórico do projeto original (NÃO executar)
  functions/           # 7 Edge Functions (Volund, e-mail, MCP)
docs/                  # blueprint da recriação + setup do banco
e2e/                   # Playwright (fluxo de auth por role)
```

## Convenções importantes

- **Permissão é decidida no servidor (RLS).** `ProtectedRoute` e checks de role no
  front são apenas UX.
- Fases do kanban são strings exatas (case-sensitive): `Discovery & Pitch`,
  `Submissões`, `Screening`, `Proposta`, `Ongoing`, `Handover`, `Despriorizado`.
- Enums em português no banco (`ativa`, `publica`, `mercado`, `interna`...).
- Payload dos formulários vive em `submissions.data` (JSONB) com chaves técnicas
  mapeadas em `src/lib/submission-field-labels.ts`.
