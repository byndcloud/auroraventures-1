---
task: Branch de fixes técnicos — triage da dívida herdada + reorganização de docs
data: 2026-07-20
tipo: refactor
rota: via Advisor
skills_usados: [security-auditor, backend-architect, frontend, qa-test-strategist]
---

## Contexto

Auditoria pós-recriação apurou ~22 pendências. Esta branch (`fixes/tech-debt-triage`)
cobre as **12 críticas + altas**; o restante foi para [`docs/FOLLOWUPS.md`](../FOLLOWUPS.md).
Plano em `.cursor/plans/fixes_tech-debt_triage_aedbd4a3.plan.md`.

## Decisões tomadas

- **Scorecard: fonte única no Postgres via trigger** — ADR-0001. Front e Edge Function
  só gravam `scores`; `compute_evaluation_verdict()` + trigger recalculam
  `final_score/has_veto/verdict`. Elimina duplicação em 3 lugares.
- **PDF: `window.print()` como interim** — ADR-0002. Puppeteer/Browserless fica para
  depois (bundle -400 KB gzip; fidelidade nativa do browser).
- **Role assignment via tabela** — ADR-0003. `role_assignment_rules` + script
  `seed:roles` idempotente. Novos admins/viewers sem migration.
- **AuthContext sem fallback silencioso `founder`** — role ausente = `roleError=true`
  + `console.error` + redirect para `/acesso-negado`. Nunca inferir role.
- **`_shared/cors.ts` fail-fast** — sem `CORS_ORIGIN`, cai em 500 (não mais em `*`).
- **`userClient` nas Edge Functions com `ANON_KEY`** — RLS aplica sobre o JWT do
  usuário; `admin` client separado só para operações privilegiadas.
- **TS strict + `noImplicitAny` + `strictNullChecks`** — todos ativos, typecheck limpo.
  Restaram 66 warnings (`as any` residuais) rastreados em `FOLLOWUPS.md §4`.
- **Monolith split: escape hatch acionado** — 4 arquivos > 700L receberam
  header `TODO(monolith-split)` nomeando os subcomponentes-alvo, mas a extração
  completa migrou para `FOLLOWUPS.md §3`. Motivo: sem cobertura Playwright
  visual, quebrar 3.9k linhas seria risco de regressão silenciosa. O próprio
  plano previa esse cutoff.

## Padrões aplicados

- **Regra de negócio central vive no banco** (não em duas runtimes).
  Aplicável a qualquer fórmula persistida em coluna (evaluations, futuras).
- **Table-driven config** para regras que mudam sem deploy (role assignment).
- **Hook TanStack Query por domínio**, em `src/features/<domínio>/hooks/`.
  Elimina fetches manuais duplicados entre páginas.
- **`preview*` naming** para funções cliente que espelham lógica autoritativa
  do servidor — deixa explícito quem é fonte de verdade.
- **RLS-first Edge Function**: `userClient` com `ANON_KEY`, `admin` client
  isolado. Nunca reutilizar `admin` para leitura user-facing.
- **Fail-fast em config crítica** (`CORS_ORIGIN` sem fallback `*`).
- **`FOUNDER_LEGACY_LABELS` isolado** — quando adaptar código legado ao mapa
  canônico, extrair as exceções para um mapa nomeado, não sujar o canônico.
- **CI e2e gated por variable** (`vars.RUN_E2E`) — evita quebrar PRs de fork
  sem secrets do Supabase.

## Warnings abertos

- **ESLint: 66 warnings** — `as any` residuais + fast-refresh export + unused
  vars pré-existentes. `frontend`. Meta: promover `no-explicit-any` para
  `error` após `gen:types` limpo. Registro: `FOLLOWUPS.md §4`.
- **Monolith split incompleto** — headers `TODO(monolith-split)` aplicados,
  mas 4 arquivos permanecem > 700L. `frontend`. Registro: `FOLLOWUPS.md §3`.
