// ============================================================================
// useMySubmissions — submissions do próprio usuário (founder/colaborador)
// ============================================================================
// Consolida a query `submissions.select('*').eq('user_id', user.id)` que
// DashboardFounder e DashboardColaborador replicavam. RLS já filtra por
// user_id, mas o .eq redundante mantém contrato explícito.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SubmissionRow = Database["public"]["Tables"]["submissions"]["Row"];

async function fetchMySubmissions(userId: string): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubmissionRow[];
}

export function useMySubmissions(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-submissions", userId ?? null],
    queryFn: () => fetchMySubmissions(userId as string),
    enabled: !!userId,
    staleTime: 30_000,
  });
}
