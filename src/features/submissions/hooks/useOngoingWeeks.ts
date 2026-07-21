// ============================================================================
// useOngoingWeeks — semanas da fase Ongoing de uma submission
// ============================================================================
// Consolidação para CheckpointMeetingsSection, VestingWeeklySection e
// futuros consumidores. Ordenado por display_order NULLS LAST → created_at.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type OngoingWeekRow = Database["public"]["Tables"]["ongoing_weeks"]["Row"];

async function fetchOngoingWeeks(submissionId: string): Promise<OngoingWeekRow[]> {
  const { data, error } = await supabase
    .from("ongoing_weeks")
    .select("*")
    .eq("submission_id", submissionId)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OngoingWeekRow[];
}

export function useOngoingWeeks(submissionId: string | undefined) {
  return useQuery({
    queryKey: ["ongoing-weeks", submissionId ?? null],
    queryFn: () => fetchOngoingWeeks(submissionId as string),
    enabled: !!submissionId,
    staleTime: 20_000,
  });
}
