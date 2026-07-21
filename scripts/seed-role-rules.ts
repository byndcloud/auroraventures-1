/**
 * seed-role-rules.ts
 * ============================================================================
 * Seed idempotente da tabela `public.role_assignment_rules` +
 * reconciliação de `public.user_roles` para usuários existentes.
 *
 * Uso:
 *   SUPABASE_URL=https://xxxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
 *   npm run seed:roles
 *
 * Comportamento:
 *   1. Faz UPSERT das regras abaixo (edite este arquivo para adicionar novos
 *      admins/viewers/domínios). Rodar 2x é NO-OP.
 *   2. Percorre `auth.users` e, se o email casa uma regra `admin` ou `viewer`
 *      que difere do `user_roles` atual, adiciona a role esperada e remove a
 *      antiga (promoção idempotente, nunca rebaixa `viewer` explícito).
 *
 * Segurança:
 *   - Requer SUPABASE_SERVICE_ROLE_KEY. Nunca commitar a chave.
 *   - Não escreve em `profiles.role` diretamente (o trigger sync propaga).
 * ============================================================================
 */

import { createClient } from "@supabase/supabase-js";

type MatchType = "email" | "domain";
type AppRole = "founder" | "colaborador" | "admin" | "viewer";

interface RoleRule {
  match_type: MatchType;
  pattern: string;
  role: AppRole;
  priority?: number;
  note?: string;
}

// ─── EDITE AQUI para adicionar/remover admins, viewers, domínios ───────────
const RULES: RoleRule[] = [
  // Admins
  { match_type: "email", pattern: "rodrigo.miranda@beyondcompany.com.br", role: "admin", priority: 10, note: "seed inicial" },
  { match_type: "email", pattern: "filipe.moreira@beyondcompany.com.br",  role: "admin", priority: 10, note: "seed inicial" },
  { match_type: "email", pattern: "liliane.oliveira@beyondcompany.com.br", role: "admin", priority: 10, note: "seed inicial" },

  // Colaboradores por domínio
  { match_type: "domain", pattern: "beyondcompany.com.br", role: "colaborador", priority: 100, note: "seed inicial" },
  { match_type: "domain", pattern: "extreme.digital",      role: "colaborador", priority: 100, note: "seed inicial" },
  { match_type: "domain", pattern: "volund.com.br",        role: "colaborador", priority: 100, note: "seed inicial" },

  // Viewers externos: adicionar aqui exemplos como
  // { match_type: "email", pattern: "diretora@empresa-parceira.com", role: "viewer", note: "board externo" },
];
// ──────────────────────────────────────────────────────────────────────────

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const SUPABASE_URL = assertEnv("SUPABASE_URL");
  const SERVICE_ROLE = assertEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`▶ Aurora — seed-role-rules  (${RULES.length} regras)`);

  // 1) UPSERT das regras
  const { error: upsertErr } = await admin
    .from("role_assignment_rules")
    .upsert(
      RULES.map((r) => ({
        match_type: r.match_type,
        pattern: r.pattern.toLowerCase(),
        role: r.role,
        priority: r.priority ?? 100,
        note: r.note ?? null,
      })),
      { onConflict: "match_type,pattern" },
    );
  if (upsertErr) {
    console.error("✗ Falha ao upsertar regras:", upsertErr.message);
    process.exit(1);
  }
  console.log(`  ✓ ${RULES.length} regras aplicadas (UPSERT idempotente)`);

  // 2) Reconciliação: qualquer usuário existente cuja regra dá admin/viewer
  //    mas que hoje tem outra role → promove (adiciona nova + remove antiga).
  //    NÃO rebaixa nem toca em viewer manual.
  const { data: users, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) {
    console.error("✗ Falha ao listar usuários:", listErr.message);
    process.exit(1);
  }

  let promoted = 0;
  for (const user of users?.users ?? []) {
    if (!user.email) continue;
    const emailLower = user.email.toLowerCase();

    // Descobre expected via RPC (mesma função que o trigger usa)
    const { data: expectedData, error: rpcErr } = await admin.rpc(
      "resolve_role_for_email",
      { _email: emailLower },
    );
    if (rpcErr) {
      console.error(`  ! ${emailLower}: falha ao resolver role (${rpcErr.message})`);
      continue;
    }
    const expected = expectedData as AppRole | null;
    if (!expected || (expected !== "admin" && expected !== "viewer")) continue;

    // Roles atuais do usuário
    const { data: currentRoles, error: rolesErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (rolesErr) {
      console.error(`  ! ${emailLower}: falha ao ler user_roles (${rolesErr.message})`);
      continue;
    }
    const roles = (currentRoles ?? []).map((r) => r.role as AppRole);
    if (roles.includes(expected)) continue;

    // Adiciona a esperada
    const { error: insertErr } = await admin
      .from("user_roles")
      .insert({ user_id: user.id, role: expected });
    if (insertErr) {
      console.error(`  ! ${emailLower}: falha ao inserir role ${expected} (${insertErr.message})`);
      continue;
    }

    // Remove roles divergentes (menos 'viewer' manual — se o esperado for admin, remove só colaborador/founder)
    const toDelete = roles.filter((r) => r !== "viewer" && r !== expected);
    if (toDelete.length > 0) {
      const { error: delErr } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", user.id)
        .in("role", toDelete);
      if (delErr) {
        console.warn(`  ! ${emailLower}: role ${expected} adicionada mas falhou ao remover ${toDelete.join(",")} (${delErr.message})`);
      }
    }

    promoted++;
    console.log(`  ✓ ${emailLower}: [${roles.join(",")}] → [${expected}]`);
  }

  console.log(`\n▶ Reconciliação concluída: ${promoted} usuário(s) atualizados`);
}

main().catch((err: unknown) => {
  console.error("✗ Erro fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
