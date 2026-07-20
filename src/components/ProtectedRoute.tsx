import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth();

  if (loading || (session && !profile)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Sessão autenticada mas sem role (trigger handle_new_user falhou ou
  // user_roles vazio). Não há default silencioso — bloqueia o acesso.
  if (session && profile && profile.role === null) {
    return <Navigate to="/acesso-negado" replace />;
  }

  if (allowedRoles && profile && profile.role !== null && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/acesso-negado" replace />;
  }

  return <>{children}</>;
}
