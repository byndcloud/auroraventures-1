# Task History

Registro cronológico de tasks concluídas no Aurora. Serve como **memória entre sessões**
para o agente e o time — decisões arquiteturais, padrões aplicados, warnings abertos e
follow-ups vivem aqui.

Escrever a entry é a **Etapa 7 obrigatória** do fluxo definido em
[`../../AGENTS.md`](../../AGENTS.md).

---

## Como usar

### Ao concluir uma task (após commit aprovado)

1. Crie `YYYY-MM-DD-slug-da-task.md` nesta pasta usando o template abaixo
2. Adicione uma linha nova no **topo** de [`_index.md`](./_index.md)
3. Se a task tomou decisão arquitetural, crie também uma ADR em [`../adr/`](../adr/)

### Ao iniciar uma task nova

1. Grep [`_index.md`](./_index.md) por termos do escopo da task
2. Leia as 2–3 entries mais relevantes antes de decidir padrão/arquitetura
3. Se encontrar decisão contraditória a uma entry anterior, sinalize no plano
   (não decida silenciosamente contra o histórico)

---

## Nomenclatura

`YYYY-MM-DD-slug-da-task.md`

- Data = dia do commit final aprovado
- Slug = kebab-case curto (3–6 palavras), foco no **objeto** da mudança:
  - ✔ `2026-07-20-import-volund-agentic-skills.md`
  - ✔ `2026-07-25-viewer-rls-policies.md`
  - ✔ `2026-08-03-fix-transcript-signed-urls.md`
  - ✘ `2026-07-20-work.md` (vago)
  - ✘ `2026-07-20-implementar-todas-as-melhorias-que-o-cliente-pediu-hoje.md` (longo)

---

## Template

Copie tudo abaixo para o arquivo novo e preencha:

```markdown
---
task: <título curto — o que foi feito>
data: YYYY-MM-DD
tipo: feature | fix | refactor | chore
rota: direta | via Advisor
skills_usados: [lista — ex: front, back, qa, segurança]
---

## Decisões tomadas
- <decisão arquitetural ou de implementação relevante. Por que essa e não outra?>

## Padrões aplicados
- <padrão reutilizável que foi seguido ou criado. Nome + onde encontrar>

## Warnings abertos
- <item + skill que gerou — rastreamento de dívida técnica. Ex: "test coverage
  do fluxo de scorecard <60% — qa">

## Dependências criadas
- <módulos/contratos que agora dependem do que foi implementado. Ex: "front
  passou a depender do campo `submissions.data.stage` — quebrar esse contrato
  exige coordenar UI + queries">

## Follow-ups
- <item para próxima task. Se vira ADR, linkar. Se vira issue independente
  acionável, migrar para docs/FOLLOWUPS.md e marcar aqui como "→ FOLLOWUPS.md #N">
```

---

## Relação com `docs/FOLLOWUPS.md`

- **`task-history/`** é **append-only imutável**: cada entry documenta o estado da
  task naquele momento. Não editar após o commit — se algo mudou, escrever nova entry
- **`FOLLOWUPS.md`** é **curadoria viva**: agregado de follow-ups acionáveis que
  atravessam múltiplas tasks. É atualizado normalmente (itens fechados, priorizados,
  removidos)
- A seção "Follow-ups" de cada entry é a **fonte primária**; o `FOLLOWUPS.md` é o
  **agregado curado**. Se um follow-up sai da lista curada, a entry original continua
  registrando que ele existiu

---

## Regras invioláveis

- Uma entry por task commitada — não agrupar múltiplas tasks numa só
- `_index.md` sempre atualizado no mesmo commit (ou commit seguinte imediato)
- Entries não são editadas após o commit — se algo mudou, entry nova
- Se pulou a Etapa 7 numa task passada, escreva a entry retroativa citando a data real
  do commit e marcando `retroativa: true` no frontmatter
