# AURORA

> Contexto global do projeto para o agente. Leia este arquivo no início de toda sessão.
> Ao fechar decisões em aberto ou mudar a stack, atualize este arquivo imediatamente.

---

## O que é este projeto

Plataforma de inovação da **Beyond Company / Extreme Group** (venture studio).
Centraliza o funil de iniciativas: **submissão → avaliação (scorecard) → decisão →
proposta → acompanhamento (Ongoing/vesting) → handover**. Inclui board interno
(**WorkSpace**), gestão de open calls e copilot contextual por iniciativa.

Este repositório é a **recriação** do projeto original (gerado no Lovable) com os
débitos técnicos e falhas de segurança corrigidos. O racional completo está em
[`docs/BLUEPRINT_RECRIACAO.md`](docs/BLUEPRINT_RECRIACAO.md) — leia-o antes de
qualquer mudança estrutural.

- **3 origens de iniciativa:** `mercado` (startups externas), `interna` (colaboradores),
  `editais` (fomento público)
- **4 verticais:** GovTech, HealthTech, LegalTech, EdTech
- **4 roles:** `admin`, `colaborador`, `founder`, `viewer` (+ público anônimo)
- **Integração de IA:** agentes "Volund OS" via Edge Functions com callback HMAC

---

## Stack

### Frontend
- **Vite** + **React 18** + **TypeScript strict** (não Next.js, não SSR)
- **React Router v6** para roteamento
- **TailwindCSS 3** + **shadcn/ui** (Radix primitives)
- **TanStack Query v5** (cache de servidor) — sem estado global de client além disso
- **React Hook Form** + **Zod** para forms e validação
- **@dnd-kit** para kanban drag & drop
- **framer-motion** para animações
- **Recharts** para gráficos, **date-fns** para datas
- **sonner** para toasts (único), **lucide-react** para ícones (padrão)
- Deploy: a definir

### Backend
- **Supabase** como monolito de backend:
  - **PostgreSQL** com RLS obrigatório em toda tabela com dado de usuário
  - **Auth** (JWT) — Google OAuth via provider nativo do Supabase
  - **Storage** para transcrições e documentos
  - **Edge Functions** (Deno/TypeScript) para integrações Volund OS e e-mail
  - **Realtime** para meetings e (futuramente) copilot/evaluations
- Migrações sempre via **Supabase CLI** em `supabase/migrations/`

### Integrações ativas
- **Volund OS** — agentes de IA (avaliação, atas, copilot) via HTTP + callback HMAC
- **Resend** — e-mails transacionais (`send-confirmation-email`)
- **Google OAuth** — via `supabase.auth.signInWithOAuth({ provider: 'google' })`

### CI/CD
- **GitHub Actions** (`.github/workflows/ci.yml`) — lint + typecheck + build em PRs
- E2E com Playwright — cobertura mínima é auth por role, founder isolation (XMPVAS0HE),
  submissão, kanban DnD, scorecard/veto, deadline de chamadas

---

## Convenções obrigatórias

### Código
- Gerenciador de pacotes: **`npm`** — nunca `pnpm`, `yarn` ou `bun` (há histórico do
  Lovable com 3 lockfiles simultâneos; um só é a regra)
- **Um** lockfile: `package-lock.json`
- Linguagem do código e identificadores: **inglês**
- Conteúdo voltado ao usuário e copy: **PT-BR**
- TypeScript strict — `any`/`as any` é dívida herdada e deve ser reduzida, não
  ampliada; ESLint marca como warning (meta: promover para error)
- Porta dev única: **5173** (Vite e Playwright alinhados)

### Banco de dados
- Toda mudança de schema via **migração SQL** em `supabase/migrations/` — nunca pelo
  dashboard, nunca em `supabase/migrations-legacy/` (essa pasta é histórico do Lovable
  e não deve rodar)
- **RLS obrigatório** em qualquer tabela com dado de usuário
- Roles vivem em `user_roles` com função `SECURITY DEFINER` `has_role()`
- Nunca armazenar role em `profiles`
- GRANT mínimo a `authenticated`; **nenhum** GRANT a `anon` exceto EXECUTE nas RPCs
  públicas explicitamente marcadas como tal

### Segurança
- Segredos nunca commitados — `.env` está no `.gitignore` (o original vazou no git; se
  chaves de projeto Supabase foram expostas, rotacionar)
- Nunca chamar Volund OS ou Resend diretamente do frontend — sempre via Edge Function
- CORS das Edge Functions restrito ao domínio da aplicação via secret `CORS_ORIGIN` —
  nunca `Access-Control-Allow-Origin: *`
- Webhooks (`volund-callback`, `volund-evaluation-callback`, `initiative-mcp`) usam
  `verify_jwt = false` **apenas** por serem HMAC-validados; declarar sempre no
  `supabase/config.toml`
- Service role só em webhooks; nas demais Edge Functions, usar o client com JWT do
  usuário para RLS valer
- Nunca logar PII (e-mail, nome completo) sem mascarar

### Frontend
- **shadcn/ui** é o design system — componentes em `src/components/ui/` são gerados,
  não editar sem consultar upstream; extensões vão para `src/components/`
