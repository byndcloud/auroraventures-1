import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Pencil, Trash2, Loader2, FileText, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextarea } from "./RichTextarea";
import { Skeleton } from "@/components/ui/skeleton";
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

interface Readout {
  id: string;
  submission_id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

// Renderiza o texto de um report convertendo linhas que começam com "-"
// (também aceita "*" e "•") em bullet points <li>. Linhas comuns viram
// parágrafos. Linhas em branco separam blocos. Espaçamento generoso para
// facilitar a leitura (leading-loose + gaps).
function renderReadoutBody(text: string): JSX.Element[] {
  const lines = text.split("\n");
  const blocks: JSX.Element[] = [];
  let currentList: string[] = [];
  let currentPara: string[] = [];
  let key = 0;

  const flushList = () => {
    if (currentList.length === 0) return;
    blocks.push(
      <ul key={`l${key++}`} className="list-disc pl-5 space-y-2.5 my-2">
        {currentList.map((item, i) => (
          <li key={i} className="leading-loose">
            {item}
          </li>
        ))}
      </ul>,
    );
    currentList = [];
  };

  const flushPara = () => {
    if (currentPara.length === 0) return;
    const joined = currentPara.join("\n");
    if (joined.trim()) {
      blocks.push(
        <p
          key={`p${key++}`}
          className="leading-loose whitespace-pre-wrap break-words my-2"
        >
          {joined}
        </p>,
      );
    }
    currentPara = [];
  };

  for (const raw of lines) {
    const isBullet = /^\s*[-*•]\s+/.test(raw);
    if (isBullet) {
      flushPara();
      currentList.push(raw.replace(/^\s*[-*•]\s+/, "").trim());
    } else if (raw.trim() === "") {
      // Linha em branco encerra o bloco corrente
      flushList();
      flushPara();
    } else {
      flushList();
      currentPara.push(raw);
    }
  }
  flushList();
  flushPara();

  return blocks;
}

interface ReadoutTabProps {
  submissionId: string;
  readOnly?: boolean;
}

export function ReadoutTab({ submissionId, readOnly = false }: ReadoutTabProps) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const canEdit = !readOnly && (profile?.role === "admin" || profile?.role === "colaborador");

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: readouts, isLoading } = useQuery({
    queryKey: ["readouts", submissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("readouts" as any)
        .select("*")
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Readout[];
    },
    enabled: !!submissionId,
  });

  const handleAdd = async () => {
    if (!newTitle.trim()) {
      toast.error("Informe um título.");
      return;
    }
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("readouts" as any).insert({
        submission_id: submissionId,
        title: newTitle.trim(),
        description: newDescription.trim(),
        created_by: user?.id ?? null,
      } as any);
      if (error) throw error;
      toast.success("Report adicionado!");
      setNewTitle("");
      setNewDescription("");
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey: ["readouts", submissionId] });
    } catch {
      toast.error("Erro ao salvar report.");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (r: Readout) => {
    setEditingId(r.id);
    setEditTitle(r.title);
    setEditDescription(r.description);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;
    const { error } = await supabase
      .from("readouts" as any)
      .update({ title: editTitle.trim(), description: editDescription.trim() } as any)
      .eq("id", editingId);
    if (error) {
      toast.error("Erro ao atualizar.");
      return;
    }
    toast.success("Report atualizado!");
    setEditingId(null);
    queryClient.invalidateQueries({ queryKey: ["readouts", submissionId] });
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from("readouts" as any).delete().eq("id", deletingId);
    if (error) {
      toast.error("Erro ao excluir.");
      return;
    }
    toast.success("Report excluído.");
    setDeletingId(null);
    queryClient.invalidateQueries({ queryKey: ["readouts", submissionId] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Reports desta iniciativa
        </h3>
        {canEdit && !isAdding && (
          <Button size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Report
          </Button>
        )}
      </div>

      {isAdding && canEdit && (
        <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-xl p-4 space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Título *</label>
            <Input
              placeholder="Ex: Conclusões da reunião com founders"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
            <RichTextarea
              placeholder={"Detalhe os pontos principais...\n\nDica: use - ou * para bullets, Tab para indentar, Enter continua a lista."}
              className="min-h-[160px]"
              value={newDescription}
              onChange={setNewDescription}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setNewTitle("");
                setNewDescription("");
              }}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : !readouts?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum report registrado.</p>
          {canEdit && (
            <p className="text-xs text-muted-foreground/70">
              Adicione o primeiro report acima.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {readouts.map((r) => (
            <div
              key={r.id}
              className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-xl p-4 space-y-2"
            >
              {editingId === r.id ? (
                <div className="space-y-3">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Título"
                  />
                  <RichTextarea
                    value={editDescription}
                    onChange={setEditDescription}
                    className="min-h-[160px]"
                    placeholder="Descrição (use - para bullets, Tab para indentar)"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                      <X className="w-3 h-3 mr-1" />
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleSaveEdit}>
                      <Check className="w-3 h-3 mr-1" />
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-foreground break-words">
                        {r.title}
                      </h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => startEdit(r)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeletingId(r.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {r.description && (
                    <div className="text-sm text-foreground/90">
                      {renderReadoutBody(r.description)}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir report?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
