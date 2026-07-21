// ============================================================================
// useMeetings — reuniões de uma submission (por categoria opcional)
// ============================================================================
// Substitui os fetches manuais que MeetingsTab / CheckpointMeetingsSection
// faziam por dentro dos monólitos. Categoria opcional: 'general' (aba
// Reuniões) ou 'ongoing' (aba Checkpoint).
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type MeetingRow = Database["public"]["Tables"]["meetings"]["Row"];
type MeetingCategory = "general" | "ongoing";

async function fetchMeetings(
  submissionId: string,
  category?: MeetingCategory,
): Promise<MeetingRow[]> {
  let q = supabase
    .from("meetings")
    .select(
      "id, submission_id, title, meeting_date, category, week_id, pre_agenda, smart_minutes, minutes_structured, transcript, transcript_url, transcript_path, source, volund_run_id, processing_status, error_message, processed_at, created_by, created_at, updated_at",
    )
    .eq("submission_id", submissionId)
    .order("meeting_date", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MeetingRow[];
}

export function useMeetings(
  submissionId: string | undefined,
  category?: MeetingCategory,
) {
  return useQuery({
    queryKey: ["meetings", submissionId ?? null, category ?? null],
    queryFn: () => fetchMeetings(submissionId as string, category),
    enabled: !!submissionId,
    staleTime: 15_000,
  });
}
