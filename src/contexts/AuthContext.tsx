import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  // Role pode ser null quando a linha em user_roles ainda não existe (trigger
  // falhou ou usuário criado antes do trigger). NUNCA fazer fallback silencioso
  // para "founder" — a UI deve tratar null como estado de erro/bloqueio.
  role: AppRole | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** true quando há sessão autenticada mas o usuário não tem role em `user_roles`. */
  roleError: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  roleError: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleError, setRoleError] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    // Authoritative role comes from user_roles (not profiles.role, which is a
    // mirror maintained by trigger and must never be used for authorization).
    const [{ data: profileRow }, { data: roleRow, error: roleErr }] = await Promise.all([
      supabase.from("profiles").select("id, user_id, full_name").eq("user_id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);

    if (!profileRow) {
      setProfile(null);
      setRoleError(false);
      return;
    }

    // Ausência de role = erro. Não fazer fallback para 'founder' — o front
    // deve mandar o usuário para /acesso-negado e o operador precisa saber
    // que o trigger handle_new_user não populou user_roles.
    const resolvedRole = (roleRow?.role as AppRole | undefined) ?? null;
    setProfile({
      id: profileRow.id,
      user_id: profileRow.user_id,
      full_name: profileRow.full_name ?? "",
      role: resolvedRole,
    });
    setRoleError(resolvedRole === null);

    if (resolvedRole === null) {
      // Log defensivo — pega falha do trigger em produção.
      console.error(
        "[auth] user_roles vazio para userId=%s. Verifique handle_new_user() e role_assignment_rules.",
        userId,
        roleErr,
      );
    }
  }, []);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on mount — covers the initial
    // session check, so no separate getSession() call is needed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setRoleError(false);
        }
        // loading drops only after profile is ready, preventing a role=null flash
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Role changes are managed server-side via user_roles + RLS. To avoid
  // exposing role-change events through Realtime to any authenticated user,
  // user_roles is NOT in the realtime publication; role updates take effect
  // on the next session refresh / page reload.


  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoleError(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, roleError, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
