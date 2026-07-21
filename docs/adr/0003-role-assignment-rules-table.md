# 0003 — Atribuição de role via tabela `role_assignment_rules`

- **Status:** Accepted
- **Data:** 2026-07-20
- **Task relacionada:** [2026-07-20-fixes-tech-debt-triage](../task-history/2026-07-20-fixes-tech-debt-triage.md)

## Contexto

`public.handle_new_user()` (trigger `AFTER INSERT` em `auth.users`) atribuía role no signup com **e-mails/domínios hardcoded**:

```sql
IF _email IN ('rodrigo.miranda@beyondcompany.com.br',
              'filipe.moreira@beyondcompany.com.br') THEN
  _role := 'admin';
ELSIF _email LIKE '%@beyondcompany.com.br'
   OR _email LIKE '%@extreme.digital'
   OR _email LIKE '%@volund.com.br' THEN
  _role := 'colaborador';
ELSE
  _role := 'founder';
END IF;
```

A view `role_audit_divergences` duplicava o mesmo `CASE` para auditoria.

Problemas:
- **Adicionar admin novo exigia migration** — impede quick fix operacional.
- **Sem canal de configuração seguro** — Table Editor por admin exigiria escrever direto em `user_roles`, sem regra centralizada.
- **Drift entre trigger e view** — mudança em um lado sem o outro = auditoria mentindo.
- Casos concretos que motivaram a mudança: adicionar `liliane.oliveira@beyondcompany.com.br` como admin sem migration; futuros `viewer` externos (board de investidores) sem ter que abrir PR de SQL.

## Decisão

Criamos `public.role_assignment_rules` como fonte de verdade das regras + função de resolução `public.resolve_role_for_email(email)`:

```
role_assignment_rules(
  id UUID PK,
  match_type TEXT CHECK IN ('email','domain'),
  pattern TEXT,             -- lowercase, unique com match_type
  role app_role,
  priority INT DEFAULT 100, -- menor = mais forte
  note TEXT
)
```

- `handle_new_user()` reescrita para chamar `resolve_role_for_email()` (email exato → domínio → default `founder`).
- `role_audit_divergences` reescrita usando a mesma função (drift zero).
- Seed inicial dentro da migration + script `scripts/seed-role-rules.ts` para operação futura.
- Reconciliação: o script promove usuários existentes para `admin`/`viewer` quando o e-mail passa a bater uma regra nova. Nunca rebaixa.

## Consequências

**Positivas:**
- Adicionar admin/viewer novo: editar `scripts/seed-role-rules.ts` + `npm run seed:roles`. Zero migration.
- Auditoria (`role_audit_divergences`) sempre alinhada com o signup — mesma função.
- Priority permite exceção (ex.: email exato como `viewer` mesmo em domínio de `colaborador`).
- Seed idempotente: rodar 2x é NO-OP; adicionar regra + reconciliar = 1 comando.

**Negativas / trade-offs aceitos:**
- Regra deixou de estar imediatamente visível no código do trigger — quem lê `handle_new_user` precisa consultar a tabela para saber a política em vigor. Mitigação: comentário na função + entrada em `docs/SETUP_BANCO.md`.
- Precisa rodar seed antes do primeiro signup pós-deploy (mitigação: seed inicial embutido na própria migration; script só é necessário para *mudanças*).
- Depende de `SUPABASE_SERVICE_ROLE_KEY` para reconciliação (script chama `auth.admin.listUsers()`). Chave sensível — nunca commitar.

**Neutras:**
- Tabela nova em `public` com RLS: só `admin` lê pelo client; `service_role` escreve. `authenticated` tem GRANT SELECT mas policy defensiva restringe.

## Alternativas consideradas

- **Manter hardcoded e obrigar migration para cada mudança** — recusado: fricção operacional alta, incentiva quick-hack via Table Editor.
- **Tabela `admin_emails` só para exceções, resto por domínio** — recusado: partição artificial, ainda separa regras em dois lugares.
- **Env var com JSON** — recusado: Postgres não lê env do Deno; teria que passar via GUC ou reprocessar em cada deploy.
- **Gerenciar em `app_metadata` do JWT** — recusado: promove/rebaixa role sem passar pela regra central; RLS ficaria dependente de JWT frágil.

## Notas

- Migration: `supabase/migrations/20260720000200_role_assignment_rules.sql`
- Script: `scripts/seed-role-rules.ts` (rodar com `npm run seed:roles`)
- Doc: `docs/SETUP_BANCO.md` §3
- Seed inicial: rodrigo/filipe/liliane como `admin`; beyondcompany/extreme/volund como `colaborador`; resto `founder`.
