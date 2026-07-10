import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: AppRole;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    // Authoritative role comes from user_roles (not profiles.role, which is a
    // mirror maintained by trigger and must never be used for authorization).
    const [{ data: profileRow }, { data: roleRow }] = await Promise.all([
      supabase.from("profiles").select("id, user_id, full_name").eq("user_id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);
    if (!profileRow) {
      setProfile(null);
      return;
    }
    setProfile({
      id: profileRow.id,
      user_id: profileRow.user_id,
      full_name: profileRow.full_name ?? "",
      role: (roleRow?.role ?? "founder") as AppRole,
    });
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
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
