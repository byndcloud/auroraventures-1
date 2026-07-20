---
task: Importar skills da Zelar e infra de fluxo (AGENTS.md, CLAUDE.md, rules, task-history, adr)
data: 2026-07-20
tipo: chore
rota: direta
skills_usados: []
---

## Decisões tomadas

- **Trazer as 6 skills da Zelar (`pre-analysis`, `advisor`, `frontend`,
  `backend-architect`, `qa-test-strategist`, `security-auditor`) para
  `.claude/skills/`** em vez de escrever do zero. Motivo: as skills da Zelar já foram
  desenhadas como stack-agnostic e passaram por uso real; recriar seria retrabalho e
  perderia a validação empírica.
- **Copiar 4 skills 1:1** (`pre-analysis`, `advisor`, `qa-test-strategist`,
  `security-auditor`) — zero ajuste, são 100% genéricas.
- **Omitir `backend-architect/scripts/scaffold.sh`** — é para greenfield genérico;
  aurora já tem estrutura Supabase estabelecida (`supabase/migrations/`, `functions/`,
  `src/integrations/supabase/`). Ajustar também o parágrafo do `SKILL.md` que citava o
  script.
- **Adaptar o bloco "Inventário de componentes" do `frontend/SKILL.md`** para os
  primitives reais do aurora (shadcn/ui + Radix + `sonner` + `lucide-react` +
  `react-hook-form` + `<AuroraLogo>` + `<Header>` de `landing/`) em vez dos primitives
  Zelar-específicos (Base UI + `<BrandLogo>` + `<AppTopbar>`).
- **Criar `AGENTS.md` adaptado do Zelar** — mesma estrutura de 7 etapas, mas:
  - Etapa 2 aponta para `CLAUDE.md` + `docs/BLUEPRINT_RECRIACAO.md` (aurora tem docs
    funcionais específicas que a Zelar não tem)
  - Etapa 4c (harness) mapeia para os comandos reais do aurora (`npm run
    lint/typecheck/build/test/test:e2e` + `triage.sh --diff`) — Zelar cita "harness"
    mas os scripts não existem, aqui a expectativa fica alinhada com o que roda
  - Etapa 7 promovida a obrigatória com formato completo do frontmatter + 5 seções
- **Criar `CLAUDE.md` do aurora** com stack real (Vite/React 18/Radix/shadcn/TanStack
  Query/Supabase — não Next.js/Base UI), convenções extraídas do `README.md` e do
  `BLUEPRINT_RECRIACAO.md` (npm, kanban case-sensitive, enums PT, `submissions.data`
  JSONB, sem fallback silencioso para founder, débitos Lovable a não repetir).
- **Criar 3 rules em `.cursor/rules/`** (`workflow.mdc`, `stack.mdc`, `skills.mdc`) com
  `alwaysApply: true` como **thin pointers** para AGENTS.md/CLAUDE.md/mapa das skills.
  Motivo: `.claude/skills/` não é auto-carregado pelo Cursor; as rules garantem que o
  contexto essencial entra em toda conversa sem duplicar conteúdo.
- **Adotar `docs/task-history/` como memória viva** com `README.md` (guia + template),
  `_index.md` (índice cronológico reverso) e esta entry inicial como exemplo canônico.
  Motivo: sem histórico, o Advisor e o pre-analysis não têm base para planejar tasks
  futuras relacionadas.
- **Adotar `docs/adr/`** para decisões arquiteturais (nova lib, provider, mudança de
  padrão). Pasta criada com `README.md` + template, sem ADRs pré-criadas — decisões
  passadas do aurora já vivem no `BLUEPRINT_RECRIACAO.md`, retro-fitar como ADR seria
  trabalho de historiador.

## Padrões aplicados

- **Skills stack-agnostic** — texto genérico + adaptações pontuais só onde a stack
  diverge. Referências (`references/*.md`) permanecem inalteradas para maximizar reuso.
- **Thin-pointer rules no Cursor** — `.cursor/rules/*.mdc` com `alwaysApply: true`
  apontando via `mdc:` para arquivos maiores, em vez de duplicar conteúdo.
- **Índice cronológico reverso em `_index.md`** — linha única por task, formato fixo
  (`YYYY-MM-DD — [slug](file) — tipo — rota — resumo`), facilita `grep` sem abrir
  cada arquivo.
- **Distinção `task-history/*/Follow-ups` × `FOLLOWUPS.md`** — o primeiro é
  append-only imutável (fonte); o segundo é curadoria viva (agregado). Documentada no
  `README.md` da pasta.

## Warnings abertos

- **Adoção do fluxo depende do humano no gate final** — as rules do Cursor lembram, o
  `AGENTS.md` marca Etapa 7 como obrigatória, mas se o agente pular e o humano aprovar
  mesmo assim, o histórico fica lacunoso. Sem harness automatizado que bloqueie.
- **`triage.sh` tem line endings a validar** — script veio via `Copy-Item` do
  PowerShell no Windows; se saiu com CRLF, não roda em CI Linux até rodar `dos2unix`
  ou re-salvar como LF.
- **Skill `backend-architect/SKILL.md` teve edit manual** — a menção original ao
  `scripts/scaffold.sh` foi substituída por parágrafo específico do aurora. Se a
  Zelar atualizar o SKILL.md upstream, o merge exige atenção nesse ponto.

## Dependências criadas

- **`AGENTS.md`** referencia `CLAUDE.md`, `docs/BLUEPRINT_RECRIACAO.md`,
  `docs/task-history/`, `docs/adr/` e os 6 `.claude/skills/*/SKILL.md`. Mover/renomear
  qualquer um exige atualizar `AGENTS.md` no mesmo commit.
- **`.cursor/rules/*.mdc`** referenciam via `mdc:` links: `AGENTS.md`, `CLAUDE.md`,
  `docs/BLUEPRINT_RECRIACAO.md`, `docs/task-history/`, `docs/adr/`, todos os
  `SKILL.md` e alguns arquivos-chave do `src/`
  (`integrations/supabase/client.ts`, `lib/roles.ts`, `lib/submission-field-labels.ts`,
  `components/ProtectedRoute.tsx`). Mover exige atualizar as rules.
- **Fluxo do agente passa a depender de `docs/task-history/`** existir e estar
  atualizado — se a pasta for removida ou o `_index.md` ficar desatualizado, a Etapa 2
  do `AGENTS.md` perde informação.

## Follow-ups

- Rodar a primeira task real com o fluxo novo e validar que o agente consegue
  navegar sem se perder. Ajustar rules/AGENTS.md conforme o que faltar.
- Considerar CI check leve que valide: (a) toda entry em `task-history/` tem linha
  correspondente em `_index.md`, (b) frontmatter tem os campos obrigatórios,
  (c) shell scripts em `.claude/skills/**` têm line endings LF.
- Avaliar se `docs/FOLLOWUPS.md` (que já existe com pendências pós-recriação do banco)
  deve ser refatorado no formato de `task-history/*/Follow-ups` ou permanecer como
  agregado curado — decisão em ADR quando o assunto voltar.
- Skill `frontend` tem referências a `design.md` — aurora não tem um `docs/design.md`
  formalizado. Considerar criar um (ver `frontend/SKILL.md` "Contexto de projeto")
  antes da próxima entrega visual significativa.