- **e2e não executado localmente** — sem `SUPABASE_SERVICE_ROLE_KEY` no
  ambiente Windows PowerShell. `qa-test-strategist`. CI cobre quando
  `RUN_E2E=true`.
- **Bundle > 500 KB** — Vite warning. `frontend`. Code-splitting fora do
  escopo desta triage.
- **CRLF → LF** — todos os arquivos tocados vão sofrer conversão no próximo
  clone Linux. Cosmético.

## Dependências criadas

Módulos e contratos que agora dependem do que foi implementado:

- **`public.compute_evaluation_verdict(jsonb, text)`** — fonte da verdade do
  scorecard. Qualquer mudança de peso ou veto exige alterar esta função +
  o espelho de metadata em `src/components/admin/scorecard.ts`.
- **Trigger `evaluations_recompute_verdict_trigger`** — todo INSERT/UPDATE
  em `evaluations` recalcula. Seed / correção manual respeitam automaticamente.
- **`public.role_assignment_rules`** — nova tabela. `handle_new_user` e view
  `role_audit_divergences` dependem dela. Novas regras via
  `scripts/seed-role-rules.ts`.
- **`public.resolve_role_for_email(text)`** — chamada por `handle_new_user`,
  view de auditoria, e pelo script de reconciliação.
- **`src/features/submissions/hooks/*`** — 4 páginas de dashboard consomem.
  Alterações de payload/tipos aqui propagam para o Kanban admin e viewers.
- **`_shared/cors.ts`** exige `CORS_ORIGIN` — se cair na produção, todas as
  Edge Functions param.
- **`AuthContext.roleError`** — novo estado; qualquer novo consumidor deve
  tratar `role === null` como bloqueio, não como default.

## Follow-ups

Todos rastreados em [`FOLLOWUPS.md`](../FOLLOWUPS.md):

- §3 Monolith split completo (4 arquivos)
- §4 `as any` residuais + promover ESLint rule
- §5 Polling residual no Copilot / EvaluationsTab (migrar para Realtime)
- §6 Dead-code shadcn Toaster + @hugeicons + metas Lovable
- §7 PDF server-side com Puppeteer (substituir window.print interim)
- §8 Cobertura Playwright: submissão, kanban DnD, scorecard, deadline
- §9 Rotação de chaves Supabase se `.env` original vazou

## ADRs geradas

- [0001 — Scorecard single source Postgres](../adr/0001-scorecard-single-source-postgres.md)
- [0002 — PDF window.print interim](../adr/0002-pdf-window-print-interim.md)
- [0003 — Role assignment rules table](../adr/0003-role-assignment-rules-table.md)

## Migrations criadas

- `20260720000000_fixes_p0_rls_and_integrity.sql`
- `20260720000100_compute_evaluation_verdict.sql`
- `20260720000200_role_assignment_rules.sql`

## Commits (12 na branch)

```
0a79348 chore(deps): +tsx, -html2canvas-pro, -jspdf; +seed:roles script
45bb56a docs: enxuga README + HISTORICO_CORRECOES.md + FOLLOWUPS.md ampliado
09308b7 test: unit AuthContext + roles + e2e RLS founder isolation + call_responses
d0743f8 chore(monolith): marca 3 arquivos > 700L para split futuro
56bef97 refactor(pdf): substitui html2canvas-pro + jspdf por window.print()
56c9f0a refactor(labels): SubmissionDetails usa buildLabelMap do mapa canônico
c3e8a89 refactor(data): hooks TanStack Query compartilhados + optimistic DnD
59262d4 fix(auth): remove fallback silencioso founder + ativa TS strict
b5ec418 fix(edge): CORS fail-fast + userClient com ANON_KEY nas Edge Functions
05c680f feat(auth): atribuição de role via tabela role_assignment_rules
757d313 refactor(scorecard): move fórmula para Postgres via trigger (fonte única)
db8c7de fix(rls): endurece INSERT em call_responses e forca mime_type NOT NULL
```
