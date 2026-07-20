---
name: pre-analysis
description: >
  Classifica qualquer task de desenvolvimento antes de qualquer execução.
  É o primeiro skill a ser chamado em toda task, logo após a leitura de contexto.
  Determina se a task pode ir direto para execução (domínio único, Caminho A) ou
  se precisa passar pelo Advisor primeiro (múltiplos domínios ou alto impacto,
  Caminho B). Nunca implementa — apenas analisa e roteia.
---

# Pre-Analysis

Classifica a task e decide o roteamento:
execução direta (**Caminho A**) ou via Advisor (**Caminho B**).

## Inputs

| Variável | Obrigatório | Descrição |
|---|---|---|
| `TASK` | sim | Descrição completa da task recebida |
| `CONTEXT` | sim | Conteúdo do CLAUDE.md e referências lidas na Etapa 2 |
| `TASK_HISTORY` | não | Entradas relevantes de `docs/task-history/` |

## Execution flow

```
TASK + CONTEXT
  └─► Passo 1: Classificação da task
        └─► Passo 2: Regras de roteamento
              ├─► Caminho A → documento de execução direta
              └─► Caminho B → documento estruturado para o Advisor
```

## Passo 1 — Classificação

Leia a task completa. Identifique o que precisa mudar no código,
não apenas o título da task. Preencha o seguinte bloco:

```
tipo:                   feature | fix | refactor | chore
domínio_primário:       front | back | arquitetura | qa | segurança | infra
domínios_secundários:   [lista ou "nenhum"]
impacto:                alto | médio | baixo
dependência_técnica:    sim | não
  └─► se sim: [descreva a dependência — ex: "front precisa do endpoint que o back vai criar"]
ambiguidades:           [lista ou "nenhuma"]
contexto_da_memória:    [entradas de task-history aplicáveis ou "nenhum"]
```

### Critérios de impacto

| Nível | Quando aplicar |
|---|---|
| **alto** | Mudança estrutural, múltiplos módulos afetados, auth, dados sensíveis, risco de regressão ampla |
| **médio** | Novo endpoint ou componente isolado, sem dependência cross-stack |
| **baixo** | Ajuste visual, fix pontual em módulo único, atualização de teste |

## Passo 2 — Regras de roteamento

### Caminho A — Execução direta

Use quando **todos** os critérios abaixo forem verdadeiros:
- Há apenas um domínio primário **e** nenhum domínio secundário ativo
- Não há dependência técnica entre stacks
- Impacto é baixo ou médio **e** sem mudança estrutural

Exemplos:
- Ajuste de componente visual sem API nova
- Novo endpoint isolado sem impacto no frontend
- Fix de bug em módulo único
- Atualização de teste existente

### Caminho B — Via Advisor

Use quando **qualquer** critério abaixo for verdadeiro:
- Dois ou mais domínios com dependência entre si
- Mudança estrutural que impacta múltiplos skills
- Impacto alto, independente do número de domínios
- Ambiguidade sobre qual stack deve ser alterada primeiro
- Fix de segurança que exige alteração em outro domínio

Exemplos:
- Nova feature com API + tela (back depende do contrato, front depende do back)
- Refactor de módulo compartilhado entre front e back
- Fix de segurança que exige refatoração de endpoint
- Migração que afeta schema + queries + UI

## Passo 3 — Documento de saída

### Caminho A — Execução direta

```
## Resultado da pré-análise

**Rota:** EXECUÇÃO DIRETA

**Classificação:**
- Tipo: [tipo]
- Domínio: [domínio_primário]
- Impacto: [impacto]

**Skill a executar:** [nome do skill]

**Escopo de execução:**
[Descrição objetiva e específica do que o skill deve fazer nesta task.
Específica o suficiente para o agente executar sem ambiguidade.]

**Critérios de eval relevantes para esta task:**
- [critério específico extraído do SKILL.md do skill]
- [critério específico]

**Contexto da memória aplicável:**
- [decisão ou padrão anterior relevante, ou "nenhum"]

**Ambiguidades resolvidas:**
- [como cada ambiguidade foi resolvida, ou "nenhuma"]
```

### Caminho B — Via Advisor

```
## Resultado da pré-análise

**Rota:** VIA ADVISOR

**Classificação:**
- Tipo: [tipo]
- Domínio primário: [domínio]
- Domínios secundários: [lista]
- Impacto: [impacto]
- Dependência técnica: [descreva — ex: "front precisa do endpoint POST /x que o back vai criar"]

**Motivo para acionar o Advisor:**
[1-2 frases explicando por que esta task precisa de sequenciamento antes de implementar]

**Contexto da memória aplicável:**
- [decisão ou padrão anterior relevante, ou "nenhum"]

**Ambiguidades para o Advisor resolver:**
- [ambiguidade 1]
- [ambiguidade 2 ou "nenhuma"]
```

## Exemplos de roteamento

Consulte `references/routing-examples.md` para exemplos detalhados por tipo de task.
