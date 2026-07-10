// Versão read-only da aba Ongoing — usada na página /iniciativa/:id.
// Mostra semanas + documentos + reuniões + atas, SEM ações de criar/editar/
// excluir/upload. Apenas baixar documentos via signed URL.
//
// As ações destrutivas continuam concentradas no Centro de Comando (admin)
// via OngoingTab.tsx.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarOff, Download, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  StructuredMinutesView,
  type StructuredMinutes,
} from "./StructuredMinutesView";

// ─── Tipos ────────────────────────────────────────────────────────────────
interface OngoingViewerSectionProps {
  submissionId: string;
}

interface Week {
  id: string;
  submission_id: string;
  title: string;
  display_order: number | null;
  created_at: string;
}

interface Meeting {
  id: string;
  submission_id: string;
  title: string;
  meeting_date: string;
  smart_minutes: string | null;
  minutes_structured: StructuredMinutes | null;
  processing_status:
    | "pending"
    | "queued"
    | "processing"
    | "completed"
    | "failed"
    | null;
  error_message: string | null;
  week_id: string | null;
}

interface WeekDocument {
  id: string;
  week_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMeetingStatusBadge(meeting: Meeting) {
  if (meeting.processing_status === "queued" || meeting.processing_status === "processing") {
    return {
      label: "🤖 Processando",
      className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    };
  }
  if (meeting.processing_status === "failed") {
    return {
      label: "Falhou",
      className: "bg-destructive/20 text-destructive border-destructive/30",
    };
  }
  if (meeting.minutes_structured || meeting.smart_minutes) {
    return {
      label: "Ata gerada",
      className: "bg-accent/20 text-accent border-accent/30",
    };
  }
  if (new Date(meeting.meeting_date) > new Date()) {
    return {
      label: "Agendada",
      className: "bg-primary/20 text-primary border-primary/30",
    };
  }
  return {
    label: "Pendente",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────────────────────────────────
export function OngoingViewerSection({ submissionId }: OngoingViewerSectionProps) {
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  const { data: weeks, isLoading: isLoadingWeeks } = useQuery({
    queryKey: ["ongoing-weeks", submissionId],
    queryFn: async () => {
      const from = supabase.from("ongoing_weeks" as any) as any;
      const { data, error } = await from
        .select("*")
        .eq("submission_id", submissionId)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Week[];
    },
    enabled: !!submissionId,
  });

  const { data: meetings } = useQuery({
    queryKey: ["meetings", submissionId, "ongoing"],
    queryFn: async () => {
      const from = supabase.from("meetings") as any;
      const { data, error } = await from
        .select("*")
        .eq("submission_id", submissionId)
        .eq("category", "ongoing")
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Meeting[];
    },
    enabled: !!submissionId,
  });

  const { data: documents } = useQuery({
    queryKey: ["week-documents", submissionId],
    queryFn: async () => {
      const from = supabase.from("week_documents" as any) as any;
      const { data, error } = await from
        .select("*")
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WeekDocument[];
    },
    enabled: !!submissionId,
  });

  const meetingsByWeek = (meetings ?? []).reduce<Record<string, Meeting[]>>(
    (acc, m) => {
      if (!m.week_id) return acc;
      acc[m.week_id] = acc[m.week_id] ?? [];
      acc[m.week_id].push(m);
      return acc;
    },
    {},
  );

  const documentsByWeek = (documents ?? []).reduce<Record<string, WeekDocument[]>>(
    (acc, d) => {
      acc[d.week_id] = acc[d.week_id] ?? [];
      acc[d.week_id].push(d);
      return acc;
    },
    {},
  );

  const handleDownload = async (doc: WeekDocument) => {
    setDownloadingDocId(doc.id);
    try {
      // Baixa o arquivo via API do Supabase como Blob (evita ERR_BLOCKED_BY_CLIENT
      // de extensões de privacidade que bloqueiam URLs externas do Storage)
      const { data, error } = await supabase.storage
        .from("week-documents")
        .download(doc.file_path);
      if (error || !data) throw new Error(error?.message ?? "Arquivo indisponível");

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao baixar.");
    } finally {
      setDownloadingDocId(null);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  if (isLoadingWeeks) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  if (!weeks?.length) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <CalendarOff className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhuma semana registrada para esta iniciativa.
        </p>
      </div>
    );
  }

  return (
    <Accordion type="multiple" className="space-y-3">
      {weeks.map((week) => {
        const weekMeetings = meetingsByWeek[week.id] ?? [];
        const weekDocs = documentsByWeek[week.id] ?? [];
        return (
          <AccordionItem
            key={week.id}
            value={week.id}
            className="glass-card rounded-xl border-border/50 overflow-hidden"
          >
            <AccordionTrigger className="px-5 py-4 hover:no-underline">
              <div className="flex items-center gap-3 text-left flex-1 min-w-0">
                <span className="font-semibold text-sm text-foreground">
                  {week.title}
                </span>
                <div className="flex gap-1.5">
                  {weekMeetings.length > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {weekMeetings.length}{" "}
                      {weekMeetings.length === 1 ? "reunião" : "reuniões"}
                    </Badge>
                  )}
                  {weekDocs.length > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {weekDocs.length}{" "}
                      {weekDocs.length === 1 ? "documento" : "documentos"}
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 space-y-4">
              {/* Documentos */}
              {weekDocs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    📎 Documentos
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {weekDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 bg-background/40 border border-border/40 rounded-md px-3 py-2"
                      >
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate" title={doc.file_name}>
                            {doc.file_name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatFileSize(doc.file_size)} ·{" "}
                            {format(new Date(doc.created_at), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingDocId === doc.id}
                          title="Baixar"
                        >
                          {downloadingDocId === doc.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reuniões */}
              {weekMeetings.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  Sem reuniões nesta semana.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    📅 Reuniões
                  </p>
                  <Accordion type="single" collapsible className="space-y-2">
                    {weekMeetings.map((meeting) => {
                      const status = getMeetingStatusBadge(meeting);
                      return (
                        <AccordionItem
                          key={meeting.id}
                          value={meeting.id}
                          className="bg-background/40 border border-border/40 rounded-lg px-3 overflow-hidden"
                        >
                          <AccordionTrigger className="hover:no-underline py-2.5">
                            <div className="flex flex-col items-start gap-1 text-left mr-4">
                              <span className="font-medium text-sm">{meeting.title}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {format(
                                    new Date(meeting.meeting_date),
                                    "dd/MM/yyyy 'às' HH:mm",
                                    { locale: ptBR },
                                  )}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${status.className}`}
                                >
                                  {status.label}
                                </Badge>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3 pb-4">
                            {(meeting.processing_status === "queued" ||
                              meeting.processing_status === "processing") && (
                              <div className="flex items-center gap-3 py-3 px-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                <p className="text-sm text-blue-400">
                                  Aguardando o agente Volund OS gerar a ata estruturada…
                                </p>
                              </div>
                            )}
                            {meeting.processing_status === "failed" && (
                              <div className="py-3 px-3 rounded-lg bg-destructive/10 border border-destructive/30">
                                <p className="text-sm text-destructive font-semibold mb-1">
                                  Falha no processamento
                                </p>
                                {meeting.error_message && (
                                  <p className="text-xs text-destructive/80">
                                    {meeting.error_message}
                                  </p>
                                )}
                              </div>
                            )}
                            {meeting.minutes_structured && (
                              <StructuredMinutesView minutes={meeting.minutes_structured} />
                            )}
                            {meeting.smart_minutes && !meeting.minutes_structured && (
                              <div className="bg-card/40 border border-border/50 rounded-lg p-4">
                                <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">
                                  {meeting.smart_minutes}
                                </pre>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
