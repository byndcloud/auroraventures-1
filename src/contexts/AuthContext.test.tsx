// ============================================================================
// AuthContext — unit tests (comportamento de role e fallback removido)
// ============================================================================
// Foco: garantir que a remoção do fallback silencioso `?? "founder"` de fato
// resolve os 3 caminhos críticos:
//   1. role presente em user_roles      → profile.role = role, roleError=false
//   2. role AUSENTE em user_roles       → profile.role = null,  roleError=true
//   3. profile ausente em profiles      → profile = null,       roleError=false
//
// Mock: substituímos o client Supabase por stubs mínimos por teste. Isso
// mantém o teste hermético (não depende de rede) e valida só a lógica de
// resolução dentro do provider.
// ============================================================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AuthProvider, useAuth } from "./AuthContext";

// ─── Mock do client Supabase ──────────────────────────────────────────────
type SelectResult = { data: unknown; error: unknown };

let profilesResult: SelectResult = { data: null, error: null };
let userRolesResult: SelectResult = { data: null, error: null };
let onAuthChangeHandler:
  | ((event: string, session: unknown) => void | Promise<void>)
  | null = null;

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      auth: {
        onAuthStateChange: (
          cb: (event: string, session: unknown) => void | Promise<void>,
        ) => {
          onAuthChangeHandler = cb;
          return {
            data: { subscription: { unsubscribe: () => {} } },
          };
        },
        signOut: async () => ({ error: null }),
      },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: async () => (table === "profiles" ? profilesResult : userRolesResult),
            maybeSingle: async () => (table === "user_roles" ? userRolesResult : profilesResult),
          }),
        }),
      }),
    },
  };
});

// Silencia o console.error do fallback documentado (caso 2) para não poluir a saída.
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

function ProbeConsumer() {
  const { profile, roleError, loading } = useAuth();
  if (loading) return <div data-testid="state">loading</div>;
  return (
    <div>
      <div data-testid="role">{profile?.role ?? "NULL"}</div>
      <div data-testid="roleError">{roleError ? "true" : "false"}</div>
      <div data-testid="hasProfile">{profile ? "yes" : "no"}</div>
    </div>
  );
}

async function fireLogin(userId: string) {
  if (!onAuthChangeHandler) throw new Error("handler não registrado");
  await onAuthChangeHandler("SIGNED_IN", {
    user: { id: userId, email: "test@example.com" },
  });
}

beforeEach(() => {
  onAuthChangeHandler = null;
  profilesResult = { data: null, error: null };
  userRolesResult = { data: null, error: null };
  consoleErrorSpy.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("AuthContext.fetchProfile", () => {
  it("caso 1 — role presente: profile.role hidrata, roleError=false", async () => {
    profilesResult = {
      data: { id: "p1", user_id: "u1", full_name: "Alice" },
      error: null,
    };
    userRolesResult = { data: { role: "admin" }, error: null };

    render(
      <AuthProvider>
        <ProbeConsumer />
      </AuthProvider>,
    );

    await fireLogin("u1");

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("admin");
    });
    expect(screen.getByTestId("roleError")).toHaveTextContent("false");
    expect(screen.getByTestId("hasProfile")).toHaveTextContent("yes");
  });

  it("caso 2 — role AUSENTE: profile.role=null, roleError=true, console.error", async () => {
    profilesResult = {
      data: { id: "p2", user_id: "u2", full_name: "Bob" },
      error: null,
    };
    userRolesResult = { data: null, error: null }; // maybeSingle devolve data=null

    render(
      <AuthProvider>
        <ProbeConsumer />
      </AuthProvider>,
    );

    await fireLogin("u2");

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("NULL");
    });
    expect(screen.getByTestId("roleError")).toHaveTextContent("true");
    expect(screen.getByTestId("hasProfile")).toHaveTextContent("yes");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("caso 3 — profile ausente: profile=null, roleError=false (não é erro de role)", async () => {
    profilesResult = { data: null, error: null };
    userRolesResult = { data: { role: "founder" }, error: null };

    render(
      <AuthProvider>
        <ProbeConsumer />
      </AuthProvider>,
    );

    await fireLogin("u3");

    await waitFor(() => {
      expect(screen.getByTestId("hasProfile")).toHaveTextContent("no");
    });
    expect(screen.getByTestId("roleError")).toHaveTextContent("false");
  });
});
