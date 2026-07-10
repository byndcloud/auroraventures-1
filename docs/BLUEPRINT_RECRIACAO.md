# 🏗️ Aurora — Blueprint de Recriação em Ambiente Limpo

> **Propósito:** documento autocontido para recriar a plataforma Aurora em um novo repositório
> e um novo projeto Supabase, **sem reproduzir os débitos técnicos, bugs e falhas de segurança**
> do repositório original (gerado no Lovable).
>
> Gerado a partir de auditoria completa do código em Julho/2026: 261 arquivos versionados,
> 59 migrations, 8 Edge Functions, 16 páginas, ~118 componentes.
>
> **Fonte da verdade:** este documento foi verificado linha a linha contra o CÓDIGO
> (src/, supabase/), não contra `DOCUMENTATION.md`/`MAPA_USUARIOS_E_FLUXOS.md`, que estão
> desatualizados em pontos relevantes: a 5ª fase do Kanban é **"Ongoing"** (não
> "Incubação"); a rota `/dashboard-founder` está desativada (founder logado vai para a
> landing e o CTA vira "Nova Submissão"); a aba de admin tem 3 abas (Kanban, Chamadas,
> **WorkSpace**); `types.ts` de admin já foi modularizado; a ocultação de chamadas
> vencidas já é feita por RLS; e o painel da iniciativa tem 6 abas + Copilot.
>
> **Como usar:** entregue este documento ao time (ou agente de IA) que fará a reconstrução.
> Ele contém: (§1) estratégia recomendada, (§2) especificação funcional, (§3) modelo de dados
> consolidado, (§4) matriz RLS corrigida, (§5) Edge Functions, (§6) padrões de frontend,
> (§7) tooling, (§8) catálogo de problemas do original que NÃO devem ser repetidos,
> (§9) plano de execução em fases e (§10) checklist de aceite.

---

## 1. Estratégia recomendada: migração limpa, não reescrita do zero

**Não reescreva o produto do zero.** O código de domínio (scorecard, kanban, wizards,
vesting) está funcional e várias dívidas já foram pagas no repo original. Reescrever
tudo reintroduz risco de regressão em regras de negócio sutis (pesos, vetos, fases).

A abordagem com melhor custo/benefício é a **migração limpa em 3 movimentos**:

1. **Banco recriado do zero** — as 59 migrations do Lovable são caóticas (tabelas criadas
   2–3×, policies duplicadas, funções reescritas 8×, enum `viewer` que só existe no banco
   vivo). Gere **uma única migration consolidada** (schema final do §3 + RLS do §4) e
   descarte o histórico.
2. **Frontend portado, não reescrito** — copie o código de domínio para a nova estrutura
   de pastas (§6.1), removendo os acoplamentos ao Lovable e aplicando as correções do §8.
3. **Segurança e tooling corrigidos no dia zero** — antes de qualquer feature: `.env` fora
   do git, Edge Functions autenticadas, TypeScript strict, um único lockfile, CI.

O que **deve** ser reescrito (não portado): a camada de dados (queries espalhadas →
hooks TanStack Query), a autenticação Google (Lovable Auth → Supabase OAuth nativo)
e a exportação de PDF (client-side → server-side).

---

## 2. Especificação funcional

### 2.1 O que é o produto

Aurora é a plataforma de inovação da Beyond Company / Extreme Group (venture studio).
Centraliza o funil de iniciativas: **submissão → avaliação (scorecard) → decisão →
proposta → acompanhamento (ongoing/vesting) → handover**. Há também um board interno
(**WorkSpace**) para tasks de evolução da própria plataforma.

- **3 origens de iniciativa:** `mercado` (startups externas), `interna` (colaboradores),
  `editais` (fomento público).
- **4 verticais de foco:** GovTech, HealthTech, LegalTech, EdTech.
- **Integração de IA:** agentes "Volund OS" para avaliação por scorecard, geração de atas
  de reunião a partir de transcrições, e copilot contextual por iniciativa (via Edge
  Functions com callback HMAC).

### 2.2 Perfis (roles)

| Role | Quem é | Atribuição | Dashboard |
|---|---|---|---|
| `admin` | Gestores da plataforma | E-mails específicos via trigger (ver §3.4 — usar tabela seed, não hardcode) | `/admin` |
| `colaborador` | Time interno Beyond/Extreme | Domínios `@beyondcompany.com.br`, `@extreme.digital`, `@volund.com.br` | `/dashboard-colaborador` |
| `founder` | Empreendedor externo | Default (qualquer outro e-mail) | `/dashboard-founder` |
| `viewer` | Observador read-only (diretoria) | Manual (admin atribui) | `/dashboard-viewer` |
| anônimo | Público | — | Landing, `/chamadas`, `/ongoing/:token` |

**Regra de ouro:** o role autoritativo vive em `user_roles` no Postgres, atribuído por
trigger no signup. O front **nunca** decide permissão — apenas roteia UX. A segurança
real é 100% RLS.

### 2.3 Mapa de rotas

| Rota | Acesso | Função |
|---|---|---|
| `/` | público | Landing institucional; CTA adapta por role |
| `/login` | público | E-mail/senha + Google OAuth + registro com confirmação |
| `/acesso-negado` | público | Acesso negado + redirect automático |
| `/chamadas` | público | Open calls ativas (RLS já oculta vencidas para todos os perfis) |
| `/chamadas/:id` | público | Responder chamada (formulário dinâmico) |
| `/ongoing/:token` | público (token revogável) | Acompanhamento read-only do vesting via RPC |
| `/dashboard-founder` | founder, admin | Minhas submissões + carrossel de chamadas (⚠️ rota comentada no original — decidir se volta) |
| `/dashboard-colaborador` | colaborador, admin | Ideias internas + editais + chamadas |
| `/dashboard-viewer` | viewer, admin | Kanban read-only (⚠️ quebrado no original: falta policy RLS, §8/B5) |
| `/submissaomercado` | founder, admin | Wizard 6 etapas |
| `/submissaointerna` | colaborador, admin | Wizard 5 etapas |
| `/submissaoeditais` | colaborador, admin | Wizard 6 etapas |
| `/iniciativa/:id` | admin, colaborador | Página consolidada + PDF |
| `/admin` | admin | Centro de Comando: abas Kanban, Chamadas, WorkSpace |
| `/admin/chamadas/nova` e `/:id/editar` | admin | CRUD de chamadas |

