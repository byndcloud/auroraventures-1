# Follow-ups

Tarefas conhecidas que ficam pendentes após a reestruturação do banco
([`SETUP_BANCO.md`](./SETUP_BANCO.md)) e após a branch de fixes
`fixes/tech-debt-triage`. Correções já aplicadas: veja
[`HISTORICO_CORRECOES.md`](HISTORICO_CORRECOES.md).

Priorizar conforme necessidade.

---

## 1. Seed inicial do banco

**Status:** pendente

**Contexto:** o schema (`supabase/migrations/`) sobe vazio. Não há
chamadas, iniciativas ou indicadores de exemplo. Todos os usuários entram
via signup e recebem role pela regra de domínio (`handle_new_user()`).

**Escopo mínimo do seed:**

- **Roles pontuais que fogem da regra de domínio** (ex.: atribuir `viewer`
  a stakeholders externos autorizados) — `INSERT INTO public.user_roles ...`,
  guiado por email/lista aprovada.
- **Chamada inicial** de mercado ativa (título + descrição + 3-5
  `call_fields`), para o formulário público em `/chamadas` não abrir vazio.
- **Indicadores de vesting da Zelar** — 5 marcos padrão (serviços,
  clientes, profissionais, CAC, ROAS). Já existia como
  `supabase/migrations-legacy/20260610120100_seed_zelar_vesting.sql`; era
  idempotente e resolvia `submission_id` por `project_name ILIKE '%zelar%'`.
  Só faz sentido rodar DEPOIS que a iniciativa Zelar for cadastrada — dá pra
  virar um script `npm run seed:zelar` ou uma migration separada opcional
  (não entra no `db push` padrão).

**Como estruturar:**

- Preferência: script Node/TS em `scripts/seed.ts` usando `SUPABASE_SERVICE_ROLE_KEY`.
  Idempotente (usa `ON CONFLICT DO NOTHING` ou `NOT EXISTS`), configurável
  por `.env.seed` (listas de admins/viewers externos).
- Alternativa: migration opcional em `supabase/seeds/` (fora de
  `migrations/`), disparada manualmente.

**Referências:**

- Regra do handle_new_user: `supabase/migrations/20260710000100_auth_roles_profiles.sql` (função `handle_new_user()`)
- Seed Zelar legado: `supabase/migrations-legacy/20260610120100_seed_zelar_vesting.sql`

---

## 2. Regenerar tipos do Supabase

**Status:** pendente

Após o `supabase db push` inicial, rodar:

```bash
npm run gen:types
```

Isso atualiza `src/integrations/supabase/types.ts` para refletir o schema
consolidado. Remove a necessidade de `as any` residuais no código atual (que
foram introduzidos porque o types.ts foi gerado a partir do schema legado).

---

## 3. Monolith split (frontend)

**Status:** parcial (headers `TODO(monolith-split)` aplicados; extração pendente)

**Contexto:** BLUEPRINT §6.5 pede componente ≤300L. 4 arquivos permanecem
acima da meta:

| Arquivo | Linhas | Extração alvo |
|---|---|---|
| `src/components/admin/CheckpointMeetingsSection.tsx` | ~1400 | `WeekAccordion`, `WeekDocumentsList`, `WeekMeetingsList`, `WeekNotesForm` |
| `src/pages/IniciativaDetalhe.tsx` | ~880 | `InitiativeDataTab`, `InitiativeScorecardTab`, `InitiativeMeetingsTab`, `InitiativeOngoingTab`, `InitiativeHistoryTab`, `InitiativeCopilotPanel` |
| `src/components/admin/MeetingsTab.tsx` | ~750 | `MeetingsUploadPanel`, `MeetingAccordion`, `MeetingMinutesViewer` |
| `src/components/admin/VestingWeeklySection.tsx` | ~700 | `VestingProgressChart`, `VestingWeeksMatrix`, `WeekMeasurementsEditor`, `WeekHighlightsForm` |

**Bloqueio para essa branch:** sem cobertura Playwright de regressão visual
para as telas afetadas — quebrar 3.9k linhas sem safety net = risco alto.
Depende primeiro de: (a) spec de smoke Playwright por aba de `/iniciativa/:id`;
(b) spec de kanban DnD; (c) spec de scorecard save.

---

## 4. `as any` residuais (~85) após TypeScript strict

**Status:** aceito como dívida controlada

`strict: true` + `strictNullChecks` + `noImplicitAny` estão ativos. ESLint
mantém `@typescript-eslint/no-explicit-any` como **warning**. Metade dos
casts deve sumir após `npm run gen:types` contra o schema real (types.ts
foi gerado do schema legado).

**Meta:** promover `no-explicit-any` para `error` quando o typecheck estiver
limpo pós-`gen:types`.

---

## 5. Polling residual (Realtime pendente)

- `src/components/admin/InitiativeCopilot.tsx` — `setInterval(3000)` como
  fallback quando canal Realtime cai; não crítico, mas idealmente migrar para
  reconnect explícito.
- `src/components/admin/EvaluationsTab.tsx` — `setInterval(4000)` apenas
  enquanto `processing_status = 'processing'`. Migrar para subscription em
  `evaluations`.

---

## 6. Dead-code / dependências herdadas

- `src/components/ui/toaster.tsx` (shadcn) morto — só `sonner` é usado.
  Dependência `@radix-ui/react-toast` pode sair.
- `@hugeicons/react` + `@hugeicons/core-free-icons` sobrevivem em 5 landing
  components — padrão único é `lucide-react`.
- `index.html` ainda tem metas Lovable + `og:image` de `.lovable.app`.
- `engines` field ausente do `package.json`.

---

## 7. PDF server-side (migração pós-interim)

ADR-0002 escolheu `window.print()` como interim. Alvo original (BLUEPRINT §5.6):
Edge Function com Puppeteer/Browserless que renderiza `/iniciativa/:id/print` e
devolve PDF binário. Motivos para migrar depois:

- Geração agendada / batch (cron).
- Header / footer customizados fiéis à marca.
- Não depende do navegador do usuário.

---

## 8. Cobertura Playwright adicional

Já cobertos: XMPVAS0HE (founder isolation) + RLS `call_responses`. Ainda
faltam:

- Submissão (wizard mercado / interna / editais).
- Kanban DnD (mover card entre colunas + persistência).
- Scorecard/veto (INSERT via UI + trigger recalcula final_score).
- Deadline de chamadas (UI bloqueia envio + RLS backup).

