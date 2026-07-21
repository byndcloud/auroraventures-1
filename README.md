# AURORA — Plataforma de Inovação (Beyond Company / Extreme Group)

Portal de venture building: funil de iniciativas (mercado, internas, editais) com
submissão → avaliação por scorecard (manual + IA Volund OS) → kanban de 7 fases →
acompanhamento Ongoing/vesting → handover. Inclui gestão de open calls, reuniões
com atas geradas por IA, copilot por iniciativa e board interno (WorkSpace).

Este repositório é a recriação do projeto original (gerado no Lovable) com os
débitos técnicos e fluxos quebrados corrigidos. O racional completo está em
[`docs/BLUEPRINT_RECRIACAO.md`](docs/BLUEPRINT_RECRIACAO.md). Histórico de
correções e follow-ups: [`docs/HISTORICO_CORRECOES.md`](docs/HISTORICO_CORRECOES.md)
· [`docs/FOLLOWUPS.md`](docs/FOLLOWUPS.md).

## Stack

- **Front:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Query
  + @dnd-kit + Framer Motion + Recharts
- **Back:** Supabase (Postgres + Auth + RLS + Storage + Edge Functions + Realtime)
- **IA:** agentes Volund OS (avaliação de scorecard, atas de reunião, copilot) via
  Edge Functions com callbacks HMAC

## Setup

### 1. Banco de dados

Siga [`docs/SETUP_BANCO.md`](docs/SETUP_BANCO.md): criar o projeto Supabase,
aplicar as migrations (`supabase db push`) e configurar Auth (Google OAuth
próprio + Site URL). O schema é criado do zero — não há backup a restaurar; as
roles são atribuídas por regra via `role_assignment_rules` (ver §3 do setup).

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
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | unit (Vitest) |
| `npm run test:e2e` | Playwright (requer `.env.test` com `SUPABASE_SERVICE_ROLE_KEY`) |
| `npm run gen:types` | regenera `src/integrations/supabase/types.ts` do projeto linkado |
| `npm run seed:roles` | UPSERT idempotente em `role_assignment_rules` + reconciliação de `user_roles` |

Após o `db push` + configuração de Auth, rode `npm run gen:types` para os tipos
refletirem o schema real.

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
  features/            # domínios (hooks TanStack Query compartilhados)
  lib/                 # roles, labels de campos, utils
supabase/
  migrations/          # migrations consolidadas — schema completo do projeto
  migrations-legacy/   # histórico do projeto original (NÃO executar)
  functions/           # Edge Functions (Volund, e-mail, MCP)
scripts/               # seed de roles + utilitários
docs/                  # blueprint da recriação, setup do banco, ADRs, task-history
e2e/                   # Playwright (auth por role, RLS)
```

## Convenções importantes

- **Permissão é decidida no servidor (RLS).** `ProtectedRoute` e checks de role no
  front são apenas UX.
- Fases do kanban são strings exatas (case-sensitive): `Discovery & Pitch`,
  `Submissões`, `Screening`, `Proposta`, `Ongoing`, `Handover`, `Despriorizado`.
- Enums em português no banco (`ativa`, `publica`, `mercado`, `interna`...).
- Payload dos formulários vive em `submissions.data` (JSONB) com chaves técnicas
  mapeadas em `src/lib/submission-field-labels.ts`.
- Novas admin/viewer entram por `scripts/seed-role-rules.ts` — sem migration nova.
