// Seção "Reuniões de checkpoint" — agrupa reuniões em "semanas".
// Extraída da antiga OngoingTab: a aba Ongoing ficou só com o dashboard de
// indicadores (vesting) e este conteúdo passou a viver na aba Reuniões,
// dentro do dropdown "Reuniões de checkpoint".
//
// TODO(monolith-split): quebrar este arquivo (≈1400L) conforme §6.5 do
// BLUEPRINT em:
//   - WeekAccordion         (accordion de uma semana, com header + botões)
//   - WeekDocumentsList     (upload/lista/download de week_documents)
//   - WeekMeetingsList      (lista de meetings da semana + dialogs)
//   - WeekNotesForm         (notas editáveis por semana — quando implementado)
// Rastreamento: docs/FOLLOWUPS.md · "Monolith split — CheckpointMeetingsSection".
//
// Estrutura:
//   - Botão "Inserir Semana" no header (cria nova semana)
//   - Lista de semanas em accordion
//     - Cada semana tem botão "Importar transcrições" próprio + lista de
//       reuniões/atas geradas pelo Volund OS
//
// Reúsa: StructuredMinutesView (render da ata), EditMinutesDialog,
//        EditMeetingDialog, e a Edge Function `upload-meetings` (com `weekId`
//        no payload).
//
// As reuniões aqui têm:
//   - category = 'ongoing'
//   - week_id  = <id da semana>
//
// NOTE: usa cast `as any` nas queries por enquanto, até os types do Supabase
// serem regenerados com `category` e `week_id`.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarOff,
  Plus,
  Pencil,
  Trash2,
  FileUp,
  Loader2,
  X,
  Download,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  StructuredMinutesView,
  type StructuredMinutes,
} from "./StructuredMinutesView";
import { EditMeetingDialog } from "./EditMeetingDialog";
import { EditMinutesDialog } from "./EditMinutesDialog";

// ─── Tipos ────────────────────────────────────────────────────────────────
interface CheckpointMeetingsSectionProps {
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
  transcript_url: string | null;
  transcript_path: string | null;
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
  created_at: string;
}

interface PendingFile {
  id: string;
  file: File;
  title: string;
  meetingDate: string;
}

