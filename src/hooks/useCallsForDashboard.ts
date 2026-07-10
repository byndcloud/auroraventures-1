import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Call } from "@/components/dashboard/CallsCarousel";

async function fetchCallsForDashboard(
  role: "colaborador" | "founder",
  userId: string
): Promise<Call[]> {
  const type = role === "colaborador" ? "interno" : "mercado";

  // 1. Active calls for this profile
  let activeQuery = supabase
    .from("calls")
    .select("*")
    .eq("call_type", type)
    .eq("status", "ativa")
    .order("created_at", { ascending: false });

  if (role === "founder") {
    activeQuery = activeQuery.eq("visibility", "publica");
  }

  const { data: activeCalls } = await activeQuery;

  // 2. Call IDs where user already responded
  const { data: myResponses } = await supabase
    .from("call_responses")
    .select("call_id")
    .eq("user_id", userId);

  const respondedIds = myResponses?.map((r) => r.call_id) ?? [];

  // 3. Closed calls where user participated
  let closedCalls: Call[] = [];
  if (respondedIds.length > 0) {
    let closedQuery = supabase
      .from("calls")
      .select("*")
      .eq("call_type", type)
      .eq("status", "encerrada")
      .in("id", respondedIds)
      .order("created_at", { ascending: false });

    if (role === "founder") {
      closedQuery = closedQuery.eq("visibility", "publica");
    }

    const { data } = await closedQuery;
    closedCalls = (data as Call[]) ?? [];
  }

  return [...((activeCalls as Call[]) ?? []), ...closedCalls];
}

export function useCallsForDashboard(
  role: "colaborador" | "founder",
  userId: string | undefined
) {
  return useQuery({
    queryKey: [`dashboard-calls-${role}`, userId],
    queryFn: () => fetchCallsForDashboard(role, userId!),
    enabled: Boolean(userId),
  });
}
