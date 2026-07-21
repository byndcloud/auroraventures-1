// INVARIANTE DE ARQUITETURA: Os dados deste componente são vinculados exclusivamente ao submission_id.
// O campo `status` da submissão (coluna do Kanban) não afeta a leitura nem a escrita das reuniões.
// Ao mover um card entre colunas, apenas submissions.status é alterado no banco - os demais dados permanecem intactos.
//
// TODO(monolith-split): quebrar este arquivo (≈750L) conforme §6.5 do BLUEPRINT em:
//   - MeetingsUploadPanel     (dropzone + fila de upload)
//   - MeetingAccordion        (item da lista com ata estruturada + dialogs)
//   - MeetingMinutesViewer    (render standalone da minutes_structured)
// Rastreamento: docs/FOLLOWUPS.md · "Monolith split — MeetingsTab".

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarOff,
  Pencil,
  Loader2,
  Download,
  FileUp,
  X,
  Trash2,
} from "lucide-react";
import {
  StructuredMinutesView,
  type StructuredMinutes,
} from "./StructuredMinutesView";
import { EditMeetingDialog } from "./EditMeetingDialog";
import { EditMinutesDialog } from "./EditMinutesDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

type MeetingCategory = "general" | "ongoing";

interface MeetingsTabProps {
  submissionId: string;
  // Categoria das reuniões a exibir/criar nesta aba.
  // 'general' (default) = aba Reuniões
  // 'ongoing'           = aba Ongoing (só visível quando a iniciativa está na fase)
  category?: MeetingCategory;
}

// Configuração do fluxo Volund OS (escopo de módulo)
const VOLUND_ACCEPTED = [".txt", ".vtt", ".srt", ".md"];
const VOLUND_MAX_FILES = 10;
const VOLUND_MAX_SIZE_MB = 50;

// Cada arquivo a ser enviado ao Volund: o usuário pode ajustar título e data
// antes do envio. `id` é local (uuid) só pra usar como key no React.
interface PendingFile {
  id: string;
  file: File;
  title: string;
  meetingDate: string; // formato datetime-local: "YYYY-MM-DDTHH:mm"
}

function nowDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultTitleFromFile(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

// Sanitiza o nome do arquivo para usar como key no Supabase Storage.
// Remove acentos/cedilhas, substitui espaços e caracteres especiais por '_'.
// O nome ORIGINAL continua sendo usado como título da reunião.
const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");
function sanitizeFileName(name: string): string {
  const sanitized = name
    .normalize("NFD")                          // separa caracteres acentuados
    .replace(DIACRITICS_RE, "")                // remove diacríticos combinantes
    .replace(/[^a-zA-Z0-9._-]/g, "_")          // substitui qualquer outro char por _
    .replace(/_+/g, "_")                       // colapsa múltiplos underscores
    .replace(/^_+|_+$/g, "");                  // remove _ no início e no fim
  return sanitized || "file";
}

interface Meeting {
  id: string;
  submission_id: string;
  title: string;
  meeting_date: string;
  pre_agenda: string | null;
  transcript: string | null;
  transcript_url: string | null;
  transcript_path: string | null;
  smart_minutes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Novos campos do fluxo Volund OS (coexistem com o fluxo manual)
  source: string | null;
  volund_run_id: string | null;
  processing_status:
    | "pending"
    | "queued"
    | "processing"
    | "completed"
    | "failed"
    | null;
  error_message: string | null;
  processed_at: string | null;
  minutes_structured: StructuredMinutes | null;
}


function getMeetingStatus(meeting: Meeting) {
  // Estados do fluxo Volund OS (tem prioridade visual)
  if (meeting.processing_status === "queued" || meeting.processing_status === "processing") {
    return { label: "🤖 Processando", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  }
  if (meeting.processing_status === "failed") {
    return { label: "Falhou", className: "bg-destructive/20 text-destructive border-destructive/30" };
  }
  // Ata existente (estruturada do Volund ou markdown do fluxo manual)
  if (meeting.minutes_structured || meeting.smart_minutes) {
    return { label: "Ata Gerada", className: "bg-accent/20 text-accent border-accent/30" };
  }
  if (new Date(meeting.meeting_date) > new Date()) {
    return { label: "Agendada", className: "bg-primary/20 text-primary border-primary/30" };
  }
  return { label: "Pendente de Ata", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
}

export function MeetingsTab({ submissionId, category = "general" }: MeetingsTabProps) {
  const queryClient = useQueryClient();
  const isOngoing = category === "ongoing";

  const [editingMinutes, setEditingMinutes] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");

  // Fluxo Volund OS — drop de múltiplos arquivos de transcrição
  const [isVolundDialogOpen, setIsVolundDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploadingVolund, setIsUploadingVolund] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const volundFileInputRef = useRef<HTMLInputElement>(null);

  // Edição/exclusão de reuniões
  const [editMetadataMeeting, setEditMetadataMeeting] = useState<Meeting | null>(null);
  const [editMinutesMeeting, setEditMinutesMeeting] = useState<Meeting | null>(null);
  const [deleteMeeting, setDeleteMeeting] = useState<Meeting | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings", submissionId, category],
    queryFn: async () => {
      // NOTE: cast até regenerar src/integrations/supabase/types.ts com
      // `npm run gen:types` (colunas category/week_id/transcript_path).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fromMeetings = supabase.from("meetings") as any;
      const { data, error } = await fromMeetings
        .select("*")
        .eq("submission_id", submissionId)
        .eq("category", category)
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Meeting[];
    },
    enabled: !!submissionId,
  });

  // Baixa a transcrição assinando o PATH do Storage sob demanda.
  // transcript_path é a fonte preferida; para reuniões antigas (que só têm a
  // signed URL expirada em transcript_url), extrai o path da URL.
  const handleDownloadTranscript = async (meeting: Meeting) => {
    const path =
      meeting.transcript_path ?? extractTranscriptPath(meeting.transcript_url);
    if (!path) {
      toast.error("Transcrição indisponível para esta reunião.");
      return;
    }
    const { data, error } = await supabase.storage
      .from("transcripts")
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Erro ao gerar link de download.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  // Realtime: atualiza a aba quando o Volund completa o processamento
  useEffect(() => {
    if (!submissionId) return;
    const channel = supabase
      .channel(`meetings:${submissionId}:${category}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "meetings",
          filter: `submission_id=eq.${submissionId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["meetings", submissionId, category] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [submissionId, category, queryClient]);

  const handleSaveMinutesEdit = async (meetingId: string) => {
    const { error } = await supabase
      .from("meetings")
      .update({ smart_minutes: editedContent })
      .eq("id", meetingId);
    if (error) {
      toast.error("Erro ao salvar alterações.");
    } else {
      toast.success("Ata atualizada com sucesso!");
      setEditingMinutes(null);
      queryClient.invalidateQueries({ queryKey: ["meetings", submissionId, category] });
    }
  };

  const startEditing = (meeting: Meeting) => {
    setEditedContent(meeting.smart_minutes || "");
    setEditingMinutes(meeting.id);
  };

  // ---------------------------------------------------------------------------
  // Exclusão de reunião
  // ---------------------------------------------------------------------------
  // Extrai o path original do arquivo no Storage a partir da signed URL
  // armazenada em meeting.transcript_url.
  // Exemplo: https://xxx.supabase.co/storage/v1/object/sign/transcripts/<path>?token=...
  function extractTranscriptPath(signedUrl: string | null): string | null {
    if (!signedUrl) return null;
    const match = signedUrl.match(/\/object\/sign\/transcripts\/([^?]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  const handleConfirmDelete = async () => {
    if (!deleteMeeting) return;
    setIsDeleting(true);
    try {
      // Remove o arquivo do Storage (se aplicável)
      const path =
        deleteMeeting.transcript_path ??
        extractTranscriptPath(deleteMeeting.transcript_url);
      if (path) {
        const { error: storageErr } = await supabase.storage
          .from("transcripts")
          .remove([path]);
        // Se o arquivo já não existir, não trava o delete da row
        if (storageErr && !/not found/i.test(storageErr.message)) {
          console.warn("Erro ao remover transcrição do Storage:", storageErr.message);
        }
      }

      // Remove o registro
      const { error } = await supabase
        .from("meetings")
        .delete()
        .eq("id", deleteMeeting.id);
      if (error) throw error;

      toast.success("Reunião excluída.");
      queryClient.invalidateQueries({ queryKey: ["meetings", submissionId, category] });
      setDeleteMeeting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir reunião.");
    } finally {
      setIsDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Fluxo Volund OS: drop de múltiplos arquivos → upload → Edge Function
  // ---------------------------------------------------------------------------
  const validateVolundFiles = useCallback((files: File[]): PendingFile[] => {
    const valid: PendingFile[] = [];
    const now = nowDatetimeLocal();
    for (const f of files) {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      if (!VOLUND_ACCEPTED.includes(ext)) {
        toast.error(`"${f.name}": formato não suportado (use ${VOLUND_ACCEPTED.join(", ")})`);
        continue;
      }
      if (f.size > VOLUND_MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`"${f.name}": maior que ${VOLUND_MAX_SIZE_MB}MB`);
        continue;
      }
      valid.push({
        id: crypto.randomUUID(),
        file: f,
        title: defaultTitleFromFile(f.name),
        meetingDate: now,
      });
    }
    return valid.slice(0, VOLUND_MAX_FILES);
  }, []);

  const handleVolundDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    setPendingFiles((prev) => [...prev, ...validateVolundFiles(dropped)].slice(0, VOLUND_MAX_FILES));
  };

  const handleVolundFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    setPendingFiles((prev) => [...prev, ...validateVolundFiles(picked)].slice(0, VOLUND_MAX_FILES));
    e.target.value = "";
  };

  const handleVolundSubmit = async () => {
    if (!pendingFiles.length) {
      toast.error("Selecione ao menos um arquivo de transcrição.");
      return;
    }
    // Validar título e data por arquivo
    for (const pf of pendingFiles) {
      if (!pf.title.trim()) {
        toast.error(`Preencha o título da reunião para "${pf.file.name}".`);
        return;
      }
      if (!pf.meetingDate) {
        toast.error(`Preencha a data da reunião para "${pf.file.name}".`);
        return;
      }
    }
    setIsUploadingVolund(true);
    try {
      // Upload SEQUENCIAL ao Storage (não paralelo) — evita "Failed to fetch"
      // do navegador saturando conexões simultâneas. Sanitiza nome para o
      // path (Storage não aceita acentos/espaços/cedilhas nas keys); título e
      // data vêm do PendingFile (que o usuário pode ter editado antes).
      // Continua a fila se algum falhar e relata no final.
      const uploads: Array<{
        fileName: string;
        storagePath: string;
        title: string;
        meetingDate: string;
      }> = [];
      const failures: string[] = [];

      for (const pf of pendingFiles) {
        try {
          const safeName = sanitizeFileName(pf.file.name);
          const path = `${submissionId}/${crypto.randomUUID()}-${safeName}`;
          const { error } = await supabase.storage
            .from("transcripts")
            .upload(path, pf.file, { upsert: false });
          if (error) throw new Error(error.message);
          uploads.push({
            fileName: pf.file.name,
            storagePath: path,
            title: pf.title.trim(),
            meetingDate: new Date(pf.meetingDate).toISOString(),
          });
        } catch (err) {
          failures.push(
            `${pf.file.name}: ${err instanceof Error ? err.message : "erro desconhecido"}`,
          );
        }
      }

      if (uploads.length === 0) {
        toast.error(`Nenhum arquivo subiu. Erros:\n${failures.join("\n")}`);
        return;
      }

      // Dispara Edge Function que enfileira tudo no Volund
      const { error: invokeErr } = await supabase.functions.invoke("upload-meetings", {
        body: { submissionId, files: uploads, category },
      });
      if (invokeErr) throw new Error(invokeErr.message);

      if (failures.length > 0) {
        toast.warning(
          `${uploads.length} transcrição(ões) enviada(s). ${failures.length} falhou(aram):\n${failures.join("\n")}`,
        );
      } else {
        toast.success(
          `${uploads.length} transcrição(ões) enviada(s). As atas aparecem aqui assim que o Volund terminar.`,
        );
      }
      setPendingFiles([]);
      setIsVolundDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["meetings", submissionId, category] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao importar transcrições";
      toast.error(message);
    } finally {
      setIsUploadingVolund(false);
    }
  };

  const removePendingFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((pf) => pf.id !== id));
  };

  const updatePendingFile = (id: string, patch: Partial<PendingFile>) => {
    setPendingFiles((prev) =>
      prev.map((pf) => (pf.id === id ? { ...pf, ...patch } : pf)),
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-medium text-muted-foreground">
          Reuniões desta iniciativa antes do fechamento da parceria
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsVolundDialogOpen(true)}
        >
          <FileUp className="w-4 h-4 mr-2" />
          Importar transcrições
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : !meetings?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarOff className="w-10 h-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhuma reunião registrada.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Agende a primeira reunião acima.
          </p>
        </div>
      ) : (
        <Accordion type="single" collapsible className="space-y-2">
          {meetings.map((meeting) => {
            const status = getMeetingStatus(meeting);
            return (
              <AccordionItem
                key={meeting.id}
                value={meeting.id}
                className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-xl px-4 overflow-hidden"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex flex-col items-start gap-1 text-left mr-4">
                    <span className="font-semibold text-sm text-foreground">
                      {meeting.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(meeting.meeting_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${status.className}`}>
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  {/* Ações da reunião (admin) */}
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditMetadataMeeting(meeting)}
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Editar reunião
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteMeeting(meeting)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Excluir
                    </Button>
                  </div>

                  {/* C.1) Status de processamento Volund (queued/processing/failed) */}
                  {(meeting.processing_status === "queued" ||
                    meeting.processing_status === "processing") && (
                    <div className="flex items-center gap-3 py-4 px-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
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
                        <p className="text-xs text-destructive/80">{meeting.error_message}</p>
                      )}
                    </div>
                  )}

                  {/* C.2) Ata estruturada (Volund) — quando presente, tem prioridade */}
                  {meeting.minutes_structured && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditMinutesMeeting(meeting)}
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          Editar ata
                        </Button>
                      </div>
                      <StructuredMinutesView minutes={meeting.minutes_structured} />
                    </div>
                  )}

                  {/* C.3) Ata em markdown (fluxo manual antigo) */}
                  {meeting.smart_minutes && !meeting.minutes_structured && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-accent">✅ Ata da Reunião</p>
                        <div className="flex items-center gap-1">
                          {(meeting.transcript_path || meeting.transcript_url) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadTranscript(meeting)}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Transcrição
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(meeting)}
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            Editar Ata
                          </Button>
                        </div>
                      </div>
                      {editingMinutes === meeting.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="min-h-[300px] font-mono text-xs"
                          />
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => setEditingMinutes(null)}>
                              Cancelar
                            </Button>
                            <Button size="sm" onClick={() => handleSaveMinutesEdit(meeting.id)}>
                              Salvar Alterações
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-lg p-4">
                          <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">
                            {meeting.smart_minutes}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Editar metadados (título, data, link) */}
      <EditMeetingDialog
        meeting={editMetadataMeeting}
        onClose={() => setEditMetadataMeeting(null)}
      />

      {/* Editar ata estruturada (campos JSONB) */}
      <EditMinutesDialog
        meetingId={editMinutesMeeting?.id ?? null}
        submissionId={submissionId}
        initialMinutes={editMinutesMeeting?.minutes_structured ?? null}
        onClose={() => setEditMinutesMeeting(null)}
      />

      {/* Confirmação de exclusão */}
      <AlertDialog
        open={!!deleteMeeting}
        onOpenChange={(open) => !open && !isDeleting && setDeleteMeeting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir reunião</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a reunião <strong>"{deleteMeeting?.title}"</strong>{" "}
              e o arquivo de transcrição associado no Storage.{" "}
              <span className="text-destructive font-medium">Não é possível desfazer.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Volund Import Dialog — drop de múltiplos arquivos */}
      <Dialog
        open={isVolundDialogOpen}
        onOpenChange={(open) => {
          if (!isUploadingVolund) {
            setIsVolundDialogOpen(open);
            if (!open) setPendingFiles([]);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar transcrições</DialogTitle>
            <DialogDescription>
              Arraste até {VOLUND_MAX_FILES} arquivos de transcrição
              ({VOLUND_ACCEPTED.join(", ")}). Você pode ajustar título e data
              de cada reunião antes de enviar. O agente Volund OS vai gerar
              uma ata estruturada para cada uma.
            </DialogDescription>
          </DialogHeader>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleVolundDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border/50"
            }`}
          >
            <FileUp className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-foreground mb-1">
              Arraste arquivos aqui ou clique para escolher
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Aceita {VOLUND_ACCEPTED.join(", ")} · até {VOLUND_MAX_SIZE_MB}MB cada
            </p>
            <input
              type="file"
              multiple
              accept={VOLUND_ACCEPTED.join(",")}
              className="hidden"
              ref={volundFileInputRef}
              onChange={handleVolundFilePick}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => volundFileInputRef.current?.click()}
              disabled={isUploadingVolund}
            >
              Selecionar arquivos
            </Button>
          </div>

          {pendingFiles.length > 0 && (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              <p className="text-xs font-semibold text-muted-foreground">
                {pendingFiles.length} reuniã{pendingFiles.length === 1 ? "o" : "ões"} a importar — ajuste título e data antes de enviar
              </p>
              {pendingFiles.map((pf) => (
                <div
                  key={pf.id}
                  className="bg-card/40 border border-border/50 rounded-lg p-3 space-y-2 relative"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-muted-foreground truncate min-w-0 flex-1">
                      📎 {pf.file.name}
                      <span className="ml-2 text-[10px]">
                        {(pf.file.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-mt-1 -mr-1 h-6 w-6 p-0"
                      onClick={() => removePendingFile(pf.id)}
                      disabled={isUploadingVolund}
                      title="Remover"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground">
                        Título da reunião
                      </label>
                      <Input
                        className="h-8 mt-1"
                        value={pf.title}
                        onChange={(e) =>
                          updatePendingFile(pf.id, { title: e.target.value })
                        }
                        disabled={isUploadingVolund}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground">
                        Data e hora
                      </label>
                      <Input
                        type="datetime-local"
                        className="h-8 mt-1"
                        value={pf.meetingDate}
                        onChange={(e) =>
                          updatePendingFile(pf.id, { meetingDate: e.target.value })
                        }
                        disabled={isUploadingVolund}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingFiles([]);
                setIsVolundDialogOpen(false);
              }}
              disabled={isUploadingVolund}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleVolundSubmit}
              disabled={isUploadingVolund || pendingFiles.length === 0}
            >
              {isUploadingVolund && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar para o Volund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