### 2.4 Funil / Kanban (7 fases — strings exatas no banco, case-sensitive)

```
Discovery & Pitch → Submissões → Screening → Proposta → Ongoing → Handover
                                     └→ Despriorizado (kill/veto)
```

- Drag & drop (admin) com update otimista, rollback em erro e audit em `submission_history`.
- KPIs no topo: ativas, contagem por origem, taxa de aprovação.
- Painel lateral por card com abas: Dados, Scorecard, Report (readouts), Reuniões,
  Ongoing (só na fase Ongoing), Histórico, + Copilot flutuante.
- Edição inline dos dados apenas na fase "Submissões".

### 2.5 Motor do Scorecard (regra de negócio central — preservar exatamente)

```
Nota Final = (Soma Ponderada Bloco 1 × 0.60) + (Soma Ponderada Bloco 2 × 0.40)
Cada critério: nota 0–100 × peso relativo dentro do bloco (pesos de cada bloco somam 100%).
```

**Bloco 1 — Negócio & Produto (60%), igual para todas as origens:**

| Critério | Peso | Veto |
|---|---|---|
| Diferencial Injusto | 10% | — |
| Alinhamento | 10% | — |
| Problema Real | 10% | — |
| TAM/SAM/SOM | 10% | — |
| Escala Receita/Custo | 10% | — |
| Escala B2G | 10% | — |
| Aproveitamento Infra | 5% | — |
| Velocidade MVP | 10% | — |
| Vibe Coding | 5% | — |
| **Risco Regulatório** | 10% | ✅ |
| Conhecimento Interno | 5% | — |
| Processo Comercial | 5% | — |

**Bloco 2 — dinâmico por origem (40%):**

| Origem | Critérios (peso / veto) |
|---|---|
| Mercado | **Perfil do Founder (20% ✅)**, Dono da Briga (20%), Sinergia/CAC (20%), Gap de Entrega (20%), Canais de Venda (20%) |
| Interna | **Disponibilidade Real (30% ✅)**, **Perfil Empreendedor (25% ✅)**, Dono da Briga (25%), Canais/Network (20%) |
| Editais | **PI (20% ✅)**, Cobertura Custos (15%), Match Recursos (15%), **Atestados Técnicos (15% ✅)**, Ecossistema (10%), Fluxo Caixa (15%), **ROI Burocrático (10% ✅)** |

**Veredicto:** `< 60` → Kill · `60–80` → Amadurecer · `> 80` → Aprovar ·
**qualquer veto marcado → REPROVADO** (soberano, independe da nota).

**Regras de implementação:**
- Fonte única da fórmula: **servidor** (o callback da avaliação IA já recalcula
  `final_score`/`has_veto`/`verdict` server-side — manter e usar a mesma função para
  avaliações manuais, ex. via RPC ou trigger). No original a lógica está duplicada
  entre `src/components/admin/scorecard.ts` e a Edge Function (§8/B10).
- N avaliações por iniciativa (tabela `evaluations`, 1:N): IA + manuais de diferentes
  avaliadores. Kanban exibe a avaliação `completed` mais recente.
- Validação visual quando pesos ≠ 100% (já implementada no original em `ScorecardForm`).

### 2.6 Submissões (wizards)

- Auto-save de rascunho em `localStorage` com chave **`aurora_draft_{tipo}_{user_id}`**
  — nunca sem o `user_id` (máquina compartilhada). Cuidado com o bug do original:
  se `user.id` ainda não carregou no primeiro render, a chave vira
  `aurora_draft_mercado_` (vazia) — só ativar o auto-save quando `user.id` existir.
- Validação por etapa; modo "Submissão Simplificada" (`?simplified=true`, toggle do admin)
  torna tudo opcional.
- Payload vai em `submissions.data` (JSONB) com chaves técnicas → **validar com Zod por
  tipo de submissão** na entrada e na leitura (no original é `Record<string, any>`).
- Pós-submit: e-mail de confirmação via Edge Function (`send-confirmation-email`).
- Etapas: **Mercado** (Founders, Solução, Progresso, Problema & Mercado, Equity &
  Governança, Expectativas) · **Interna** (mesmo sem Equity) · **Editais** (Owner,
  Info Básicas, Elegibilidade, Problema & Solução, Viabilidade, Execução).

### 2.7 Reuniões e atas (2 trilhos)

| Trilho | `meetings.category` | Estrutura |
|---|---|---|
| Pré-fechamento | `general` | Lista plana por iniciativa |
| Checkpoint | `ongoing` | Agrupadas em semanas (`ongoing_weeks`) com documentos anexos (`week_documents`) |

Pipeline: upload de transcrições (`.txt/.vtt/.srt/.md`, até 10 por lote) → Storage
privado bucket `transcripts` → Edge Function `upload-meetings` cria meetings `queued`
e dispara agente Volund com callback HMAC → `volund-callback` persiste ata estruturada
em `meetings.minutes_structured` → UI atualiza via Supabase Realtime.

**Um único bucket** para transcrições (`transcripts`) em upload E download — no
original o download aponta para um bucket órfão e as transcrições "somem" (§8/F3).

### 2.8 Ongoing / Vesting (90 dias = 12 semanas fixas)