interface WeekDocument {
  id: string;
  week_id: string;
  submission_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string | null;
  created_at: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────
const VOLUND_ACCEPTED = [".txt", ".vtt", ".srt", ".md"];
const VOLUND_MAX_FILES = 10;
const VOLUND_MAX_SIZE_MB = 50;

const DOC_ACCEPTED = [".pdf", ".pptx", ".docx", ".doc", ".ppt", ".xlsx", ".xls"];
const DOC_MAX_FILES = 20;
const DOC_MAX_SIZE_MB = 100;

const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");
function sanitizeFileName(name: string): string {
  const sanitized = name
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized || "file";
}

function nowDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultTitleFromFile(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function getMeetingStatus(meeting: Meeting) {
  if (meeting.processing_status === "queued" || meeting.processing_status === "processing") {
    return { label: "🤖 Processando", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  }
  if (meeting.processing_status === "failed") {
    return { label: "Falhou", className: "bg-destructive/20 text-destructive border-destructive/30" };
  }
  if (meeting.minutes_structured || meeting.smart_minutes) {
    return { label: "Ata Gerada", className: "bg-accent/20 text-accent border-accent/30" };
  }
  if (new Date(meeting.meeting_date) > new Date()) {
    return { label: "Agendada", className: "bg-primary/20 text-primary border-primary/30" };
  }
  return { label: "Pendente de Ata", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
}

function extractTranscriptPath(signedUrl: string | null): string | null {
  if (!signedUrl) return null;
  const match = signedUrl.match(/\/object\/sign\/transcripts\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ──────────────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────────────
export function CheckpointMeetingsSection({ submissionId }: CheckpointMeetingsSectionProps) {
  const queryClient = useQueryClient();

  // Estados de dialogs
  const [isNewWeekOpen, setIsNewWeekOpen] = useState(false);
  const [newWeekTitle, setNewWeekTitle] = useState("");
  const [isCreatingWeek, setIsCreatingWeek] = useState(false);

  const [renameWeek, setRenameWeek] = useState<Week | null>(null);
  const [renameWeekTitle, setRenameWeekTitle] = useState("");
  const [isRenamingWeek, setIsRenamingWeek] = useState(false);

  const [deleteWeek, setDeleteWeek] = useState<Week | null>(null);
  const [isDeletingWeek, setIsDeletingWeek] = useState(false);

  // Estados de edição/exclusão de reunião
  const [editMetadataMeeting, setEditMetadataMeeting] = useState<Meeting | null>(null);
  const [editMinutesMeeting, setEditMinutesMeeting] = useState<Meeting | null>(null);
  const [deleteMeeting, setDeleteMeeting] = useState<Meeting | null>(null);
  const [isDeletingMeeting, setIsDeletingMeeting] = useState(false);

  // Upload por semana — guarda o weekId atual
  const [uploadWeek, setUploadWeek] = useState<Week | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploadingVolund, setIsUploadingVolund] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload de documentos por semana
  const [docUploadWeek, setDocUploadWeek] = useState<Week | null>(null);
  const [pendingDocs, setPendingDocs] = useState<File[]>([]);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);
  const [isDocDragging, setIsDocDragging] = useState(false);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  // Exclusão de documento
  const [deleteDoc, setDeleteDoc] = useState<WeekDocument | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // ─── Queries ────────────────────────────────────────────────────────────
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

  // Realtime: invalida lista de reuniões quando o Volund completa
  useEffect(() => {
    if (!submissionId) return;
    const channel = supabase
      .channel(`ongoing-meetings:${submissionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "meetings",
          filter: `submission_id=eq.${submissionId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["meetings", submissionId, "ongoing"],
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [submissionId, queryClient]);

  // Agrupa reuniões por week_id
  const meetingsByWeek = (meetings ?? []).reduce<Record<string, Meeting[]>>(
    (acc, m) => {
      if (!m.week_id) return acc;
      acc[m.week_id] = acc[m.week_id] ?? [];
      acc[m.week_id].push(m);
      return acc;
    },
    {},
  );

  // Agrupa documentos por week_id
  const documentsByWeek = (documents ?? []).reduce<Record<string, WeekDocument[]>>(
    (acc, d) => {
      acc[d.week_id] = acc[d.week_id] ?? [];
      acc[d.week_id].push(d);
      return acc;
    },
    {},
  );

  // ─── Handlers de semana ─────────────────────────────────────────────────
  const handleCreateWeek = async () => {
    if (!newWeekTitle.trim()) {
      toast.error("Informe o título da semana.");
      return;
    }
    setIsCreatingWeek(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const from = supabase.from("ongoing_weeks" as any) as any;
      const { error } = await from.insert({
        submission_id: submissionId,
        title: newWeekTitle.trim(),
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Semana criada.");
      setNewWeekTitle("");
      setIsNewWeekOpen(false);
      queryClient.invalidateQueries({ queryKey: ["ongoing-weeks", submissionId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar semana.");
    } finally {
      setIsCreatingWeek(false);
    }
  };

  const handleRenameWeek = async () => {
    if (!renameWeek) return;
    if (!renameWeekTitle.trim()) {
      toast.error("Informe o título.");
      return;
    }
    setIsRenamingWeek(true);
    try {
      const from = supabase.from("ongoing_weeks" as any) as any;
      const { error } = await from
        .update({ title: renameWeekTitle.trim() })
        .eq("id", renameWeek.id);
      if (error) throw error;
      toast.success("Semana renomeada.");
      setRenameWeek(null);
      queryClient.invalidateQueries({ queryKey: ["ongoing-weeks", submissionId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao renomear semana.");
    } finally {
      setIsRenamingWeek(false);
    }
  };

  const handleConfirmDeleteWeek = async () => {
    if (!deleteWeek) return;
    setIsDeletingWeek(true);
    try {
      // 1) Apaga os arquivos de transcrição das reuniões dessa semana no Storage
      const meetingsToDelete = (meetings ?? []).filter((m) => m.week_id === deleteWeek.id);
      const transcriptPaths = meetingsToDelete
        .map((m) => m.transcript_path ?? extractTranscriptPath(m.transcript_url))
        .filter((p): p is string => !!p);
      if (transcriptPaths.length > 0) {
        const { error: storageErr } = await supabase.storage.from("transcripts").remove(transcriptPaths);
        if (storageErr && !/not found/i.test(storageErr.message)) {
          console.warn("Falha parcial ao remover transcrições:", storageErr.message);
        }
      }
      // 2) Apaga os documentos da semana no Storage
      const docsToDelete = (documents ?? []).filter((d) => d.week_id === deleteWeek.id);
      const docPaths = docsToDelete.map((d) => d.file_path);
      if (docPaths.length > 0) {
        const { error: storageErr } = await supabase.storage
          .from("week-documents")
          .remove(docPaths);
        if (storageErr && !/not found/i.test(storageErr.message)) {
          console.warn("Falha parcial ao remover documentos:", storageErr.message);
        }
      }
      // 3) Apaga a semana (CASCADE deleta meetings + week_documents rows)
      const from = supabase.from("ongoing_weeks" as any) as any;
      const { error } = await from.delete().eq("id", deleteWeek.id);
      if (error) throw error;
      toast.success("Semana excluída.");
      setDeleteWeek(null);
      queryClient.invalidateQueries({ queryKey: ["ongoing-weeks", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["meetings", submissionId, "ongoing"] });
      queryClient.invalidateQueries({ queryKey: ["week-documents", submissionId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir semana.");
    } finally {
      setIsDeletingWeek(false);
    }
  };

  // ─── Handlers de exclusão de reunião ────────────────────────────────────
  const handleConfirmDeleteMeeting = async () => {
    if (!deleteMeeting) return;
    setIsDeletingMeeting(true);
    try {
      const path =
        deleteMeeting.transcript_path ??
        extractTranscriptPath(deleteMeeting.transcript_url);
      if (path) {
        const { error: storageErr } = await supabase.storage.from("transcripts").remove([path]);
        if (storageErr && !/not found/i.test(storageErr.message)) {
          console.warn("Erro ao remover transcrição:", storageErr.message);
        }
      }
      const { error } = await supabase.from("meetings").delete().eq("id", deleteMeeting.id);
      if (error) throw error;
      toast.success("Reunião excluída.");
      setDeleteMeeting(null);
      queryClient.invalidateQueries({ queryKey: ["meetings", submissionId, "ongoing"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir reunião.");
    } finally {
      setIsDeletingMeeting(false);
    }
  };

  // ─── Documentos da semana (PDF/PPTX/DOCX/etc.) ──────────────────────────
  const openDocUpload = (week: Week) => {
    setDocUploadWeek(week);
    setPendingDocs([]);
  };

  const closeDocUpload = () => {
    if (isUploadingDocs) return;
    setDocUploadWeek(null);
    setPendingDocs([]);
  };

  const validateDocs = useCallback((files: File[]): File[] => {
    const valid: File[] = [];
    for (const f of files) {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      if (!DOC_ACCEPTED.includes(ext)) {
        toast.error(`"${f.name}": formato não suportado.`);
        continue;
      }
      if (f.size > DOC_MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`"${f.name}": maior que ${DOC_MAX_SIZE_MB}MB.`);
        continue;
      }
      valid.push(f);
    }
    return valid.slice(0, DOC_MAX_FILES);
  }, []);

  const handleDocDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDocDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    setPendingDocs((prev) => [...prev, ...validateDocs(dropped)].slice(0, DOC_MAX_FILES));
  };

  const handleDocFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    setPendingDocs((prev) => [...prev, ...validateDocs(picked)].slice(0, DOC_MAX_FILES));
    e.target.value = "";
  };

  const removePendingDoc = (idx: number) => {
    setPendingDocs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitDocUpload = async () => {
    if (!docUploadWeek || !pendingDocs.length) {
      toast.error("Selecione ao menos um documento.");
      return;
    }
    setIsUploadingDocs(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Upload sequencial — evita "Failed to fetch" do navegador saturando
      // conexões. Continua a fila se algum falhar e relata no final.
      let successCount = 0;
      const failures: string[] = [];

      for (const file of pendingDocs) {
        try {
          const safeName = sanitizeFileName(file.name);
          const path = `${submissionId}/${docUploadWeek.id}/${crypto.randomUUID()}-${safeName}`;
          const { error: uploadErr } = await supabase.storage
            .from("week-documents")
            .upload(path, file, { upsert: false });
          if (uploadErr) throw new Error(uploadErr.message);
          const from = supabase.from("week_documents" as any) as any;
          const { error: insertErr } = await from.insert({
            week_id: docUploadWeek.id,
            submission_id: submissionId,
            file_name: file.name,
            file_path: path,
            file_size: file.size,
            mime_type: file.type || null,
            uploaded_by: user?.id ?? null,
          });
          if (insertErr) throw new Error(insertErr.message);
          successCount++;
        } catch (err) {
          failures.push(
            `${file.name}: ${err instanceof Error ? err.message : "erro desconhecido"}`,
          );
        }
      }

      if (successCount === 0) {
        toast.error(`Nenhum documento subiu. Erros:\n${failures.join("\n")}`);
        return;
      }
      if (failures.length > 0) {
        toast.warning(
          `${successCount} documento(s) enviado(s). ${failures.length} falhou(aram):\n${failures.join("\n")}`,
        );
      } else {
        toast.success(`${successCount} documento(s) enviado(s).`);
      }
      setDocUploadWeek(null);
      setPendingDocs([]);
      queryClient.invalidateQueries({ queryKey: ["week-documents", submissionId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar documentos.");
    } finally {
      setIsUploadingDocs(false);
    }
  };

  const handleDownloadDoc = async (doc: WeekDocument) => {
    try {
      // Caminho 1 (preferido): baixa o arquivo via API do Supabase como Blob.
      // Isso evita ERR_BLOCKED_BY_CLIENT causado por extensões de privacidade
      // (AdBlock, uBlock, Brave Shields, etc.) que bloqueiam URLs externas.
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
      // Libera memória depois que o browser processou o click
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao baixar.");
    }
  };

  const handleConfirmDeleteDoc = async () => {
    if (!deleteDoc) return;
    setIsDeletingDoc(true);
    try {
      const { error: storageErr } = await supabase.storage
        .from("week-documents")
        .remove([deleteDoc.file_path]);
      if (storageErr && !/not found/i.test(storageErr.message)) {
        console.warn("Erro ao remover do Storage:", storageErr.message);
      }
      const from = supabase.from("week_documents" as any) as any;
      const { error } = await from.delete().eq("id", deleteDoc.id);
      if (error) throw error;
      toast.success("Documento excluído.");
      setDeleteDoc(null);
      queryClient.invalidateQueries({ queryKey: ["week-documents", submissionId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
    } finally {
      setIsDeletingDoc(false);
    }
  };

  // ─── Upload Volund (por semana) ─────────────────────────────────────────
  const validateFiles = useCallback((files: File[]): PendingFile[] => {
    const valid: PendingFile[] = [];
    const now = nowDatetimeLocal();
    for (const f of files) {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      if (!VOLUND_ACCEPTED.includes(ext)) {
        toast.error(`"${f.name}": formato não suportado.`);
        continue;
      }
      if (f.size > VOLUND_MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`"${f.name}": maior que ${VOLUND_MAX_SIZE_MB}MB.`);
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

  const openUploadForWeek = (week: Week) => {
    setUploadWeek(week);
    setPendingFiles([]);
  };

  const closeUpload = () => {
    if (isUploadingVolund) return;
    setUploadWeek(null);
    setPendingFiles([]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    setPendingFiles((prev) => [...prev, ...validateFiles(dropped)].slice(0, VOLUND_MAX_FILES));
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    setPendingFiles((prev) => [...prev, ...validateFiles(picked)].slice(0, VOLUND_MAX_FILES));
    e.target.value = "";
  };

  const removePendingFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((pf) => pf.id !== id));
  };

  const updatePendingFile = (id: string, patch: Partial<PendingFile>) => {
    setPendingFiles((prev) => prev.map((pf) => (pf.id === id ? { ...pf, ...patch } : pf)));
  };

  const handleSubmitUpload = async () => {
    if (!uploadWeek || !pendingFiles.length) {
      toast.error("Selecione ao menos um arquivo.");
      return;
    }
    for (const pf of pendingFiles) {
      if (!pf.title.trim()) {
        toast.error(`Preencha o título da reunião "${pf.file.name}".`);
        return;
      }
      if (!pf.meetingDate) {
        toast.error(`Preencha a data da reunião "${pf.file.name}".`);
        return;
      }
    }
    setIsUploadingVolund(true);
    try {
      // Upload sequencial (em vez de Promise.all) para evitar "Failed to fetch"
      // causado pelo navegador saturando conexões simultâneas com o Storage.
      // Continua a fila mesmo se algum falhar, e relata no final.
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
        toast.error(
          `Nenhum arquivo subiu. Erros:\n${failures.join("\n")}`,
        );
        return;
      }

      const { error: invokeErr } = await supabase.functions.invoke("upload-meetings", {
        body: {
          submissionId,
          files: uploads,
          category: "ongoing",
          weekId: uploadWeek.id,
        },
      });
      if (invokeErr) throw new Error(invokeErr.message);

      if (failures.length > 0) {
        toast.warning(
          `${uploads.length} transcrição(ões) enviada(s). ${failures.length} falhou(aram):\n${failures.join("\n")}`,
        );
      } else {
        toast.success(
          `${uploads.length} transcrição(ões) enviada(s). As atas aparecem assim que o Volund terminar.`,
        );
      }
      setUploadWeek(null);
      setPendingFiles([]);
      queryClient.invalidateQueries({ queryKey: ["meetings", submissionId, "ongoing"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar transcrições.");
    } finally {
      setIsUploadingVolund(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-medium text-muted-foreground">
          Semanas de checkpoint
        </h3>
        <Button size="sm" onClick={() => setIsNewWeekOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Inserir Semana
        </Button>
      </div>

      {/* Lista de semanas */}
      {isLoadingWeeks ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : !weeks?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarOff className="w-10 h-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhuma semana criada ainda.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Clique em "Inserir Semana" para começar.
          </p>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {weeks.map((week) => {
            const weekMeetings = meetingsByWeek[week.id] ?? [];
            return (
              <AccordionItem
                key={week.id}
                value={week.id}
                className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-xl px-4 overflow-hidden"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 text-left flex-1 min-w-0">
                    <span className="font-semibold text-sm text-foreground">{week.title}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {weekMeetings.length}{" "}
                      {weekMeetings.length === 1 ? "reunião" : "reuniões"}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  {/* Ações da semana */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUploadForWeek(week)}
                      >
                        <FileUp className="w-3.5 h-3.5 mr-1.5" />
                        Importar transcrições
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDocUpload(week)}
                      >
                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                        Adicionar documentos
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRenameWeek(week);
                          setRenameWeekTitle(week.title);
                        }}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Renomear
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteWeek(week)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Excluir semana
                      </Button>
                    </div>
                  </div>

                  {/* ── Documentos da semana ── */}
                  {(documentsByWeek[week.id]?.length ?? 0) > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        📎 Documentos ({documentsByWeek[week.id].length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {documentsByWeek[week.id].map((doc) => (
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
                              onClick={() => handleDownloadDoc(doc)}
                              title="Baixar"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteDoc(doc)}
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reuniões da semana */}
                  {weekMeetings.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">
                      Sem reuniões nesta semana ainda. Importe transcrições para
                      gerar as atas.
                    </p>
                  ) : (
                    <Accordion type="single" collapsible className="space-y-2">
                      {weekMeetings.map((meeting) => {
                        const status = getMeetingStatus(meeting);
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
                            <AccordionContent className="space-y-4 pb-4">
                              {/* Ações da reunião */}
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

                              {/* Status Volund */}
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

                              {/* Ata estruturada */}
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

                              {/* Ata markdown legada (fallback) */}
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
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* ─── Diálogos ─────────────────────────────────────────────────────── */}

      {/* Inserir Semana */}
      <Dialog
        open={isNewWeekOpen}
        onOpenChange={(open) => {
          if (!isCreatingWeek) {
            setIsNewWeekOpen(open);
            if (!open) setNewWeekTitle("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inserir Semana</DialogTitle>
            <DialogDescription>
              Crie uma nova semana de Ongoing. Você poderá importar as
              transcrições dentro dela.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">Título da Semana *</label>
            <Input
              placeholder="Ex: Semana 0 - Onboarding"
              value={newWeekTitle}
              onChange={(e) => setNewWeekTitle(e.target.value)}
              disabled={isCreatingWeek}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newWeekTitle.trim()) handleCreateWeek();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNewWeekOpen(false)}
              disabled={isCreatingWeek}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateWeek} disabled={isCreatingWeek}>
              {isCreatingWeek && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renomear Semana */}
      <Dialog
        open={!!renameWeek}
        onOpenChange={(open) => !open && !isRenamingWeek && setRenameWeek(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear semana</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              value={renameWeekTitle}
              onChange={(e) => setRenameWeekTitle(e.target.value)}
              disabled={isRenamingWeek}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameWeek(null)} disabled={isRenamingWeek}>
              Cancelar
            </Button>
            <Button onClick={handleRenameWeek} disabled={isRenamingWeek}>
              {isRenamingWeek && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão de semana */}
      <AlertDialog
        open={!!deleteWeek}
        onOpenChange={(open) => !open && !isDeletingWeek && setDeleteWeek(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir semana</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a semana <strong>"{deleteWeek?.title}"</strong>{" "}
              e <strong>todas as reuniões e atas</strong> dentro dela, incluindo
              os arquivos de transcrição no Storage.{" "}
              <span className="text-destructive font-medium">
                Não é possível desfazer.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingWeek}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDeleteWeek();
              }}
              disabled={isDeletingWeek}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeletingWeek && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Editar / Excluir reunião (reusa diálogos compartilhados) */}
      <EditMeetingDialog
        meeting={editMetadataMeeting}
        onClose={() => setEditMetadataMeeting(null)}
      />
      <EditMinutesDialog
        meetingId={editMinutesMeeting?.id ?? null}
        submissionId={submissionId}
        initialMinutes={editMinutesMeeting?.minutes_structured ?? null}
        onClose={() => setEditMinutesMeeting(null)}
      />
      <AlertDialog
        open={!!deleteMeeting}
        onOpenChange={(open) => !open && !isDeletingMeeting && setDeleteMeeting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir reunião</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a reunião <strong>"{deleteMeeting?.title}"</strong>{" "}
              e o arquivo de transcrição no Storage.{" "}
              <span className="text-destructive font-medium">Não é possível desfazer.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingMeeting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDeleteMeeting();
              }}
              disabled={isDeletingMeeting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeletingMeeting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Upload de Documentos (PDF/PPTX/DOCX) — por semana */}
      <Dialog open={!!docUploadWeek} onOpenChange={(open) => !open && closeDocUpload()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Adicionar documentos — {docUploadWeek?.title}
            </DialogTitle>
            <DialogDescription>
              Arraste até {DOC_MAX_FILES} arquivos ({DOC_ACCEPTED.join(", ")}).
              Eles ficarão como referência da semana.
            </DialogDescription>
          </DialogHeader>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDocDragging(true);
            }}
            onDragLeave={() => setIsDocDragging(false)}
            onDrop={handleDocDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDocDragging ? "border-primary bg-primary/5" : "border-border/50"
            }`}
          >
            <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-foreground mb-1">
              Arraste arquivos aqui ou clique para escolher
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Aceita {DOC_ACCEPTED.join(", ")} · até {DOC_MAX_SIZE_MB}MB cada
            </p>
            <input
              type="file"
              multiple
              accept={DOC_ACCEPTED.join(",")}
              className="hidden"
              ref={docFileInputRef}
              onChange={handleDocFilePick}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => docFileInputRef.current?.click()}
              disabled={isUploadingDocs}
            >
              Selecionar arquivos
            </Button>
          </div>

          {pendingDocs.length > 0 && (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              <p className="text-xs font-semibold text-muted-foreground">
                {pendingDocs.length} documento(s) selecionado(s)
              </p>
              {pendingDocs.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  className="flex items-center justify-between gap-2 bg-card/40 border border-border/50 rounded-md px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(f.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => removePendingDoc(idx)}
                    disabled={isUploadingDocs}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDocUpload} disabled={isUploadingDocs}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitDocUpload}
              disabled={isUploadingDocs || pendingDocs.length === 0}
            >
              {isUploadingDocs && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão de documento */}
      <AlertDialog
        open={!!deleteDoc}
        onOpenChange={(open) => !open && !isDeletingDoc && setDeleteDoc(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá <strong>"{deleteDoc?.file_name}"</strong> da semana
              e o arquivo no Storage.{" "}
              <span className="text-destructive font-medium">Não é possível desfazer.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingDoc}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDeleteDoc();
              }}
              disabled={isDeletingDoc}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeletingDoc && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Upload (Volund) — por semana */}
      <Dialog open={!!uploadWeek} onOpenChange={(open) => !open && closeUpload()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Importar transcrições — {uploadWeek?.title}
            </DialogTitle>
            <DialogDescription>
              Arraste até {VOLUND_MAX_FILES} arquivos ({VOLUND_ACCEPTED.join(", ")}).
              Ajuste título e data de cada reunião antes de enviar.
            </DialogDescription>
          </DialogHeader>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border/50"
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
              ref={fileInputRef}
              onChange={handleFilePick}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
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
                        onChange={(e) => updatePendingFile(pf.id, { title: e.target.value })}
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
            <Button variant="outline" onClick={closeUpload} disabled={isUploadingVolund}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitUpload}
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
