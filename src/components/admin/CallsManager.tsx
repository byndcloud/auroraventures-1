import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Pencil,
  Eye,
  Trash2,
  Loader2,
  Megaphone,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";

/* ─── types ─── */
interface Call {
  id: string;
  title: string;
  description: string;
  vertical: string | null;
  call_type: string;
  visibility: string;
  status: string;
  deadline: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  response_count?: number;
  effective_status?: string;
}

interface CallField {
  id?: string;
  call_id?: string;
  field_type: string;
  label: string;
  placeholder: string;
  required: boolean;
  options: string[] | null;
  display_order: number;
}

interface CallResponse {
  id: string;
  call_id: string;
  respondent_email: string | null;
  response_data: Record<string, any>;
  user_id: string | null;
  created_at: string;
}

/* ─── status helpers ─── */
function getEffectiveStatus(call: { status: string; deadline: string | null }): string {
  if (call.status === "ativa" && call.deadline) {
    const deadlineDate = new Date(call.deadline + "T23:59:59");
    if (deadlineDate < new Date()) return "encerrada";
  }
  return call.status;
}

function statusBadge(status: string) {
  switch (status) {
    case "ativa":
      return <Badge className="bg-accent/20 text-accent border-accent/30">Ativa</Badge>;
    case "rascunho":
      return <Badge variant="secondary">Rascunho</Badge>;
    case "encerrada":
      return <Badge variant="destructive">Encerrada</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function typeBadge(t: string) {
  return t === "mercado" ? (
    <Badge variant="outline" className="border-primary/30 text-primary">🚀 Mercado</Badge>
  ) : (
    <Badge variant="outline" className="border-accent/30 text-accent">🏢 Interno</Badge>
  );
}

function visBadge(v: string) {
  return v === "publica" ? (
    <Badge variant="outline" className="text-foreground">🌐 Pública</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">🔒 Privada</Badge>
  );
}

/* ─── main ─── */
export function CallsManager() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isResponsesOpen, setIsResponsesOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Call | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /* ─── queries ─── */
  const { data: calls, isLoading } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: counts } = await supabase
        .from("call_responses")
        .select("call_id");

      const countMap: Record<string, number> = {};
      (counts || []).forEach((r: any) => {
        countMap[r.call_id] = (countMap[r.call_id] || 0) + 1;
      });

      return (data || []).map((c: any) => ({
        ...c,
        response_count: countMap[c.id] || 0,
        effective_status: getEffectiveStatus(c),
      })) as Call[];
    },
  });

  /* ─── actions ─── */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const { error } = await supabase.from("calls").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error("Erro ao excluir chamada.");
    } else {
      toast.success("Chamada excluída permanentemente.");
      queryClient.invalidateQueries({ queryKey: ["calls"] });
    }
    setDeleteTarget(null);
    setIsDeleting(false);
  };

  const openResponses = (call: Call) => {
    setSelectedCall(call);
    setIsResponsesOpen(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Gestão de Chamadas</h2>
          <p className="text-sm text-muted-foreground">
            Crie e gerencie chamadas públicas e privadas
          </p>
        </div>
        <Button onClick={() => navigate("/admin/chamadas/nova")}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Chamada
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !calls?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Megaphone className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">Nenhuma chamada criada ainda.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Clique em "Nova Chamada" para começar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call, i) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-5 rounded-xl"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{call.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {typeBadge(call.call_type)}
                    {visBadge(call.visibility)}
                    {statusBadge(call.effective_status || call.status)}
                    <span className="text-xs text-muted-foreground">
                      {call.response_count} resposta{call.response_count !== 1 ? "s" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {call.deadline
                        ? `Deadline: ${format(new Date(call.deadline + "T00:00:00"), "dd/MM/yyyy")}`
                        : "Sem deadline"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/admin/chamadas/${call.id}/editar`)}
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openResponses(call)}
                    title="Ver Respostas"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(call)}
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Responses Dialog */}
      {selectedCall && (
        <ResponsesDialog
          open={isResponsesOpen}
          onOpenChange={setIsResponsesOpen}
          call={selectedCall}
        />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir chamada permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apagará a chamada "{deleteTarget?.title}", seus campos e todas as
              respostas recebidas. Essa operação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   RESPONSES DIALOG
   ═══════════════════════════════════════════════ */
function ResponsesDialog({
  open,
  onOpenChange,
  call,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  call: Call;
}) {
  const { data: fields } = useQuery({
    queryKey: ["call_fields", call.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_fields")
        .select("*")
        .eq("call_id", call.id)
        .order("display_order");
      if (error) throw error;
      return data as CallField[];
    },
    enabled: open,
  });

  const { data: responses, isLoading } = useQuery({
    queryKey: ["call_responses", call.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_responses")
        .select("*")
        .eq("call_id", call.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CallResponse[];
    },
    enabled: open,
  });

  const exportCSV = () => {
    if (!responses?.length || !fields?.length) return;

    const headers = ["Email", "Data", ...fields.map((f) => f.label)];
    const rows = responses.map((r) => {
      const data = (r.response_data ?? {}) as Record<string, unknown>;
      return [
        r.respondent_email || "",
        new Date(r.created_at).toLocaleDateString("pt-BR"),
        ...fields.map((f) => {
          const val = (f.id ? data[f.id] : undefined) ?? data[f.label];
          if (Array.isArray(val)) return val.join("; ");
          return String(val ?? "");
        }),
      ];
    });

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `respostas-${call.title.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Respostas - {call.title}</DialogTitle>
          <DialogDescription>
            {responses?.length ?? 0} candidatura{(responses?.length ?? 0) !== 1 ? "s" : ""}{" "}
            recebida{(responses?.length ?? 0) !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : !responses?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Eye className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma resposta recebida ainda.
              </p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2 py-2">
              {responses.map((resp) => (
                <AccordionItem
                  key={resp.id}
                  value={resp.id}
                  className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-xl px-4 overflow-hidden"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex flex-col items-start gap-1 text-left">
                      <span className="font-medium text-sm text-foreground">
                        {resp.respondent_email || "Anônimo"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(resp.created_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 space-y-2">
                    {fields?.map((f) => {
                      const data = (resp.response_data ?? {}) as Record<string, unknown>;
                      const val = (f.id ? data[f.id] : undefined) ?? data[f.label];
                      return (
                        <div key={f.label} className="text-sm">
                          <span className="font-medium text-muted-foreground">
                            {f.label}:
                          </span>{" "}
                          <span className="text-foreground">
                            {Array.isArray(val)
                              ? val.join(", ")
                              : val !== undefined && val !== null
                              ? String(val)
                              : "-"}
                          </span>
                        </div>
                      );
                    })}
                    {(!fields || fields.length === 0) && (
                      <p className="text-xs text-muted-foreground italic">
                        Nenhum campo configurado para esta chamada.
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </ScrollArea>

        <DialogFooter className="pt-4">
          <Button
            variant="outline"
            onClick={exportCSV}
            disabled={!responses?.length}
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