- `vesting_indicators`: peso, meta, valor atual, dono, status, direção (gte/lte).
- `vesting_measurements`: medição semanal, UNIQUE (indicador, semana 1–12).
- `vesting_week_notes`: dificuldades/destaques por semana.
- Dashboard: anel de progresso + barras + gráfico de evolução + matriz 12 semanas.
- Link público `/ongoing/:token`: token UUID revogável em `ongoing_share_links`;
  dados servidos **apenas** pela RPC `get_public_ongoing` (SECURITY DEFINER) — revisar
  se `owner_name`, `evidence_url` e `notes` devem sair na resposta pública.

### 2.9 Open Calls (chamadas)

- `calls` (title, deadline `date`, vertical, call_type `mercado|interno`, status,
  visibility `publica|privada`) + `call_fields` (formulário dinâmico) +
  `call_responses` (JSONB indexado por `field_id`).
- Ocultação de vencidas: **já resolvida por RLS no original** — as policies de SELECT
  (anônimo e autenticado) filtram `deadline >= CURRENT_DATE`; quem já respondeu continua
  vendo a chamada encerrada (intencional, para o histórico no dashboard). Manter esse
  desenho. Tag "Encerrando em breve" quando faltam <7 dias já existe no client.
- ⚠️ Bug real do original a não repetir: a UI de admin oferece status **"rascunho"**
  (`ChamadaForm`, badge no `CallsManager`), mas o CHECK `chk_calls_status` só permite
  `('ativa','encerrada')` — salvar rascunho estoura a constraint. No novo schema,
  incluir `'rascunho'` no CHECK (e nas policies: rascunho nunca visível fora do admin).
- **Responder chamada exige login**: a rota `/chamadas/:id` é pública para leitura, mas
  o INSERT em `call_responses` é só para `authenticated` (RLS valida call ativa + prazo
  + `respondent_email` = e-mail do usuário). Não existe resposta anônima.
- Convenção: valores de enum em **português** no banco.

### 2.10 WorkSpace

Board interno de tasks da plataforma (`workspace_tasks`): external_id, prioridade
P0–P3, tipo, perfil, status, flag de decisão aberta, soft-delete (`deleted_at`).
Acesso: só admin.

---

## 3. Modelo de dados consolidado (schema alvo)

> Gere UMA migration inicial com tudo abaixo. Não replicar o histórico de 59 migrations.

### 3.1 Enum

```sql
CREATE TYPE public.app_role AS ENUM ('founder', 'colaborador', 'admin', 'viewer');
-- ⚠️ No original, 'viewer' só existe no banco vivo (nunca ganhou migration). Incluir desde o início.
```

### 3.2 Tabelas

| Tabela | Colunas principais | Constraints a garantir (T3.2 completo) |
|---|---|---|
| `profiles` | id PK, user_id UNIQUE FK→auth.users CASCADE, full_name, role app_role (espelho, ver §3.4), created_at, updated_at | NOT NULL em tudo exceto derivados |
| `user_roles` | id PK, user_id FK→auth.users CASCADE, role app_role | UNIQUE (user_id, role) |
| `submissions` | id PK, user_id FK, type, project_name, status, data JSONB, briefing, due_date, created_at, updated_at | CHECK type IN ('mercado','interna','editais'); CHECK status IN (7 fases §2.4); CHECK length(project_name) > 0 |
| `evaluations` | id PK, submission_id FK CASCADE, author_id **FK→auth.users**, source, scores JSONB, final_score, has_veto, verdict, descriptions JSONB, report, summary, volund_run_id, processing_status, error_message, processed_at | CHECK source IN ('ai','manual'); **CHECK final_score 0–100**; **CHECK verdict IN ('Aprovar','Amadurecer','Kill','REPROVADO','')**; CHECK processing_status IN ('pending','processing','completed','failed'); UNIQUE parcial em volund_run_id; índices em submission_id e processing_status |
| `submission_history` | id PK, submission_id FK CASCADE, from_status, to_status, moved_by FK, moved_at | |
| `meetings` | id PK, submission_id FK CASCADE, title, meeting_date, category, week_id FK→ongoing_weeks CASCADE, pre_agenda, transcript, transcript_url, smart_minutes, minutes_structured JSONB, source, volund_run_id, processing_status, error_message, processed_at, created_by FK | CHECK category IN ('general','ongoing'); CHECK processing_status |
| `ongoing_weeks` | id PK, submission_id FK CASCADE, title, display_order, created_by, timestamps | |
| `week_documents` | id PK, week_id FK CASCADE, submission_id FK, file_name, file_path, file_size, mime_type, uploaded_by FK | resolver conflito do original: definir file_size/mime_type NOT NULL |
| `ongoing_share_links` | id PK, submission_id UNIQUE FK, token uuid UNIQUE, enabled bool, created_by, timestamps | |
| `vesting_indicators` | id PK, submission_id FK, name, weight, meta/target, current_value, status, direction, owner_name, evidence_url, notes, progress_pct | CHECK weight 0–100; CHECK progress_pct 0–100; CHECK direction IN ('gte','lte') |
| `vesting_measurements` | id PK, submission_id FK, indicator_id FK, week_number, value, value_before, status, comment, created_by | CHECK week_number 1–12; UNIQUE (indicator_id, week_number) |
| `vesting_week_notes` | id PK, submission_id FK, week_number, highlights, difficulties | UNIQUE (submission_id, week_number) |
| `readouts` | id PK, submission_id FK, title, description, created_by **FK**, timestamps | |
| `chat_sessions` / `chat_messages` | sessão por submission + user_id **FK** (faltava no original); mensagens com role, volund_run_id, metadata JSONB | CHECK role IN ('user','assistant','system') |
| `calls` / `call_fields` / `call_responses` | ver §2.9; `deadline` é `date` | CHECK call_type IN ('mercado','interno'); visibility IN ('publica','privada'); **status IN ('rascunho','ativa','encerrada')** — o original omitiu 'rascunho' e quebrou o "Salvar Rascunho" da UI |
| `workspace_tasks` | ver §2.10 | CHECK em perfil (era text livre no original) |

