# 0001 — Fonte única do scorecard vive no Postgres via trigger

- **Status:** Accepted
- **Data:** 2026-07-20
- **Task relacionada:** [2026-07-20-fixes-tech-debt-triage](../task-history/2026-07-20-fixes-tech-debt-triage.md)

## Contexto

O modelo do scorecard (§2.5 do [BLUEPRINT](../BLUEPRINT_RECRIACAO.md)) é:

```
Nota Final = (Bloco 1 × 0.60) + (Bloco 2 × 0.40)
Bloco 2 varia por origem: mercado | interna | editais
Vetos: qualquer flag `veto_<key>` = true → verdict = 'REPROVADO'
Sem veto: >80 Aprovar · ≥60 Amadurecer · caso contrário Kill
```

Herdada do projeto Lovable, a fórmula existia em **três lugares**:

1. `src/components/admin/scorecard.ts` (`calcFinalScore`, `checkVetos`, `getVerdict`) — front lia o valor no submit e persistia em `evaluations`.
2. `supabase/functions/volund-evaluation-callback/index.ts` — Edge Function recalculava ao receber o payload do agente e atualizava as mesmas colunas.
3. `evaluations.final_score` / `has_veto` / `verdict` — colunas persistidas, sem trigger.

Efeitos:
- Regra de negócio central duplicada em dois runtimes.
- Divergência silenciosa se alguém alterasse pesos em um lado.
- Nenhuma garantia de que `INSERT` direto (ex: seed, correção manual) respeitasse a fórmula.

Alternativas:
- **Manter no front** — mais rápido, mas cliente decide regra de negócio: RLS não protege consistência.
- **Manter só no Edge Function** — front continua duplicando para exibir preview enquanto edita.
- **Fonte única no Postgres via trigger** — regra vive no banco; front e Edge Function só gravam `scores`, banco recalcula.

## Decisão

Movemos a fórmula para `public.compute_evaluation_verdict(scores, submission_type)` + trigger `evaluations_recompute_verdict_trigger` (BEFORE INSERT/UPDATE em `public.evaluations`).

- Front (`scorecard.ts`): mantém metadata (`BLOCO1_FIELDS`, `BLOCO2_FIELDS`, `SCORECARD_META`) e renomeia funções de cálculo para `previewFinalScore`/`previewHasVeto`/`previewVerdict` — usadas **só** para prévia enquanto o admin preenche o form.
- Edge Function (`volund-evaluation-callback`): grava só `scores`. Trigger recalcula.
- `_shared/scorecard-schema.ts` (novo): metadata sem matemática, para a Edge Function normalizar payload sem reintroduzir cálculo.

## Consequências

**Positivas:**
- Fórmula em um só lugar; migration é o único vetor de mudança.
- INSERTs manuais (seed, correção via dashboard) também respeitam a regra.
- Testabilidade: dá para escrever unit test SQL da função sem subir front.

**Negativas / trade-offs aceitos:**
- Mudanças de peso agora exigem migration + deploy Supabase (não mais só build front).
- Metadata de UI (`BLOCO1_FIELDS.weight`) precisa espelhar exatamente o Postgres — se divergir, preview do front some da verdade. Convenção: revisar os dois arquivos no mesmo PR.
- Trigger reexecuta a fórmula em toda UPDATE de `scores` — custo desprezível (12+7 loops JSON).

**Neutras:**
- Front perdeu `final_score`/`has_veto`/`verdict` no payload de save; agora refetcha após salvar para exibir o valor autoritativo.

## Alternativas consideradas

- **Manter só no Edge Function e obrigar todo write via Edge Function** — inviabilizaria o rascunho manual em `ScorecardForm`, que precisa gravar sem esperar callback.
- **Constraint `CHECK` em `evaluations`** — impossível expressar a fórmula em CHECK.
- **View materializada** — bom para leitura, mas não impõe consistência de write.

## Notas

- Migration: `supabase/migrations/20260720000100_compute_evaluation_verdict.sql`
- Função: `SECURITY DEFINER STABLE`, sem side effects — retorna `{final_score, has_veto, verdict}`.
- Trigger só recalcula se `scores` tem pelo menos uma nota numérica ou flag booleana (evita marcar "Kill" em rascunho vazio).
