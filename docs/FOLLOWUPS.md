# Follow-ups

Tarefas conhecidas que ficam pendentes após a reestruturação do banco
([`SETUP_BANCO.md`](./SETUP_BANCO.md)). Priorizar conforme necessidade.

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