**Não recriar:** `submission_scores` (tabela legada 1:1, substituída por `evaluations`).

### 3.3 Funções e triggers

| Função | Tipo | Propósito |
|---|---|---|
| `has_role(uid, role)` | SQL STABLE SECURITY DEFINER | Checagem RBAC nas policies (evita recursão em `user_roles`) |
| `handle_new_user()` | trigger AFTER INSERT em auth.users | Cria profile + user_roles pelo domínio do e-mail (§3.4). **Operação atômica** (uma transação) — a race condition T1.3 do original vinha de duas operações separadas |
| `sync_user_role_to_profile()` | trigger em user_roles | Propaga role → `profiles.role` (espelho para exibição, nunca autorização) |
| `prevent_profile_role_change()` | trigger BEFORE UPDATE em profiles | Bloqueia escrita direta em `profiles.role` |
| `update_updated_at_column()` | trigger genérico | `updated_at` em todas as tabelas (um único trigger genérico — não duplicar como no original) |
| `get_public_ongoing(token)` | RPC SECURITY DEFINER, GRANT anon | Única porta anônima do ongoing; validar token + enabled; retornar só campos aprovados para exibição pública |
| `compute_evaluation_verdict(...)` | função (nova) | Fórmula do scorecard server-side, usada tanto pelo callback IA quanto por avaliações manuais (fonte única) |

### 3.4 Atribuição de role no signup

**Não hardcodar e-mails de admin em migration** (o original tem promoções manuais por
UUID e um typo de e-mail que rebaixou um admin). Modelo recomendado:

```sql
CREATE TABLE public.role_assignment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_type text NOT NULL CHECK (match_type IN ('email','domain')),
  pattern text NOT NULL UNIQUE,   -- 'fulano@empresa.com' ou 'empresa.com'
  role app_role NOT NULL
);
-- handle_new_user() consulta esta tabela: email exato > domínio > default 'founder'.
-- Seed via script de deploy (não em migration): admins e domínios colaborador atuais:
--   @beyondcompany.com.br, @extreme.digital, @volund.com.br → colaborador
```

### 3.5 Storage

| Bucket | Público | Uso | Policies |
|---|---|---|---|
| `transcripts` | não | Transcrições de reuniões (upload E download — um bucket só) | admin: insert/select/update/delete |
| `week-documents` | não | Documentos das semanas de checkpoint | admin: insert/select/update/delete; colaborador: select se for requisito |

Não criar o bucket `meeting-transcripts` (órfão no original).

---

## 4. Matriz RLS alvo (corrigida)

> Estado final desejado — corrige os furos do original (founder isolation, viewer
> quebrado, colaborador bloqueado em meetings). RLS ON em TODAS as tabelas.
> Todo GRANT a `authenticated` deve ser o mínimo necessário; nenhum GRANT a `anon`
> exceto EXECUTE na RPC pública.

| Tabela | admin | colaborador | founder | viewer | anon |
|---|---|---|---|---|---|
| `profiles` | SELECT all | próprio | próprio | próprio | — |
| `user_roles` | ALL | SELECT próprio | SELECT próprio | SELECT próprio | — |
| `submissions` | ALL | SELECT all, UPDATE all, INSERT próprias | **SELECT/INSERT/UPDATE só `user_id = auth.uid()` e só type='mercado' no INSERT** | **SELECT all (nova — DashboardViewer quebrado sem ela)** | — |
| `evaluations` | ALL | SELECT all¹ | SELECT das próprias submissions | SELECT all¹ | — |
| `submission_history` | ALL | **SELECT all** (original só permitia INSERT) + INSERT | — | SELECT all | — |
| `meetings` | ALL | **SELECT all** (original: zero acesso → aba Reuniões quebrada p/ colaborador) | — | — | — |
| `ongoing_weeks` / `week_documents` | ALL | **SELECT all** (idem) | — | — | — |
| `ongoing_share_links` | ALL | — | — | — | via RPC apenas |
| `vesting_*` | ALL | SELECT all | SELECT das próprias submissions | — | via RPC apenas |
| `readouts` | ALL | SELECT/INSERT/UPDATE | — | SELECT | — |
| `chat_sessions/messages` | ALL | owner ALL + SELECT all | — | — | — |
| `calls` | ALL | SELECT ativas+prazo (ou já respondidas) | SELECT ativas públicas mercado+prazo (ou já respondidas) | SELECT ativas+prazo | SELECT ativa+publica+prazo |
| `call_fields` | ALL | espelha calls | espelha calls | espelha calls | espelha calls (leitura) |
| `call_responses` | ALL | INSERT (call ativa/prazo, e-mail próprio) + SELECT próprias | idem | idem | — (responder exige login) |
| `workspace_tasks` | ALL | — | — | — | — |

¹ Decisão consciente: colaborador/viewer leem todos os scorecards (inclui reports de IA).
Se isso for sensível, restrinja e documente.

**Teste obrigatório (XMPVAS0HE):** e2e que cria founder A e founder B, submete com A,
autentica como B e garante que B **não** lê a submissão de A (nem via `evaluations`,
`meetings` ou qualquer tabela relacionada).

---

## 5. Edge Functions

| Função | Disparo | Auth | Secrets |
|---|---|---|---|
| `evaluate-with-ai` | Botão "Avaliar com IA" | JWT + `has_role(admin)` | `VOLUND_API_KEY`, `VOLUND_EVALUATION_AGENT_ID`, `VOLUND_CALLBACK_SECRET` |
| `volund-evaluation-callback` | Webhook Volund | HMAC (`verify_jwt=false`) | `VOLUND_CALLBACK_SECRET`, service_role |
| `upload-meetings` | Importar transcrições | JWT + admin | `VOLUND_API_KEY`, `VOLUND_AGENT_ID`, `VOLUND_CALLBACK_SECRET` |
| `volund-callback` | Webhook Volund (atas) | HMAC (`verify_jwt=false`) | idem |
| `copilot-chat` | Chat da iniciativa | JWT + admin/colaborador | `VOLUND_API_KEY`, `VOLUND_COPILOT_AGENT_ID` |
| `send-confirmation-email` | Pós-submissão | JWT + e-mail do próprio usuário | `RESEND_API_KEY`, `SITE_URL` |
| `initiative-mcp` | Agentes externos (MCP read-only) | `MCP_AGENT_API_KEY` (`verify_jwt=false`) | idem + service_role |
| ~~`sign-transcripts`~~ | **NÃO RECRIAR como está** — no original não tem autenticação nenhuma e assina URL de qualquer path com service_role. Se necessária, exigir JWT + admin e validar o path | | |

