/**
 * T1.1 — Auth flow e2e: signup → email confirmation → role-based activation
 *
 * Tests 1 and 2 run without any credentials.
 * Tests 3 and 4 require SUPABASE_SERVICE_ROLE_KEY in .env.test.
 * Get it from: Supabase Dashboard → Project Settings → API → service_role key
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function makeAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ProtectedRoute: unauthenticated access → redirect to /login
// ─────────────────────────────────────────────────────────────────────────────
test("unauthenticated access to protected route redirects to /login", async ({ page }) => {
  await page.goto("/dashboard-founder");
  await expect(page).toHaveURL(/\/login/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Login: invalid credentials → error toast
// ─────────────────────────────────────────────────────────────────────────────
test("login with invalid credentials shows error toast", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("nobody@invalid.com");
  await page.locator('input[type="password"]').fill("wrongpassword");
  await page.getByRole("button", { name: "Acessar Plataforma" }).click();
  await expect(page.getByText("E-mail ou senha inválidos")).toBeVisible({ timeout: 8000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 & 4 — Admin API: create pre-confirmed user, verify role-based redirect
// Requires: SUPABASE_SERVICE_ROLE_KEY in .env.test
// ─────────────────────────────────────────────────────────────────────────────
let cleanupUid: string | undefined;

test.afterEach(async () => {
  if (cleanupUid && SERVICE_ROLE_KEY) {
    await makeAdmin().auth.admin.deleteUser(cleanupUid).catch(() => {});
    cleanupUid = undefined;
  }
});

test(
  "@test.com email → role founder → redirects to /dashboard-founder",
  async ({ page }) => {
    test.skip(!SERVICE_ROLE_KEY, "Requires SUPABASE_SERVICE_ROLE_KEY in .env.test");

    const admin = makeAdmin();
    const email = `e2e-founder-${Date.now()}@test.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "testpassword123",
      email_confirm: true,
      user_metadata: { full_name: "E2E Founder" },
    });
    expect(error).toBeNull();
    cleanupUid = data.user?.id;

    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill("testpassword123");
    await page.getByRole("button", { name: "Acessar Plataforma" }).click();
    await expect(page).toHaveURL(/\/dashboard-founder/, { timeout: 12000 });
  }
);

test(
  "@volund.com.br email → role colaborador → redirects to /dashboard-colaborador",
  async ({ page }) => {
    test.skip(!SERVICE_ROLE_KEY, "Requires SUPABASE_SERVICE_ROLE_KEY in .env.test");

    const admin = makeAdmin();
    const email = `e2e-colab-${Date.now()}@volund.com.br`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "testpassword123",
      email_confirm: true,
      user_metadata: { full_name: "E2E Colaborador" },
    });
    expect(error).toBeNull();
    cleanupUid = data.user?.id;

    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill("testpassword123");
    await page.getByRole("button", { name: "Acessar Plataforma" }).click();
    await expect(page).toHaveURL(/\/dashboard-colaborador/, { timeout: 12000 });
  }
);
