/**
 * XMPVAS0HE — Founder isolation
 * ============================================================================
 * Requisito obrigatório do CLAUDE.md e do BLUEPRINT §3.7.
 * Um usuário `founder` só pode ler as PRÓPRIAS submissions. Tentar ler ou
 * modificar submissions de outro founder deve ser rejeitado pela RLS, mesmo
 * usando o cliente Supabase com JWT válido.
 *
 * Requer:
 *   - SUPABASE_SERVICE_ROLE_KEY em .env.test (para criar os 2 founders + seed)
 *   - VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (client anon)
 *
 * O teste faz tudo via HTTP client (sem UI) — objetivo é validar a RLS,
 * não o front. Rápido e determinístico.
 * ============================================================================
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anon() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let cleanupUids: string[] = [];

test.afterEach(async () => {
  if (!SERVICE_ROLE_KEY) return;
  const a = admin();
  for (const uid of cleanupUids) {
    await a.auth.admin.deleteUser(uid).catch(() => {});
  }
  cleanupUids = [];
});

test("founder A não vê submissions do founder B (XMPVAS0HE)", async () => {
  test.skip(!SERVICE_ROLE_KEY, "Requires SUPABASE_SERVICE_ROLE_KEY in .env.test");
  const a = admin();

  // Cria 2 founders (@test.com cai em 'founder' pela regra default).
  const emailA = `founder-a-${Date.now()}@test.com`;
  const emailB = `founder-b-${Date.now()}@test.com`;
  const pass = "testpassword123";

  const { data: uA, error: eA } = await a.auth.admin.createUser({
    email: emailA,
    password: pass,
    email_confirm: true,
    user_metadata: { full_name: "Founder A" },
  });
  expect(eA).toBeNull();
  cleanupUids.push(uA.user!.id);

  const { data: uB, error: eB } = await a.auth.admin.createUser({
    email: emailB,
    password: pass,
    email_confirm: true,
    user_metadata: { full_name: "Founder B" },
  });
  expect(eB).toBeNull();
  cleanupUids.push(uB.user!.id);

  // Seed 1 submission para cada founder via service_role (bypass RLS)
  const { data: subA, error: sErrA } = await a
    .from("submissions")
    .insert({
      user_id: uA.user!.id,
      project_name: "Projeto A",
      type: "mercado",
      status: "Discovery & Pitch",
      data: {},
    })
    .select("id")
    .single();
  expect(sErrA).toBeNull();

  const { data: subB, error: sErrB } = await a
    .from("submissions")
    .insert({
      user_id: uB.user!.id,
      project_name: "Projeto B",
      type: "mercado",
      status: "Discovery & Pitch",
      data: {},
    })
    .select("id")
    .single();
  expect(sErrB).toBeNull();

  // Cliente A autentica e tenta ver TODAS submissions
  const clientA = anon();
  const { error: loginErr } = await clientA.auth.signInWithPassword({
    email: emailA,
    password: pass,
  });
  expect(loginErr).toBeNull();

  const { data: visible, error: listErr } = await clientA
    .from("submissions")
    .select("id, user_id, project_name");
  expect(listErr).toBeNull();

  const visibleIds = (visible ?? []).map((s) => s.id);
  // Founder A vê a própria; NÃO vê a de B.
  expect(visibleIds).toContain(subA!.id);
  expect(visibleIds).not.toContain(subB!.id);

  // Tentativa direta de UPDATE na submission de B deve falhar (0 linhas afetadas)
  const { data: upd, error: updErr } = await clientA
    .from("submissions")
    .update({ project_name: "hijacked" })
    .eq("id", subB!.id)
    .select();
  // RLS não retorna erro — retorna 0 linhas. Ambos os cenários são aceitáveis.
  expect(updErr).toBeNull();
  expect(upd ?? []).toHaveLength(0);

  // Confirma via service_role que o project_name original não foi alterado
  const { data: verify } = await a
    .from("submissions")
    .select("project_name")
    .eq("id", subB!.id)
    .single();
  expect(verify?.project_name).toBe("Projeto B");
});