**Regras para todas:**
- CORS restrito ao domínio da aplicação (no original é `Access-Control-Allow-Origin: *`).
- `verify_jwt = false` **somente** nos 3 webhooks/MCP; declarar todas no `config.toml`.
- Callbacks: validar HMAC, ser idempotentes por `volund_run_id`.
- Service role apenas onde RLS não serve (webhooks); nas demais, preferir o client
  com o JWT do usuário para que a RLS valha.
- Documentar todos os secrets num `.env.example` de funções (sem valores).

---

## 6. Frontend — padrões para a reconstrução

### 6.1 Stack e estrutura

Manter: React 18 + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Query +
@dnd-kit + framer-motion + Recharts + Zod + react-hook-form + date-fns + Playwright/Vitest.

Remover: `@lovable.dev/cloud-auth-js` (→ `supabase.auth.signInWithOAuth({ provider: 'google' })`),
`lovable-tagger`, `html2canvas-pro` + `jspdf` (→ PDF server-side, ver §6.4).
Escolher **um** sistema de toast (sonner) e **um** set de ícones (lucide).

```
src/
  features/
    auth/            # AuthContext, ProtectedRoute, Login
    submissions/     # 3 wizards + steps + drafts (Zod schemas por origem)
    kanban/          # board, painel, KPIs, histórico
    evaluations/     # scorecard, lista de avaliações, IA
    meetings/        # 2 trilhos + upload + atas
    ongoing/         # vesting, semanas, share link, página pública
    calls/           # CRUD admin + listagem pública + resposta
    workspace/       # board interno
    landing/
  shared/
    ui/              # shadcn
    lib/             # utils, field-labels (UM único mapa de labels)
    integrations/supabase/
```

### 6.2 Camada de dados

- **Todo acesso a dados via hooks TanStack Query** (`useSubmissionsWithScores()`,
  `useEvaluations(submissionId)`, etc.) — no original há fetch manual duplicado entre
  `Admin.tsx` e `DashboardViewer.tsx` e queries espalhadas por ~30 componentes.
- `QueryClient` com defaults globais (staleTime, retry).
- Sempre `select` com colunas explícitas + `.limit()` + paginação onde a lista cresce
  (kanban, respostas de chamadas, avaliações).
- Realtime (já usado em `meetings`) em vez de polling — o original usa polling de 3s no
  copilot e 4s nas avaliações.
- Zero `as any`: regenerar `types.ts` do Supabase sempre que o schema mudar
  (script npm `gen:types`).

### 6.3 Auth no front (apenas UX)

- Role lido de `user_roles` (nunca `profiles.role`).
- **Sem fallback silencioso para `founder`**: ausência de role = estado de erro/bloqueio
  (no original, falha do trigger deixava o usuário como founder).
- `ProtectedRoute` por `allowedRoles` — mas nenhum dado sensível depende disso; RLS decide.
- Redirect pós-login por role (`roles.ts`).

### 6.4 PDF da iniciativa

Server-side: Edge Function (ou serviço) com Puppeteer/Chromium renderizando uma rota
de impressão autenticada, retornando o PDF. Elimina html2canvas (pesado, frágil com
o tema dark e quebra com mudanças de layout).

### 6.5 Limites de tamanho

Nenhum componente > ~300 linhas. Os monólitos do original a quebrar ao portar:
`CheckpointMeetingsSection` (1394L), `IniciativaDetalhe` (947L), `MeetingsTab` (785L),
`VestingWeeklySection` (733L). Extrair `MeetingAccordion`/`WeekAccordion` compartilhados.

---

## 7. Tooling e qualidade (dia zero)

| Item | Configuração alvo | Original (não repetir) |
|---|---|---|
| TypeScript | `strict: true` em todo o app | `strict: false`, `noImplicitAny: false`, `strictNullChecks: false` |
| ESLint | flat config + `no-unused-vars` ON | regra desligada |
| Lockfile | **um** gerenciador (npm OU bun) | 3 lockfiles versionados (package-lock + bun.lock + bun.lockb) |
| `.gitignore` | incluir `.env`, `.env.*` (manter `.env.example`) | **`.env` está versionado no git** |
| Scripts | `dev`, `build`, `lint`, `typecheck` (`tsc --noEmit`), `test`, `test:e2e`, `gen:types` | sem typecheck |
| Porta dev | uma só (5173) em vite + playwright | vite 8080 vs playwright 5173 |
| CI (GitHub Actions) | lint + typecheck + vitest + build em todo PR; e2e em staging | inexistente |
| Testes | e2e: auth por role, founder isolation (RLS), submissão, kanban DnD, scorecard/veto, deadline de chamadas | 1 teste placeholder + 4 e2e (1 desatualizado) |
| README | setup real do projeto (env, supabase, seeds) | boilerplate Lovable com placeholder |

