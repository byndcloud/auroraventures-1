// INVARIANTE DE ARQUITETURA: Os dados deste componente são vinculados exclusivamente ao submission_id.
// O campo `status` da submissão (coluna do Kanban) não afeta a leitura nem a escrita do histórico.
// Ao mover um card entre colunas, apenas submissions.status é alterado no banco — os demais dados permanecem intactos.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Clock } from "lucide-react";
import { KANBAN_PHASES } from "./kanban";

interface HistoryEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  moved_by: string;
  moved_at: string;
  admin_name?: string;
}

interface SubmissionHistoryProps {
  submissionId: string;
}

export function SubmissionHistory({ submissionId }: SubmissionHistoryProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("submission_history")
        .select("*")
        .eq("submission_id", submissionId)
        .order("moved_at", { ascending: false });

      if (error) {
        console.error("History fetch error:", error);
        setLoading(false);
        return;
      }

      // Fetch admin names
      const userIds = [...new Set((data || []).map((d: any) => d.moved_by))];
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        profilesMap = Object.fromEntries(
          (profiles || []).map((p: any) => [p.user_id, p.full_name])
        );
      }

      setEntries(
        (data || []).map((d: any) => ({
          ...d,
          admin_name: profilesMap[d.moved_by] || "Admin",
        }))
      );
      setLoading(false);
    };
    fetch();
  }, [submissionId]);

  const getLabelForStatus = (status: string) =>
    KANBAN_PHASES.find((p) => p.key === status)?.label || status;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Carregando histórico…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <Clock className="w-8 h-8 opacity-40" />
        <p className="text-sm">Nenhuma movimentação registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Timeline line */}
      <div className="absolute left-4 top-3 bottom-3 w-px bg-border" />

      {entries.map((entry, i) => (
        <div key={entry.id} className="relative flex gap-4 pl-10 py-3">
          {/* Dot */}
          <div className="absolute left-[11px] top-[18px] w-[10px] h-[10px] rounded-full bg-primary/60 border-2 border-primary ring-2 ring-background" />

          {/* Card */}
          <div className="flex-1 rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground flex-wrap">
              {entry.from_status ? (
                <>
                  <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs">
                    {getLabelForStatus(entry.from_status)}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
                </>
              ) : (
                <span className="text-xs text-muted-foreground italic mr-1">Criação →</span>
              )}
              <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary text-xs font-semibold">
                {getLabelForStatus(entry.to_status)}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{formatDate(entry.moved_at)}</span>
              <span>•</span>
              <span>{entry.admin_name}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
