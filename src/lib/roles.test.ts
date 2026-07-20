// ============================================================================
// getDashboardPath — unit tests
// ============================================================================
// Cobre os 4 roles válidos + fallback. Nunca deve retornar caminho de admin
// para não-admin (defense-in-depth junto com RLS).
// ============================================================================
import { describe, it, expect } from "vitest";
import { getDashboardPath } from "./roles";

describe("getDashboardPath", () => {
  it("returns /admin for role 'admin'", () => {
    expect(getDashboardPath("admin")).toBe("/admin");
  });

  it("returns /dashboard-colaborador for role 'colaborador'", () => {
    expect(getDashboardPath("colaborador")).toBe("/dashboard-colaborador");
  });

  it("returns /dashboard-viewer for role 'viewer'", () => {
    expect(getDashboardPath("viewer")).toBe("/dashboard-viewer");
  });

  it("returns /dashboard-founder for role 'founder'", () => {
    expect(getDashboardPath("founder")).toBe("/dashboard-founder");
  });

  it("returns / for unexpected role (defense-in-depth fallback)", () => {
    // Cast intencional: valida o `default` do switch em runtime. Em prod, TS
    // barra qualquer valor fora do enum, mas o `default` protege contra
    // dados corrompidos vindos do banco (ex: nova role adicionada sem
    // atualizar getDashboardPath).
    expect(getDashboardPath("intruso" as never)).toBe("/");
  });

  it("never routes non-admin to /admin", () => {
    const nonAdmin = ["colaborador", "viewer", "founder"] as const;
    for (const role of nonAdmin) {
      expect(getDashboardPath(role)).not.toBe("/admin");
    }
  });
});