**Variáveis de ambiente (`.env.example`):**

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
# somente e2e (nunca commitar valor):
SUPABASE_SERVICE_ROLE_KEY=
```

---

## 8. Catálogo de problemas do original (não reproduzir)

### A. Críticos de segurança

| # | Problema | Onde estava | Correção no novo ambiente |
|---|---|---|---|
| A1 | `.env` versionado no git (URL + anon key; histórico público do repo) | `.env` na raiz, ausente do `.gitignore` | `.env` ignorado; **rotacionar as chaves do projeto Supabase antigo** se o repo foi/for compartilhado |
| A2 | Edge Function `sign-transcripts` sem autenticação no código (o gateway exige apenas um JWT válido — a anon key pública serve), usa service_role e assina qualquer path do bucket | `supabase/functions/sign-transcripts/` | Não recriar; se necessária, JWT + admin + validação de path |
| A3 | Versão inicial do trigger confiava em `raw_user_meta_data->>'role'` do cliente (auto-elevação a admin); contas antigas podem ter role indevido | migration inicial | Trigger novo nunca lê role do metadata; auditar roles ao migrar usuários |
| A4 | Founder isolation (XMPVAS0HE) sem validação e2e; a migration com esse nome na verdade liberava colaborador | policies de `submissions` | Matriz §4 + teste e2e obrigatório |
| A5 | CORS `*` em todas as Edge Functions | `_shared/cors.ts` | Restringir ao domínio |
| A6 | MCP com API key estática bypassa RLS via service_role; `initialize`/`tools/list` sem auth | `initiative-mcp` | Auth em todos os métodos; escopo mínimo de leitura |
| A7 | GRANTs amplos a `authenticated` (e temporariamente a `anon`) em tabelas sensíveis | várias migrations | GRANT mínimo + RLS como única porta |

### B. Backend / banco

| # | Problema | Correção |
|---|---|---|
| B1 | 59 migrations caóticas: `evaluations`, `vesting_*`, `ongoing_weeks`, `week_documents`, `ongoing_share_links` criadas 2×; `handle_new_user` reescrita 8×; `get_public_ongoing` 4× | Uma migration consolidada (§3) |
| B2 | Enum `viewer` existe só no banco vivo, sem migration | Incluído no enum desde o início |
| B3 | Admins promovidos por UUID hardcoded em migration; typo de e-mail rebaixou admin | Tabela `role_assignment_rules` + seed (§3.4) |
| B4 | Tabela legada `submission_scores` coexistindo com `evaluations` | Não recriar |
| B5 | RLS inconsistente: viewer sem SELECT em `submissions` (dashboard quebrado); colaborador sem acesso a `meetings`/`ongoing_weeks`/`week_documents` (abas quebradas); colaborador sem SELECT em `submission_history` | Matriz §4 |
| B6 | `evaluations` sem CHECK 0–100 / verdict; FKs faltando (`author_id`, `chat_sessions.user_id`, `readouts.created_by`) | Constraints §3.2 |
| B7 | Bucket órfão `meeting-transcripts` + policy no bucket errado | Um bucket `transcripts` |
| B8 | `user_roles` entrou e saiu da publication Realtime | Definir estratégia de refresh de role e manter |
| B9 | Trigger `set_vesting_weekly_updated_at` reutilizado com nome enganoso | Um trigger genérico `set_updated_at` |
| B10 | Fórmula do scorecard duplicada front × Edge Function | Função única server-side (§3.3) |

### C. Frontend

| # | Problema | Correção |
|---|---|---|
| F1 | Cache de role no client com fallback `founder`; sem refresh se role muda | §6.3 |
| F2 | Kanban: `evaluations` sem limite; lógica de fetch duplicada Admin × DashboardViewer; useEffect com deps incompletas | Hooks compartilhados + paginação (§6.2) |
| F3 | **Transcrições "somem"** por duas causas: (a) `meetings.transcript_url` guarda uma signed URL com expiração de 1h (inútil depois disso — todos os consumidores precisam re-extrair o path via regex); (b) o download do fluxo legado usa o bucket órfão `meeting-transcripts` | Gravar `transcript_path` (path do Storage) na row e gerar signed URL sob demanda; um único bucket |
| F4 | PDF client-side com html2canvas-pro (+ `@ts-ignore`) | Server-side (§6.4) |
| F5 | Draft key `aurora_draft_{tipo}_` com user.id vazio no primeiro render | Só ativar auto-save com user.id presente |
| F6 | UI de chamadas oferece status "rascunho" mas o CHECK do banco só permite ativa/encerrada — salvar rascunho falha | Incluir `'rascunho'` no CHECK + policy que o esconde do público |
| F7 | ~30 arquivos com `any`/`as any`; tabelas fora do types gerado | strict + `gen:types` |
| F8 | Componentes de 700–1400 linhas | §6.5 |
| F9 | Dois sistemas de toast; dois sets de ícones; dois mapas de labels de campos | Um de cada |
| F10 | Rota `/dashboard-founder` comentada, mas a página existe, o e-mail transacional aponta para ela e os testes e2e 1 e 3 ainda a usam (o teste 1 cai em 404, não em redirect para /login) | Decidir: reativar ou remover página + corrigir e-mail e testes |
| F11 | `confirm()` nativo em exclusões | `AlertDialog` |
| F12 | Polling (3–4s) em copilot e avaliações | Realtime |
| F13 | `profiles.id` usado onde deveria ser o auth uid: `useCallsForDashboard(role, profile?.id)` filtra `call_responses.user_id` (chamadas respondidas nunca aparecem como "participou") e `ChamadaForm` grava `created_by = profile?.id` | Usar `user.id` (auth uid) consistentemente |
| F14 | Avatar "RM" hardcoded no admin | Derivar do profile |
| F15 | Download de transcrição no fluxo manual legado passa a **signed URL inteira** como path para `createSignedUrl` (além do bucket errado) | Guardar o path do Storage na row e assinar a partir dele |
| F16 | `Submission.tsx` exige `pitchDeck` na validação da etapa Solução, mas o campo está marcado como "(opcional)" na UI | Alinhar validação e label |

### D. Processo

| # | Problema | Correção |
|---|---|---|
| P1 | Sem CI; commits "Changes" do Lovable | CI em PR + conventional commits |
| P2 | Cobertura de teste ~zero | Suíte mínima §7 antes de features novas |
| P3 | `CLAUDE.md` e docs desatualizados: tasks já resolvidas (A6.1, A1.5, A2.4, T1.2/T1.3 no banco, C2.2 parcial, A1.1 parcial, XMPVAJY6V via RLS, F2.3 entregue via `send-confirmation-email`); `DOCUMENTATION.md` ainda descreve fase "Incubação" e dashboard de founder ativo | Regenerar backlog e docs a partir deste catálogo |

---

## 9. Plano de execução em fases

> ⚠️ **Decisão tomada (jul/2026): manter o banco de dados atual.** Este §9 descrevia a
> rota "banco novo do zero" e fica como referência. **O plano vigente é o §11**, que
> substitui a Fase 0 (schema consolidado) por migrations corretivas sobre o banco vivo
> e elimina a Fase 5 (não há migração de dados — usuários, submissões, avaliações,
> reuniões e vesting permanecem onde estão). As Fases 1–4 continuam valendo como ordem
> de reconstrução do frontend.

**Fase 0 — Fundação (repo + banco)**
1. Novo repo: scaffold Vite + TS strict + Tailwind + shadcn + ESLint + CI + `.env.example`.
2. Novo projeto Supabase: migration consolidada (§3) + RLS (§4) + buckets (§3.5)
   + seed de `role_assignment_rules`.
3. Teste e2e de auth + founder isolation rodando em CI. **Gate: nada avança sem isso.**

**Fase 1 — Núcleo do funil**
4. Auth (email + Google nativo) + dashboards por role.
5. Wizards de submissão (com Zod + draft por user_id) + e-mail de confirmação.
6. Kanban + painel + histórico + KPIs (hooks compartilhados, paginação).

**Fase 2 — Avaliação**
7. Scorecard manual com fórmula server-side + validação de pesos.
8. Integração Volund: `evaluate-with-ai` + callback HMAC + Realtime.

**Fase 3 — Reuniões e Ongoing**
9. Reuniões 2 trilhos + upload de transcrições (um bucket) + atas Volund.
10. Vesting completo + link público via RPC.

**Fase 4 — Periféricos**
11. Open calls (com deadline enforcement), readouts, copilot, WorkSpace, landing.
12. PDF server-side. MCP (se ainda necessário) com auth correta.

**Fase 5 — Migração de dados e cutover**
13. Export do banco antigo → transform (dropar `submission_scores`, normalizar
    roles auditados, revalidar `submissions.data` com Zod) → import.
14. Migrar usuários (Supabase admin API) — roles reatribuídos pela regra nova, com
    auditoria manual dos admins.
15. Rodar os dois ambientes em paralelo num período curto de validação; cutover de DNS;
    **rotacionar/desativar chaves do projeto antigo**.

---

## 10. Checklist de aceite (paridade + qualidade)

**Paridade funcional**
- [ ] Landing + navegação por role
- [ ] Login e-mail/senha + Google + registro com confirmação por e-mail (T1.1 e2e)
- [ ] 3 wizards com auto-save por usuário e modo simplificado
- [ ] Kanban 7 fases com DnD + audit trail + KPIs
- [ ] Painel da iniciativa: Dados, Scorecard, Report, Reuniões, Ongoing, Histórico, Copilot
- [ ] Scorecard manual + IA, vetos soberanos, N avaliações, fórmula server-side
- [ ] Reuniões 2 trilhos + upload transcrições + atas Volund via Realtime
- [ ] Ongoing: indicadores, 12 semanas, notas, link público revogável
- [ ] Open calls: CRUD, formulário dinâmico, resposta pública, deadline enforcement
- [ ] WorkSpace board
- [ ] `/iniciativa/:id` + PDF server-side
- [ ] Dashboards founder / colaborador / viewer funcionais (viewer com policy!)

**Qualidade / segurança**
- [ ] e2e: founder A não lê dados de founder B (submissions, evaluations, meetings)
- [ ] Nenhum secret no git; `.env` ignorado; chaves antigas rotacionadas
- [ ] Todas as Edge Functions autenticadas (JWT/HMAC/API key) + CORS restrito
- [ ] TS strict sem `any` novos; `gen:types` no fluxo
- [ ] CI verde: lint + typecheck + unit + build (+ e2e em staging)
- [ ] Um lockfile; README de setup real
- [ ] Constraints do §3.2 aplicadas; migration única reprodutível em banco limpo

---

## 11. Plano vigente — recriar o app mantendo o banco atual

> Repo novo + Edge Functions corrigidas + **mesmo projeto Supabase**
> (`rkduxypewaqjwibemaay`), com os dados preservados. O schema não é recriado;
> ele recebe migrations corretivas versionadas. Regra de ouro do CLAUDE.md continua:
> **todo SQL é revisado antes de aplicar e cada migration deixa rastro para reverter.**

### Fase A — Pré-requisitos e segurança (antes de qualquer código)

1. **Confirmar acesso direto ao projeto Supabase** fora do Lovable (dashboard + CLI
   `supabase link --project-ref rkduxypewaqjwibemaay`). O projeto nasceu como "Lovable
   Cloud"; se o acesso for só via Lovable, resolver isso primeiro (transferir/exportar) —
   é bloqueador.
2. **Backup completo**: `supabase db dump` (schema + dados) + export dos buckets
   `transcripts` e `week-documents`. Guardar fora do repo.
3. **Criar um projeto Supabase de STAGING** restaurando esse dump. É nele que as
   migrations corretivas e o e2e rodam antes de tocar produção — como o banco de
   produção é único, staging é o substituto do "ambiente descartável".
4. **Congelar o Lovable**: parar de editar por lá (ou desconectar o sync) para o banco
   e o código não divergirem durante a transição.
5. **Rotacionar as chaves** (anon + service_role) ao final do cutover — o `.env` com a
   anon key está no histórico do git antigo.

### Fase B — Novo repositório (frontend portado com correções)

6. Scaffold: Vite + React 18 + **TS strict** + Tailwind + shadcn + ESLint (`no-unused-vars`
   ON) + um lockfile + CI (lint/typecheck/test/build) + `.env.example`. Estrutura por
   features (§6.1).
7. Portar o código de domínio aplicando o catálogo do §8 (F1–F16). Não portar:
   `@lovable.dev/cloud-auth-js`, `lovable-tagger`, `html2canvas-pro`/`jspdf`, toast/ícones
   duplicados, mapa de labels duplicado do `SubmissionDetails`.
8. Camada de dados: hooks TanStack Query compartilhados (ex.: `useSubmissionsWithScores`
   usado por Admin e DashboardViewer), `select` explícito + limites, Realtime no lugar
   dos pollings. Rodar `supabase gen types` contra o banco real e eliminar os `as any`
   (o banco vivo já tem todas as tabelas — os casts eram só types desatualizados).
9. **Google OAuth nativo**: criar credenciais OAuth próprias no Google Cloud, habilitar o
   provider Google no Supabase Auth e trocar o login para
   `supabase.auth.signInWithOAuth({ provider: "google" })`. Testar que os usuários
   existentes que entravam via Lovable continuam logando (mesmo e-mail → mesma conta;
   validar em staging um usuário real de cada domínio).
10. Decidir e executar o destino do `/dashboard-founder` (reativar ou remover página +
    link do e-mail + testes e2e 1 e 3).
11. Mesmo `.env` de destino: `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`
    apontando para o projeto atual (produção) e para staging durante o desenvolvimento.

### Fase C — Migrations corretivas no banco (aplicar em staging → validar → produção)

Uma migration por item, nesta ordem:

| # | Migration | Conteúdo |
|---|---|---|
| C1 | `fix_calls_status_rascunho` | Recriar `chk_calls_status` com `('rascunho','ativa','encerrada')` — destrava o "Salvar Rascunho" |
| C2 | `rls_viewer_submissions` | Policy SELECT em `submissions` para viewer (conserta o DashboardViewer) |
| C3 | `rls_colaborador_meetings_ongoing` | SELECT para colaborador em `meetings`, `ongoing_weeks`, `week_documents` e `submission_history` (consertam as abas Reuniões/Ongoing/Histórico em `/iniciativa/:id`) |
| C4 | `meetings_transcript_path` | Adicionar `transcript_path text`; backfill extraindo o path das signed URLs existentes (regex `/object/sign/transcripts/<path>?`); front e MCP passam a usar o path e assinar sob demanda |
| C5 | `evaluations_constraints` | Normalizar `verdict=''` → recalcular ou marcar; CHECK `final_score 0–100`, CHECK verdict, FK `author_id → auth.users`; FKs de `chat_sessions.user_id` e `readouts.created_by` |
| C6 | `fix_created_by_profiles_id` | Corrigir dados: `calls.created_by` gravado com `profiles.id` → converter para o auth uid correspondente |
| C7 | `audit_roles_metadata_era` | Script de auditoria (não migration): listar `user_roles` cujo role diverge da regra por domínio (contas criadas na era do `raw_user_meta_data->>'role'`); corrigir manualmente via `user_roles` |
| C8 | `drop_submission_scores` | Após confirmar que o backfill para `evaluations` está íntegro (contagem + amostragem), DROP da tabela legada; atualizar o MCP (`get_initiative`/`get_scorecard` ainda a consultam!) para ler `evaluations` |
| C9 | `drop_meeting_transcripts_bucket` | Remover policy `admin_manage_transcripts` e o bucket órfão `meeting-transcripts` (verificar antes que está vazio) |
| C10 | `restrict_grants` | Revisar GRANTs amplos a `authenticated` (mínimo necessário; RLS como única porta) |

### Fase D — Edge Functions (redeploy no mesmo projeto)

12. Copiar as 7 funções para o novo repo com as correções: CORS restrito ao domínio do
    front, **`sign-transcripts` deletada** (ou reescrita com JWT + admin + validação de
    path), `initiative-mcp` sem consultas à `submission_scores` e com auth em todos os
    métodos, scorecard como módulo compartilhado entre `volund-evaluation-callback` e o
    cálculo das manuais (fonte única — mover o cálculo manual para uma RPC/função).
13. Redeploy via CLI (`supabase functions deploy`) no mesmo projeto — os secrets
    (`VOLUND_*`, `RESEND_API_KEY`, `SITE_URL`, `MCP_AGENT_API_KEY`) já estão lá; conferir
    com `supabase secrets list` e atualizar `SITE_URL` para o novo domínio.

### Fase E — Validação e cutover

14. Rodar contra **staging**: e2e de auth por role, founder isolation (XMPVAS0HE),
    submissão → e-mail, kanban DnD, scorecard manual + IA (mock do Volund se preciso),
    upload de transcrição, chamadas com deadline, link público do ongoing.
15. Aplicar as migrations C1–C10 em produção (janela curta; backup imediatamente antes).
16. Deploy do front (Vercel/Netlify/etc.), atualizar em Supabase Auth: Site URL +
    Redirect URLs do novo domínio.
17. Smoke test em produção com um usuário de cada role. Desativar o app Lovable antigo.
18. **Rotacionar anon + service_role keys**; atualizar front, functions e `.env.test`.
19. Arquivar o repo antigo (read-only) e apontar o time para o novo.

### O que NÃO fazer neste cenário

- Não rodar as 59 migrations antigas no banco (já estão aplicadas) nem tentar "squash"
  em produção — o consolidado do §3 serve para conferência e para recriar staging limpo
  no futuro, não para reaplicar.
- Não recriar usuários nem tocar em `auth.users` — contas, sessões e roles permanecem.
- Não mudar strings de status/fases do Kanban nem chaves do `submissions.data` — os
  dados existentes dependem delas.
