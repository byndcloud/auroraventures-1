---
name: advisor
description: >
  Planeja a execução de tasks multi-domínio. Acionado apenas quando o pre-analysis
  indicar Caminho B — tasks com múltiplos domínios dependentes, mudanças estruturais
  ou alto impacto. Recebe o documento do pre-analysis como input e produz um plano
  de execução sequenciado. Roda com Claude Opus 4.7. Nunca implementa.
---

# Advisor

Recebe o documento do pre-analysis (Caminho B) e produz um plano de execução
sequenciado com escopo definido para cada skill.

## Inputs

| Variável | Obrigatório | Descrição |
|---|---|---|
| `PRE_ANALYSIS_DOC` | sim | Documento de saída do pre-analysis (Caminho B) |
| `CONTEXT` | sim | Conteúdo do CLAUDE.md e referências lidas na Etapa 2 |
| `TASK_HISTORY` | não | Entradas relevantes de `docs/task-history/` |

Se `PRE_ANALYSIS_DOC` não for fornecido, solicite ao agente que execute
o skill **pre-analysis** antes de continuar.

## Execution flow

```
PRE_ANALYSIS_DOC
  └─► Passo 1: Leitura e validação do documento
        └─► Passo 2: Resolução de ambiguidades
              └─► Passo 3: Decisão de skills e sequenciamento
                    └─► Passo 4: Escopo por skill
                          └─► Passo 5: Identificação de riscos
                                └─► Plano de execução
```

## Passo 1 — Leitura e validação

Leia o documento do pre-analysis. Verifique:
- Os domínios envolvidos e a dependência declarada entre eles
- O impacto declarado
- As ambiguidades listadas que precisam de decisão
- O contexto da memória já identificado

Se o documento estiver incompleto ou inconsistente, sinalize e solicite que
o pre-analysis seja refeito antes de planejar.

## Passo 2 — Resolução de ambiguidades

Para cada ambiguidade listada pelo pre-analysis, tome uma decisão explícita
e documente o motivo. Esta é a etapa mais crítica — uma decisão errada aqui
gera retrabalho em todos os skills seguintes.

Formato:
```
[ambiguidade] → [decisão tomada] — Motivo: [justificativa em 1 frase]
```

## Passo 3 — Skills e sequenciamento

### Regras de ativação de skills

| Condição da task | Skill |
|---|---|
| Mudança visual, componente ou página | `front` |
| Novo endpoint, serviço ou lógica de negócio | `back` |
| Novo módulo, mudança de dependências entre camadas, decisão de design de sistema | `arquitetura` |
| Qualquer mudança que altere comportamento observável | `qa` |
| Auth, autorização, dados sensíveis, inputs externos, integrações | `segurança` |

> Em caso de dúvida, ative o skill. É melhor um eval desnecessário
> do que pular uma validação importante.

### Regras de sequenciamento

Consulte `references/sequencing-rules.md` para as regras completas com exemplos.

Resumo das dependências técnicas:

| Situação | Ordem |
|---|---|
| Mudança estrutural presente | `arquitetura` sempre primeiro |
| Front depende de API nova | `back` antes de `front` |
| Fix de segurança define o que o back muda | `segurança` antes de `back` |
| Segurança é validação (não definição) | `back` antes de `segurança` |
| Validação do conjunto completo | `qa` sempre por último |

## Passo 4 — Escopo por skill

Para cada skill ativado, defina o escopo específico para **esta task em particular**.
Não use descrições genéricas — o escopo deve ser específico o suficiente para
o agente executar sem ambiguidade.

Formato por skill:
```
[skill]: [o que exatamente deve ser feito nesta task]
  → Depende de: [skill anterior, se houver, e o motivo]
  → Entrega para: [skill seguinte, se houver, e o que é entregue]
```

## Passo 5 — Riscos

Liste riscos antes da execução. Para cada risco, classifique a probabilidade.

Riscos comuns a considerar:
- Mudanças que quebram contratos existentes (APIs, interfaces compartilhadas)
- Dependências externas que podem falhar durante a implementação
- Pontos onde backward compatibility pode ser afetada
- Áreas com cobertura de teste insuficiente (verificar task-history)
- Skills que dependem de decisões ainda não tomadas

## Plano de execução — formato de saída

```
## Plano de execução

**Task:** [resumo]
**Tipo:** feature | fix | refactor | chore
**Impacto:** alto | médio | baixo

**Ambiguidades resolvidas:**
- [ambiguidade] → [decisão] — Motivo: [justificativa]

**Ordem de execução:**

1. [skill]
   Escopo: [o que fazer nesta task]
   Depende de: —
   Entrega para: [próximo skill e o que é passado adiante]

2. [skill]
   Escopo: [o que fazer nesta task]
   Depende de: [skill anterior] — [motivo da dependência]
   Entrega para: [próximo skill ou "commit"]

...

**Riscos identificados:**
- [risco] — Probabilidade: alta | média | baixa

**Confirmação necessária antes de iniciar:** sim | não
  └─► se sim: [motivo — ex: impacto alto, risco de regressão em produção]
```

## Regras do Advisor

- Nunca inicie a execução — entregue o plano e aguarde o agente prosseguir.
- Nunca repita o trabalho do pre-analysis — use o documento dele como base.
- Em caso de rejeição no review gate com feedback de replanejamento:
  leia o feedback, identifique quais steps precisam ser refeitos,
  e produza um plano de re-execução parcial — não refaça tudo do zero
  se apenas parte da implementação foi rejeitada.
- Se o task-history indicar que uma decisão similar já foi tomada antes,
  sinalize e use como referência antes de tomar uma nova decisão contraditória.