- Um só sistema de toast (`sonner`), um só set de ícones (`lucide-react` — legado
  `@hugeicons/react` fica só onde já existe, sem espalhar)
- Acessibilidade: **WCAG AA** mínimo (contraste, foco visível, labels, teclado)
- Nenhum componente > ~300 linhas — monólitos herdados (ex.: `IniciativaDetalhe`,
  `CheckpointMeetingsSection`) devem ser quebrados ao serem tocados

### Commits e PRs
- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`
- PRs exigem **1 aprovação humana** + CI verde (lint, typecheck, build; testes conforme
  aplicável)
- Descrição do PR inclui: link para a task, checklist de impactos (DB, RLS, Edge Function,
  Volund OS)
- Sem código no `main` sem CI verde

### Decisões arquiteturais
- Ao introduzir escolha de lib, provider externo ou mudança de padrão: criar **ADR** em
  [`docs/adr/NNNN-titulo.md`](docs/adr/) (ver README dessa pasta)
- Ao concluir uma task: registrar resumo em
  [`docs/task-history/YYYY-MM-DD-slug.md`](docs/task-history/) e atualizar
  [`docs/task-history/_index.md`](docs/task-history/_index.md)

---

## Padrões de implementação

### Cliente Supabase
Um único cliente em [`src/integrations/supabase/client.ts`](src/integrations/supabase/client.ts)
consumido como `import { supabase } from "@/integrations/supabase/client"`.

- Nunca instanciar `createClient` inline em componentes
- Todo acesso a dados **via hooks TanStack Query** — nunca `fetch` manual em componentes;
  há histórico do original com queries duplicadas entre `Admin.tsx` e `DashboardViewer.tsx`
- Sempre `select` com colunas explícitas + `.limit()` + paginação em listas que crescem
  (kanban, respostas de chamadas, avaliações)
- Realtime em vez de polling (o original tem `setInterval(3000)` no copilot e
  `setInterval(4000)` em avaliações — não replicar)
- Zero `as any` novos: regenerar tipos com `npm run gen:types` após qualquer mudança de
  schema

### Auth no front (apenas UX — segurança é RLS)
- Role lido de `user_roles`, **nunca** de `profiles.role`
- **Sem fallback silencioso para `founder`**: ausência de role é estado de erro, não
  default (no original o fallback silencioso mascarava falha do trigger)
- [`ProtectedRoute`](src/components/ProtectedRoute.tsx) por `allowedRoles` — apenas UX;
  RLS é a fonte da verdade de permissão
- Redirect pós-login por role via `getDashboardPath()` em
  [`src/lib/roles.ts`](src/lib/roles.ts)

### Edge Functions
- Vivem em [`supabase/functions/`](supabase/functions/); shared em `_shared/`
- Toda function que não é webhook: JWT + `has_role(...)` na primeira linha
- Callbacks HMAC: validar assinatura + ser idempotentes por `volund_run_id`
- Documentar todos os secrets num `.env.example` de funções (sem valores)

### Fases do Kanban (case-sensitive, strings exatas no banco)
```
Discovery & Pitch → Submissões → Screening → Proposta → Ongoing → Handover
                                     └→ Despriorizado (kill/veto)
```
Enums em PT no banco (`ativa`, `publica`, `mercado`, `interna`, `editais`, `rascunho`,
`encerrada`, etc.). Não traduzir para EN sem migração + atualização coordenada de UI.

### Payload de submissões
Vive em `submissions.data` (JSONB). As chaves técnicas são mapeadas para labels PT-BR
em [`src/lib/submission-field-labels.ts`](src/lib/submission-field-labels.ts) — este é
o **único** mapa de labels; não criar paralelo.

### Motor do scorecard
Fórmula: `Nota Final = (Bloco 1 × 0.60) + (Bloco 2 × 0.40)`, cada critério 0–100 × peso
relativo. **Regra de negócio central — preservar exatamente**. Fica em função server-side
única; não duplicar no front (o original tinha lógica duplicada).

---

## O que nunca fazer

- Armazenar role em `profiles` ou decidir permissão no client
- Alterar schema pelo dashboard do Supabase
- Rodar migrations de `supabase/migrations-legacy/` — é histórico do Lovable, caótico
  (tabelas criadas 2–3×, `handle_new_user` reescrita 8×)
- Chamar Volund OS ou Resend diretamente do frontend
- Recriar a Edge Function `sign-transcripts` como estava (sem auth + service_role +
  qualquer path) — se necessária, exigir JWT + admin + validação de path
- Confiar em `raw_user_meta_data->>'role'` do cliente em triggers (auto-elevação a admin)
- Ampliar escopo de uma task sem confirmação explícita
- Introduzir segundo sistema de toast, segundo set de ícones ou segundo mapa de labels
- Commitar `.env` (está no `.gitignore` — não desativar)

---

## Comandos comuns

```bash
npm install
npm run dev                          # dev server em http://localhost:5173
npm run lint && npm run typecheck    # verificação de código
npm run build                        # build de produção
npm test                             # unit (Vitest)
npm run test:e2e                     # e2e (Playwright — requer .env.test)
npm run gen:types                    # regenera src/integrations/supabase/types.ts
```
