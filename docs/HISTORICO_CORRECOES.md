# Histórico de correções

Catálogo dos bugs e débitos herdados do projeto original (Lovable) que foram
corrigidos nesta recriação. Complementa o
[`BLUEPRINT_RECRIACAO.md`](BLUEPRINT_RECRIACAO.md) §8 (débitos catalogados) e as
[ADRs](adr/) (decisões estruturantes).

Para o que **ainda está pendente**, veja [`FOLLOWUPS.md`](FOLLOWUPS.md).

---

## 1. Fluxos quebrados corrigidos na recriação inicial

- **DashboardViewer sem policy RLS** (retornava vazio) → policy de SELECT para
  viewer.
- **Abas Reuniões / Checkpoint / Histórico vazias para colaborador** em
  `/iniciativa/:id` → policies de SELECT para colaborador.
- **Transcrições "sumiam"** (signed URL expirada + bucket errado no download) →
  coluna `transcript_path` com backfill; download assina o path sob demanda.
- **"Salvar Rascunho" de chamadas estourava o CHECK do banco** → CHECK inclui
  `rascunho`.
- **Chamadas respondidas nunca apareciam no dashboard** (`profiles.id` usado
  como `user_id`) → auth uid em `useCallsForDashboard` e `calls.created_by`.
- **`/dashboard-founder` reativado** (página, redirect pós-login, e-mail e e2e
  coerentes).

---

## 2. Correções de segurança na recriação inicial

- **Edge Function `sign-transcripts`** (sem autenticação + service_role) —
  **removida**.
- **OAuth Google via Lovable** substituído pelo provider nativo do Supabase.
- **CORS** das functions configurável por secret `CORS_ORIGIN`.
- **`.env`** fora do git; view `role_audit_divergences` para auditar roles
  herdados.

---

## 3. Higiene (recriação inicial)

- Tabela legada **`submission_scores`** dropada (MCP migrado para
  `evaluations`); bucket órfão `meeting-transcripts` removido.
- **CHECKs/FKs faltantes** em `evaluations`, `chat_sessions`, `readouts`.
- **`confirm()` nativo → `AlertDialog`**; avatar hardcoded removido; validação
  do wizard alinhada com a UI; dependências Lovable e lockfiles duplicados
  removidos; script `typecheck` e porta de dev unificada (5173).

---

## 4. Branch `fixes/tech-debt-triage` (2026-07-20)

Fecha 12 pendências críticas + altas da auditoria pós-recriação. Task:
[2026-07-20-fixes-tech-debt-triage](task-history/2026-07-20-fixes-tech-debt-triage.md).

### 4.1 Segurança de banco / RLS

- **`call_responses.INSERT`** hardened: exige `auth.uid() = user_id`,
  `LOWER(respondent_email) = LOWER(auth.email())`, `call.status = 'ativa'`,
  `call.deadline IS NULL OR call.deadline >= CURRENT_DATE`. Fecha CVE
  potencial de spoofing e resposta em chamada expirada.
- **`week_documents.mime_type`** `NOT NULL` (backfill defensivo para
  `application/octet-stream`).
- Migration: `supabase/migrations/20260720000000_fixes_p0_rls_and_integrity.sql`.

### 4.2 Scorecard — fonte única server-side (ADR-0001)

- `public.compute_evaluation_verdict(scores, submission_type)` + trigger
  `evaluations_recompute_verdict_trigger` em `public.evaluations`.
- Front (`src/components/admin/scorecard.ts`) e Edge Function
  (`volund-evaluation-callback`) deixaram de calcular; front usa apenas
  `preview*` para exibição enquanto o admin preenche.
- `supabase/functions/_shared/scorecard-schema.ts` centraliza a metadata para
  o normalizador do callback.
- Migration: `supabase/migrations/20260720000100_compute_evaluation_verdict.sql`.
- ADR: [0001-scorecard-single-source-postgres](adr/0001-scorecard-single-source-postgres.md).

### 4.3 Atribuição de role via tabela (ADR-0003)

- `public.role_assignment_rules` + `resolve_role_for_email()` +
  `handle_new_user` refactored.
- Seed inicial contempla `rodrigo.miranda`, `filipe.moreira`,
  `liliane.oliveira` como `admin` + domínios `beyondcompany.com.br`,
  `extreme.digital`, `volund.com.br` como `colaborador`.
