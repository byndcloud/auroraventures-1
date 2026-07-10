import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  WorkspaceTask,
  PRIORITIES,
  TIPOS,
  STATUSES,
  PERFIS,
  PRIORITY_LABEL,
  TIPO_LABEL,
  STATUS_LABEL,
} from "./types";

interface Props {
  task: WorkspaceTask | null;
  allTasks: WorkspaceTask[];
  onClose: () => void;
  onSaved: () => void;
}

export function TaskDetailSheet({ task, allTasks, onClose, onSaved }: Props) {
  const [form, setForm] = useState<WorkspaceTask | null>(task);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(task);
  }, [task]);

  if (!form) return null;

  const update = (patch: Partial<WorkspaceTask>) =>
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  const toggleDep = (id: string) => {
    if (!form) return;
    const has = form.depends_on.includes(id);
    update({
      depends_on: has
        ? form.depends_on.filter((d) => d !== id)
        : [...form.depends_on, id],
    });
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    const { error } = await supabase
      .from("workspace_tasks")
      .update({
        title: form.title,
        description: form.description,
        comentario: form.comentario,
        tipo: form.tipo,
        perfil: form.perfil,
        screen: form.screen,
        area: form.area,
        status: form.status,
        priority: form.priority,
        tem_decisao_aberta: form.tem_decisao_aberta,
        depends_on: form.depends_on,
      })

      .eq("id", form.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success("Task atualizada");
    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (!form) return;
    const { error } = await supabase
      .from("workspace_tasks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", form.id);
    if (error) {
      toast.error("Erro ao excluir", { description: error.message });
      return;
    }
    toast.success("Task arquivada");
    onSaved();
    onClose();
  };

  const candidateDeps = allTasks.filter(
    (t) => t.external_id !== form.external_id,
  );

  return (
    <Sheet open={!!task} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-card border-border">
        <SheetHeader className="pr-8">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {form.external_id}
            </Badge>
            <Badge variant="secondary">{TIPO_LABEL[form.tipo]}</Badge>
            <Badge>{form.priority}</Badge>
          </div>
          <SheetTitle className="text-left break-words">{form.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div>
            <Label>Título</Label>
            <Input
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              rows={5}
              value={form.description ?? ""}
              onChange={(e) => update({ description: e.target.value })}
            />
          </div>

          <div>
            <Label>Comentário</Label>
            <Textarea
              rows={4}
              value={form.comentario ?? ""}
              onChange={(e) => update({ comentario: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => update({ tipo: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Perfil</Label>
              <Select value={form.perfil} onValueChange={(v) => update({ perfil: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERFIS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => update({ priority: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => update({ status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tela</Label>
              <Input
                value={form.screen ?? ""}
                onChange={(e) => update({ screen: e.target.value })}
              />
            </div>
            <div>
              <Label>Área</Label>
              <Input
                value={form.area ?? ""}
                onChange={(e) => update({ area: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={!form.tem_decisao_aberta}
                onCheckedChange={(v) => update({ tem_decisao_aberta: !v })}
              />
              <Label className="cursor-pointer">
                {form.tem_decisao_aberta ? "Decisão Aberta" : "Validado"}
              </Label>
            </div>
          </div>


          <div>
            <Label>Dependências ({form.depends_on.length})</Label>
            <div className="mt-1 max-h-48 overflow-y-auto rounded border border-border p-2 space-y-1">
              {candidateDeps.map((c) => (
                <label
                  key={c.external_id}
                  className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 px-2 py-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={form.depends_on.includes(c.external_id)}
                    onChange={() => toggleDep(c.external_id)}
                  />
                  <span className="font-mono text-muted-foreground">{c.external_id}</span>
                  <span className="truncate">{c.title}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-border">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-1" /> Arquivar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Arquivar task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A task será removida do board mas mantida no histórico (soft-delete).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Arquivar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
