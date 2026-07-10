// Diálogo de edição da ata estruturada (minutes_structured). Permite editar
// cada seção com inputs/textareas e listas com add/remove.
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type StructuredMinutes } from "./StructuredMinutesView";

interface EditMinutesDialogProps {
  meetingId: string | null;
  submissionId: string;
  initialMinutes: StructuredMinutes | null;
  onClose: () => void;
}

const blank: StructuredMinutes = {
  titulo_sugerido: "",
  resumo_executivo: "",
  participantes: [],
  topicos_discutidos: [],
  decisoes: [],
  proximos_passos: [],
  bloqueios_riscos: [],
  metricas_mencionadas: [],
};

export function EditMinutesDialog({
  meetingId,
  submissionId,
  initialMinutes,
  onClose,
}: EditMinutesDialogProps) {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState<StructuredMinutes>(blank);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (meetingId) {
      setMinutes({ ...blank, ...(initialMinutes ?? {}) });
    }
  }, [meetingId, initialMinutes]);

  if (!meetingId) return null;

  // ── Helpers para arrays ─────────────────────────────────────
  const update = <K extends keyof StructuredMinutes>(key: K, value: StructuredMinutes[K]) =>
    setMinutes((prev) => ({ ...prev, [key]: value }));

  const addItem = <K extends keyof StructuredMinutes>(key: K, blankItem: unknown) => {
    const arr = (minutes[key] as unknown[]) ?? [];
    update(key, [...arr, blankItem] as StructuredMinutes[K]);
  };

  const removeItem = <K extends keyof StructuredMinutes>(key: K, idx: number) => {
    const arr = (minutes[key] as unknown[]) ?? [];
    update(key, arr.filter((_, i) => i !== idx) as StructuredMinutes[K]);
  };

  const updateItem = <K extends keyof StructuredMinutes>(
    key: K,
    idx: number,
    patch: Record<string, unknown>,
  ) => {
    const arr = ((minutes[key] as unknown[]) ?? []).slice();
    arr[idx] = { ...(arr[idx] as object), ...patch };
    update(key, arr as StructuredMinutes[K]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Limpa arrays vazios pra não poluir o JSON
      const cleaned: StructuredMinutes = {
        ...minutes,
        participantes: (minutes.participantes ?? []).filter((p) => p?.trim()),
        topicos_discutidos: (minutes.topicos_discutidos ?? []).filter(
          (t) => t.titulo?.trim() || t.detalhes?.trim(),
        ),
        decisoes: (minutes.decisoes ?? []).filter((d) => d.descricao?.trim()),
        proximos_passos: (minutes.proximos_passos ?? []).filter((p) => p.descricao?.trim()),
        bloqueios_riscos: (minutes.bloqueios_riscos ?? []).filter((b) => b.descricao?.trim()),
        metricas_mencionadas: (minutes.metricas_mencionadas ?? []).filter(
          (m) => m.metrica?.trim() || m.valor?.trim(),
        ),
      };

      const { error } = await supabase
        .from("meetings")
        .update({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          minutes_structured: cleaned as any,
        })
        .eq("id", meetingId);
      if (error) throw error;

      toast.success("Ata atualizada.");
      queryClient.invalidateQueries({ queryKey: ["meetings", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["iniciativa-meetings", submissionId] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar ata.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <Dialog open={!!meetingId} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar ata estruturada</DialogTitle>
          <DialogDescription>
            Ajuste o conteúdo gerado pelo agente. Seções vazias serão omitidas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Resumo executivo */}
          <section className="space-y-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              📌 Resumo executivo
            </label>
            <Textarea
              className="min-h-[100px]"
              value={minutes.resumo_executivo ?? ""}
              onChange={(e) => update("resumo_executivo", e.target.value)}
              disabled={isSaving}
            />
          </section>

          {/* Participantes */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Participantes
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const list = (minutes.participantes ?? []).slice();
                  list.push("");
                  update("participantes", list);
                }}
                disabled={isSaving}
              >
                <Plus className="w-3 h-3 mr-1" />
                Adicionar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(minutes.participantes ?? []).map((p, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input
                    className="h-8 w-40"
                    value={p}
                    onChange={(e) => {
                      const list = (minutes.participantes ?? []).slice();
                      list[i] = e.target.value;
                      update("participantes", list);
                    }}
                    disabled={isSaving}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const list = (minutes.participantes ?? []).slice();
                      list.splice(i, 1);
                      update("participantes", list);
                    }}
                    disabled={isSaving}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {(minutes.participantes ?? []).length === 0 && (
                <Badge variant="outline" className="text-xs">
                  Nenhum
                </Badge>
              )}
            </div>
          </section>

          {/* Tópicos discutidos */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                💬 Tópicos discutidos
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addItem("topicos_discutidos", { titulo: "", detalhes: "" })}
                disabled={isSaving}
              >
                <Plus className="w-3 h-3 mr-1" />
                Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {(minutes.topicos_discutidos ?? []).map((t, i) => (
                <div key={i} className="border border-border/50 rounded-md p-3 space-y-2 relative">
                  <Input
                    placeholder="Título"
                    value={t.titulo ?? ""}
                    onChange={(e) => updateItem("topicos_discutidos", i, { titulo: e.target.value })}
                    disabled={isSaving}
                  />
                  <Textarea
                    placeholder="Detalhes"
                    value={t.detalhes ?? ""}
                    onChange={(e) => updateItem("topicos_discutidos", i, { detalhes: e.target.value })}
                    disabled={isSaving}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-1 right-1"
                    onClick={() => removeItem("topicos_discutidos", i)}
                    disabled={isSaving}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Decisões */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                ⚖️ Decisões
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addItem("decisoes", { descricao: "", tomada_por: "", contexto: "" })}
                disabled={isSaving}
              >
                <Plus className="w-3 h-3 mr-1" />
                Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {(minutes.decisoes ?? []).map((d, i) => (
                <div key={i} className="border border-border/50 rounded-md p-3 space-y-2 relative">
                  <Textarea
                    placeholder="Descrição da decisão"
                    value={d.descricao ?? ""}
                    onChange={(e) => updateItem("decisoes", i, { descricao: e.target.value })}
                    disabled={isSaving}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Tomada por (opcional)"
                      value={d.tomada_por ?? ""}
                      onChange={(e) => updateItem("decisoes", i, { tomada_por: e.target.value })}
                      disabled={isSaving}
                    />
                    <Input
                      placeholder="Contexto (opcional)"
                      value={d.contexto ?? ""}
                      onChange={(e) => updateItem("decisoes", i, { contexto: e.target.value })}
                      disabled={isSaving}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-1 right-1"
                    onClick={() => removeItem("decisoes", i)}
                    disabled={isSaving}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Próximos passos */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                ✅ Próximos passos
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  addItem("proximos_passos", { descricao: "", responsavel: "", prazo: "" })
                }
                disabled={isSaving}
              >
                <Plus className="w-3 h-3 mr-1" />
                Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {(minutes.proximos_passos ?? []).map((p, i) => (
                <div key={i} className="border border-border/50 rounded-md p-3 space-y-2 relative">
                  <Textarea
                    placeholder="Descrição"
                    value={p.descricao ?? ""}
                    onChange={(e) => updateItem("proximos_passos", i, { descricao: e.target.value })}
                    disabled={isSaving}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Responsável (opcional)"
                      value={p.responsavel ?? ""}
                      onChange={(e) => updateItem("proximos_passos", i, { responsavel: e.target.value })}
                      disabled={isSaving}
                    />
                    <Input
                      placeholder="Prazo (opcional)"
                      value={p.prazo ?? ""}
                      onChange={(e) => updateItem("proximos_passos", i, { prazo: e.target.value })}
                      disabled={isSaving}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-1 right-1"
                    onClick={() => removeItem("proximos_passos", i)}
                    disabled={isSaving}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Bloqueios / Riscos */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                🚧 Bloqueios e riscos
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addItem("bloqueios_riscos", { descricao: "", severidade: "media" })}
                disabled={isSaving}
              >
                <Plus className="w-3 h-3 mr-1" />
                Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {(minutes.bloqueios_riscos ?? []).map((b, i) => (
                <div key={i} className="border border-border/50 rounded-md p-3 space-y-2 relative">
                  <Textarea
                    placeholder="Descrição do bloqueio/risco"
                    value={b.descricao ?? ""}
                    onChange={(e) => updateItem("bloqueios_riscos", i, { descricao: e.target.value })}
                    disabled={isSaving}
                  />
                  <Select
                    value={b.severidade ?? "media"}
                    onValueChange={(v) =>
                      updateItem("bloqueios_riscos", i, { severidade: v })
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Severidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-1 right-1"
                    onClick={() => removeItem("bloqueios_riscos", i)}
                    disabled={isSaving}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Métricas mencionadas */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                📊 Métricas mencionadas
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  addItem("metricas_mencionadas", { metrica: "", valor: "", contexto: "" })
                }
                disabled={isSaving}
              >
                <Plus className="w-3 h-3 mr-1" />
                Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {(minutes.metricas_mencionadas ?? []).map((m, i) => (
                <div key={i} className="border border-border/50 rounded-md p-3 space-y-2 relative">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Métrica (ex: MRR)"
                      value={m.metrica ?? ""}
                      onChange={(e) =>
                        updateItem("metricas_mencionadas", i, { metrica: e.target.value })
                      }
                      disabled={isSaving}
                    />
                    <Input
                      placeholder="Valor"
                      value={m.valor ?? ""}
                      onChange={(e) =>
                        updateItem("metricas_mencionadas", i, { valor: e.target.value })
                      }
                      disabled={isSaving}
                    />
                  </div>
                  <Input
                    placeholder="Contexto (opcional)"
                    value={m.contexto ?? ""}
                    onChange={(e) =>
                      updateItem("metricas_mencionadas", i, { contexto: e.target.value })
                    }
                    disabled={isSaving}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-1 right-1"
                    onClick={() => removeItem("metricas_mencionadas", i)}
                    disabled={isSaving}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