- Script `scripts/seed-role-rules.ts` (idempotente) faz UPSERT das regras E
  reconcilia usuários existentes (promove sem rebaixar).
- Migration: `supabase/migrations/20260720000200_role_assignment_rules.sql`.
- ADR: [0003-role-assignment-rules-table](adr/0003-role-assignment-rules-table.md).

### 4.4 Edge Functions

- **`_shared/cors.ts`**: removido o fallback `?? "*"`. Fail-fast quando
  `CORS_ORIGIN` ausente (loga erro + headers vazios; primeira request devolve
  500 CORS-blocked).
- **`initiative-mcp`**: importa CORS do `_shared` e complementa com headers MCP.
- **`send-confirmation-email`**: adiciona handler `OPTIONS` + `corsHeaders`.
- **`evaluate-with-ai`, `copilot-chat`, `upload-meetings`**: `userClient` migrou
  de `SERVICE_ROLE` para `ANON_KEY` — RLS agora se aplica sobre o JWT do
  usuário; `admin` client separado só para mutações privilegiadas.

### 4.5 Frontend — AuthContext sem fallback silencioso

- Removido `?? "founder"` em `AuthContext.tsx`. Ausência de linha em
  `user_roles` = `profile.role = null` + `roleError = true` + `console.error`.
- `ProtectedRoute` redireciona para `/acesso-negado` quando `role === null`.
- `AccessDenied` diferencia "sem role atribuída" de "role sem permissão".

### 4.6 TypeScript strict

- `tsconfig.app.json` e `tsconfig.json` com `strict: true`,
  `noImplicitAny: true`, `strictNullChecks: true`. Zero erros de typecheck.
- Correções pontuais em `CallsManager`, `Admin`, `IniciativaDetalhe`,
  `Header`, `HeroSection`, `Login`.

### 4.7 Hooks TanStack Query compartilhados

- `src/features/submissions/hooks/`: `useSubmissionsWithScores`,
  `useMySubmissions`, `useEvaluations`, `useMeetings`, `useOngoingWeeks`.
- `Admin.tsx`, `DashboardViewer.tsx`, `DashboardFounder.tsx` e
  `DashboardColaborador.tsx` consomem os hooks — elimina os 4 fetches
  duplicados de `submissions.select(...)`.

### 4.8 Mapa único de labels

- `SubmissionDetails.tsx` deixou de definir maps locais e importa
  `buildLabelMap()` de `src/lib/submission-field-labels.ts`. Fallback
  legado (`papel` etc.) fica isolado em `FOUNDER_LEGACY_LABELS`.

### 4.9 PDF via `window.print()` (ADR-0002)

- Removida a rasterização com `html2canvas-pro` + `jspdf` (400+ KB gzip).
- Botão "Exportar PDF" agora chama `window.print()`; CSS `@media print` em
  `src/index.css` cuida do papel (fundo branco, cards com borda, chrome
  escondido).
- ADR: [0002-pdf-window-print-interim](adr/0002-pdf-window-print-interim.md).

### 4.10 Testes

- **Unit (Vitest)**: `src/lib/roles.test.ts` cobre os 4 roles + fallback;
  `src/contexts/AuthContext.test.tsx` cobre os 3 caminhos de resolução (role
  presente, ausente, profile ausente).
- **e2e (Playwright)**: `e2e/rls-founder-isolation.spec.ts` (XMPVAS0HE) e
  `e2e/rls-call-responses.spec.ts` (4 casos: OK, e-mail spoof, encerrada,
  deadline passada).
- **CI**: job `e2e` opcional (gated por variable `RUN_E2E=true`) que instala
  Playwright + roda os specs com secrets do projeto Supabase de staging.

### 4.11 Monólitos — marcadores (parcial)

Os 4 arquivos com >700L (`CheckpointMeetingsSection`, `IniciativaDetalhe`,
`MeetingsTab`, `VestingWeeklySection`) receberam header `TODO(monolith-split)`
nomeando os subcomponentes-alvo. A quebra completa foi cortada por risco de
regressão sem cobertura visual e migrou para
[`FOLLOWUPS.md`](FOLLOWUPS.md) · "Monolith split".
