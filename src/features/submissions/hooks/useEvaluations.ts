// ============================================================================
// useEvaluations — avaliações de uma submission
// ============================================================================
// Hook base para o painel de scorecard (usado por EvaluationsTab e futuros
// consumidores). Ordena desc por created_at; refetch controlado por chave.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type EvaluationRow = Database["public"]["Tables"]["evaluations"]["Row"];

async function fetchEvaluations(submissionId: string): Promise<EvaluationRow[]> {
  const { data, error } = await supabase
    .from("evaluations")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EvaluationRow[];
}

export function useEvaluations(submissionId: string | undefined) {
  return useQuery({
    queryKey: ["evaluations", submissionId ?? null],
    queryFn: () => fetchEvaluations(submissionId as string),
    enabled: !!submissionId,
    staleTime: 15_000,
  });
}
