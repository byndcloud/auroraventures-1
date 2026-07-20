/**
 * RLS · call_responses INSERT
 * ============================================================================
 * Valida a policy endurecida na migration 20260720000000_fixes_p0_rls_and_integrity.
 * Um usuário autenticado só pode inserir resposta em `call_responses` quando:
 *   1. user_id = auth.uid()
 *   2. respondent_email casa com o email do JWT (case-insensitive)
 *   3. call.status = 'ativa'
 *   4. call.deadline IS NULL OU call.deadline >= CURRENT_DATE
 *
 * Cobrimos 4 casos:
 *   A. válido → INSERT OK
 *   B. respondent_email diferente do JWT → REJECT
 *   C. call em status 'encerrada' → REJECT
 *   D. call com deadline passada → REJECT
 *
 * Requer: SUPABASE_SERVICE_ROLE_KEY em .env.test.
 * ============================================================================
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const admin = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const anon = () =>
  createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

let cleanupUids: string[] = [];
let cleanupCallIds: string[] = [];

test.afterEach(async () => {
  if (!SERVICE_ROLE_KEY) return;
  const a = admin();
  // Delete calls first (cascade deleta call_responses)
  for (const id of cleanupCallIds) {
    await a.from("calls").delete().eq("id", id).then(() => {}, () => {});
  }
  for (const uid of cleanupUids) {
    await a.auth.admin.deleteUser(uid).catch(() => {});
  }
  cleanupCallIds = [];
  cleanupUids = [];
});

async function seedFounder(a: ReturnType<typeof admin>) {
  const email = `founder-call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;
  const pass = "testpassword123";
  const { data, error } = await a.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
  });
  expect(error).toBeNull();
  cleanupUids.push(data.user!.id);
  return { email, pass, userId: data.user!.id };
}

async function seedCall(
  a: ReturnType<typeof admin>,
  opts: { status?: string; deadline?: string | null } = {},
) {
  const { data, error } = await a
    .from("calls")
    .insert({
      title: `Call e2e ${Date.now()}`,
      description: "e2e",
      audience: "publica",
      status: opts.status ?? "ativa",
      deadline: opts.deadline ?? null,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  cleanupCallIds.push(data!.id);
  return data!.id;
}

test("caso A — respondent_email = JWT + call ativa sem deadline → OK", async () => {
  test.skip(!SERVICE_ROLE_KEY, "Requires SUPABASE_SERVICE_ROLE_KEY in .env.test");
  const a = admin();
  const { email, pass, userId } = await seedFounder(a);
  const callId = await seedCall(a, { status: "ativa", deadline: null });

  const c = anon();
  await c.auth.signInWithPassword({ email, password: pass });

  const { data, error } = await c
    .from("call_responses")
    .insert({
      call_id: callId,
      user_id: userId,
      respondent_email: email,
      response_data: { ok: true },
    })
    .select("id")
    .single();

  expect(error).toBeNull();
  expect(data?.id).toBeTruthy();
});

test("caso B — respondent_email DIFERENTE do JWT → REJECT", async () => {
  test.skip(!SERVICE_ROLE_KEY, "Requires SUPABASE_SERVICE_ROLE_KEY in .env.test");
  const a = admin();
  const { email, pass, userId } = await seedFounder(a);
  const callId = await seedCall(a);

  const c = anon();
  await c.auth.signInWithPassword({ email, password: pass });

  const { data, error } = await c
    .from("call_responses")
    .insert({
      call_id: callId,
      user_id: userId,
      respondent_email: "attacker@evil.com",
      response_data: { spoofed: true },
    })
    .select("id");

  expect(error).not.toBeNull();
  expect(data).toBeNull();
});

test("caso C — call em status 'encerrada' → REJECT", async () => {
  test.skip(!SERVICE_ROLE_KEY, "Requires SUPABASE_SERVICE_ROLE_KEY in .env.test");
  const a = admin();
  const { email, pass, userId } = await seedFounder(a);
  const callId = await seedCall(a, { status: "encerrada", deadline: null });

  const c = anon();
  await c.auth.signInWithPassword({ email, password: pass });

  const { data, error } = await c
    .from("call_responses")
    .insert({
      call_id: callId,
      user_id: userId,
      respondent_email: email,
      response_data: { late: true },
    })
    .select("id");

  expect(error).not.toBeNull();
  expect(data).toBeNull();
});

test("caso D — call com deadline PASSADA → REJECT", async () => {
  test.skip(!SERVICE_ROLE_KEY, "Requires SUPABASE_SERVICE_ROLE_KEY in .env.test");
  const a = admin();
  const { email, pass, userId } = await seedFounder(a);
  // Ontem
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const callId = await seedCall(a, { status: "ativa", deadline: yesterday });

  const c = anon();
  await c.auth.signInWithPassword({ email, password: pass });

  const { data, error } = await c
    .from("call_responses")
    .insert({
      call_id: callId,
      user_id: userId,
      respondent_email: email,
      response_data: { too_late: true },
    })
    .select("id");

  expect(error).not.toBeNull();
  expect(data).toBeNull();
});
