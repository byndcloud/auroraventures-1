import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export function getDashboardPath(role: AppRole): string {
  switch (role) {
    case "admin": return "/admin";
    case "colaborador": return "/dashboard-colaborador";
    case "viewer": return "/dashboard-viewer";
    case "founder": return "/dashboard-founder";
    default: return "/";
  }
}
