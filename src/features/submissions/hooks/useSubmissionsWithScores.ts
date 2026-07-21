// ============================================================================
// useSubmissionsWithScores — hook TanStack Query compartilhado
// ============================================================================
// Consolida a query de submissions + avaliação mais recente (completed) por
// submission. Usado por Admin (kanban) e DashboardViewer (kanban read-only).
//
// RLS é a fonte da verdade de permissão — o hook não filtra por role. Admin
// vê tudo, viewer vê tudo, founder recebe só as próprias via policy.
//
// Refresh: `useSubmissionsWithScores().refetch()` substitui os `fetchData`
// manuais das páginas.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KanbanSubmission } from "@/components/admin/kanban";
import { SubmissionOrigin } from "@/components/admin/common";

interface FetchOptions {
  /**
   * Colunas extras a incluir. Admin precisa de `briefing` no card; viewer não.
   * Default: sem `briefing`.
   */
  includeBriefing?: boolean;
  /**
   * Limite superior. Default 500 (mesmo valor das páginas legadas).
   */
  limit?: number;
}

interface ScoreRow {
  submission_id: string;
  scores: unknown;
  final_score: number | null;
  has_veto: boolean | null;
  verdict: string | null;
  created_at: string;
}

async function fetchSubmissionsWithScores(
  opts: FetchOptions,
): Promise<KanbanSubmission[]> {
  const limit = opts.limit ?? 500;
  // 2 branches para preservar tipagem forte do supabase-js.
  const query = opts.includeBriefing
    ? supabase
        .from("submissions")
        .select("id, project_name, type, status, created_at, user_id, due_date, briefing, data")
    : supabase
        .from("submissions")
        .select("id, project_name, type, status, created_at, user_id, due_date, data");

  const { data: subs, error: subsErr } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (subsErr) throw subsErr;

  const { data: scoresData } = await supabase
    .from("evaluations")
    .select("submission_id, scores, final_score, has_veto, verdict, created_at")
    .eq("processing_status", "completed")
    .order("created_at", { ascending: false });

  const scoresMap = new Map<string, KanbanSubmission["scores"]>();
  ((scoresData ?? []) as ScoreRow[]).forEach((s) => {
    if (!scoresMap.has(s.submission_id)) {
      scoresMap.set(s.submission_id, {
        scores: s.scores as Record<string, number | boolean>,
        final_score: s.final_score ?? 0,
        has_veto: !!s.has_veto,
        verdict: s.verdict ?? "",
      });
    }
  });

  return ((subs ?? []) as Array<Record<string, unknown>>).map((s) => ({
    id: s.id as string,
    project_name: s.project_name as string,
    type: s.type as SubmissionOrigin,
    status: s.status as string,
    data:
      typeof s.data === "object" && s.data !== null
        ? (s.data as Record<string, unknown>)
        : {},
    created_at: s.created_at as string,
    user_id: s.user_id as string,
    due_date: (s.due_date as string | null) ?? null,
    scores: scoresMap.get(s.id as string) ?? null,
  }));
}

export function useSubmissionsWithScores(opts: FetchOptions = {}) {
  const key = ["submissions-with-scores", opts.includeBriefing ?? false, opts.limit ?? 500];
  return useQuery({
    queryKey: key,
    queryFn: () => fetchSubmissionsWithScores(opts),
    staleTime: 30_000,
  });
}
