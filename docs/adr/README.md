# Architecture Decision Records (ADR)

Registro das **decisões arquiteturais** do Aurora que afetam múltiplas tasks:
escolha de lib, provider externo, mudança de padrão estruturante.

Diferença para [`../task-history/`](../task-history/):

- **`task-history/`** = memória de execução (o que foi feito em cada task,
  padrões, warnings, follow-ups). Escrita **após toda task**.
- **`adr/`** = memória de decisões estruturantes (por que essa arquitetura e não
  outra). Escrita **quando surge a decisão** — pode ser em qualquer task.

Se você está adicionando uma lib nova, trocando um provider, mudando um padrão de
handler, ou definindo uma convenção que vai valer para tasks futuras: **é ADR**.

---

## Quando abrir uma ADR

Abra ADR quando a decisão:

- Afeta código que múltiplas tasks vão tocar (padrão de handler, convenção de fetch,
  estilo de erro)
- Escolhe entre alternativas com trade-offs relevantes (biblioteca A vs B, storage
  local vs cloud, sync vs async)
- Muda uma decisão anterior (troca de lib, refactor de padrão) — **crie ADR nova
  com status `Supersedes NNNN`**, não edite a ADR antiga
- Documenta uma restrição não-óbvia que vai enviesar futuras tasks (ex: "não usar
  Deno KV porque nosso plano de Supabase não suporta")

**Não** abra ADR para:

- Detalhes de implementação de uma task isolada (isso vai em `task-history/`)
- Escolhas triviais sem trade-off relevante (nome de variável, ordem de imports)
- Bugs e fixes pontuais

---

## Nomenclatura

`NNNN-titulo-em-kebab-case.md`

- `NNNN` = número sequencial de 4 dígitos, começando em `0001`
- Título curto que descreve **a decisão**, não o problema:
  - ✔ `0001-usar-tanstack-query-para-todo-acesso-a-dados.md`
  - ✔ `0002-scorecard-server-side-com-funcao-postgres.md`
  - ✘ `0003-pensar-em-caching.md` (não é decisão)
  - ✘ `0004-fix-transcript-bug.md` (é task, vai em `task-history/`)

Para descobrir o próximo número: `ls docs/adr/ | grep -E '^[0-9]{4}' | sort | tail -1`

---

## Template

Copie tudo abaixo para o arquivo novo e preencha:

```markdown
# NNNN — <título da decisão>

- **Status:** Proposed | Accepted | Deprecated | Superseded by [NNNN](NNNN-outro.md)
- **Data:** YYYY-MM-DD
- **Task relacionada:** [YYYY-MM-DD-slug](../task-history/YYYY-MM-DD-slug.md)
  (ou "N/A — decisão fora de task")

## Contexto

<Qual problema estamos resolvendo? Que restrições existem? Quais alternativas
consideramos? Deixe explícito o que é fato e o que é assunção.>

## Decisão

<O que decidimos, em 1–3 frases claras. Escreva no presente do indicativo — "Usamos
X para Y" — para deixar claro que é a regra atual, não uma proposta.>

## Consequências

**Positivas:**
- <o que fica melhor>

**Negativas / trade-offs aceitos:**
- <o que fica pior, ou o que estamos abrindo mão>

**Neutras:**
- <mudanças de padrão que exigem adaptação sem ser boas ou ruins>

## Alternativas consideradas

- **<Alternativa 1>** — <por que não escolhemos>
- **<Alternativa 2>** — <por que não escolhemos>

## Notas

<Links para docs externas, benchmarks, discussões, PRs. Opcional.>
```

---

## Status de uma ADR

- **Proposed** — em discussão, ainda não é regra
- **Accepted** — regra vigente, todo código novo segue
- **Deprecated** — não usar em código novo, mas o legado pode continuar
- **Superseded by [NNNN]** — foi substituída por uma decisão nova; a nova ADR aponta
  de volta com `Supersedes [antiga]` na primeira linha do contexto

Nunca **delete** uma ADR — o histórico de decisões (inclusive as revertidas) é o valor
da pasta.

---

## Decisões passadas do Aurora que **não** são ADRs

O [`docs/BLUEPRINT_RECRIACAO.md`](../BLUEPRINT_RECRIACAO.md) documenta várias decisões
arquiteturais tomadas na recriação (Google OAuth via Supabase nativo, remoção da
Edge Function `sign-transcripts`, migração para 8 migrations consolidadas, escolha de
`sonner` e `lucide-react` como padrões únicos, etc.).

**Não retro-fitamos essas como ADRs** — o Blueprint já é a fonte da verdade delas, e
transformá-las em ADRs individuais seria trabalho de historiador. ADRs cobrem decisões
**tomadas daqui pra frente**.

Se uma decisão do Blueprint precisar ser **revertida ou refinada**, aí sim abra uma
ADR nova referenciando a seção correspondente do Blueprint.
