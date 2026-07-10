// ============================================================================
// VestingIndicatorsPanel — bloco de indicadores de vesting (ADMIN, editável)
// ============================================================================
// Renderizado no TOPO da aba Ongoing, antes das semanas. Três faixas:
//   1. Hero executivo: anel de progresso + 3 stats
//   2. Alerta de risco (condicional)
//   3. Lista CRUD com semáforo de status (editar / excluir / status inline)
// + dialog criar/editar, exclusão com confirmação e botão "Usar marcos da Zelar".
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Pencil, Trash2, Target, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type VestingIndicator,
  type VestingStatus,
  VESTING_STATUS_META,
  useVestingProgress,
  sortIndicators,
  formatValueVsTarget,
  indicatorTone,
} from "./vesting";
import { VestingRing } from "./VestingShared";

interface Props {
  submissionId: string;
}

const STATUS_OPTIONS: VestingStatus[] = [
  "pendente",
  "em_andamento",
  "em_risco",
  "atingido",
  "nao_atingido",
];

interface FormState {
  name: string;
  goal_description: string;
  weight: string;
  owner_name: string;
  evidence_url: string;
  target_value: string;
  current_value: string;
  unit: string;
  direction: "gte" | "lte";
  progress_pct: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  goal_description: "",
  weight: "4",
  owner_name: "",
  evidence_url: "",
  target_value: "",
  current_value: "",
  unit: "",
  direction: "gte",
  progress_pct: "",
};

export function VestingIndicatorsPanel({ submissionId }: Props) {
  const queryClient = useQueryClient();
  const queryKey = ["vesting-indicators", submissionId];

  const { data: indicators = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const from = supabase.from("vesting_indicators" as any) as any;
      const { data, error } = await from
        .select("*")
        .eq("submission_id", submissionId)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VestingIndicator[];
    },
    enabled: !!submissionId,
  });

  const progress = useVestingProgress(indicators);
  const sorted = sortIndicators(indicators);

  // Realtime
  useEffect(() => {
    if (!submissionId) return;
    const channel = supabase
      .channel(`vesting:${submissionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vesting_indicators", filter: `submission_id=eq.${submissionId}` },
        () => queryClient.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, queryClient]);

  // ─── Dialog criar/editar ─────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VestingIndicator | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VestingIndicator | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (i: VestingIndicator) => {
    setEditing(i);
    setForm({
      name: i.name,
      goal_description: i.goal_description,
      weight: String(i.weight ?? ""),
      owner_name: i.owner_name ?? "",
      evidence_url: i.evidence_url ?? "",
      target_value: i.target_value != null ? String(i.target_value) : "",
      current_value: i.current_value != null ? String(i.current_value) : "",
      unit: i.unit ?? "",
      direction: i.direction ?? "gte",
      progress_pct: i.progress_pct != null ? String(i.progress_pct) : "",
    });
    setDialogOpen(true);
  };

  const num = (s: string): number | null => {
    const t = s.trim().replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.goal_description.trim()) {
      toast.error("Nome e meta são obrigatórios.");
      return;
    }
    const weight = num(form.weight) ?? 0;
    if (weight < 0 || weight > 100) {
      toast.error("Peso deve estar entre 0 e 100.");
      return;
    }
    const pp = num(form.progress_pct);
    if (pp != null && (pp < 0 || pp > 100)) {
      toast.error("Progresso manual deve estar entre 0 e 100.");
      return;
    }
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        submission_id: submissionId,
        name: form.name.trim(),
        goal_description: form.goal_description.trim(),
        weight,
        target_value: num(form.target_value),
        current_value: num(form.current_value),
        unit: form.unit.trim() || null,
        direction: form.direction,
        progress_pct: pp,
        owner_name: form.owner_name.trim() || null,
        evidence_url: form.evidence_url.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const from = supabase.from("vesting_indicators" as any) as any;
      if (editing) {
        // Update otimista — barra/anel reagem ANTES do servidor responder
        const previous = queryClient.getQueryData<VestingIndicator[]>(queryKey);
        queryClient.setQueryData<VestingIndicator[]>(queryKey, (old) =>
          old?.map((x) =>
            x.id === editing.id
              ? ({ ...x, ...payload } as VestingIndicator)
              : x,
          ) ?? old,
        );
        const { error } = await from.update(payload).eq("id", editing.id);
        if (error) {
          // Rollback do otimista
          if (previous) queryClient.setQueryData(queryKey, previous);
          console.error("[vesting] update error", error);
          throw error;
        }
        toast.success("Indicador atualizado.");
      } else {
        payload.created_by = user?.id ?? null;
        payload.status = "pendente";
        payload.display_order = indicators.length + 1;
        const { error } = await from.insert(payload);
        if (error) {
          console.error("[vesting] insert error", error);
          throw error;
        }
        toast.success("Indicador criado.");
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey, refetchType: "active" });
    } catch (err) {
      // Mensagem detalhada para destravar diagnósticos (RLS, tabela ausente, etc)
      const e = err as { message?: string; code?: string; details?: string; hint?: string };
      const parts = [
        e?.message,
        e?.code ? `(code: ${e.code})` : null,
        e?.details,
        e?.hint,
      ].filter(Boolean);
      const msg = parts.length > 0 ? parts.join(" · ") : "Erro ao salvar.";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Update otimista de status (operação mais frequente).
  // Atualiza o cache do React Query IMEDIATAMENTE (anel, barra, badges, tudo
  // reage em ms), depois sincroniza com o servidor. Rollback automático em
  // caso de erro.
  const updateStatus = async (i: VestingIndicator, status: VestingStatus) => {
    const previous = queryClient.getQueryData<VestingIndicator[]>(queryKey);
    const now = new Date().toISOString();

    // 1) Otimista: muda o cache na hora
    queryClient.setQueryData<VestingIndicator[]>(queryKey, (old) =>
      old?.map((x) => (x.id === i.id ? { ...x, status, updated_at: now } : x)) ?? old,
    );

    // 2) Persiste no banco
    const from = supabase.from("vesting_indicators" as any) as any;
    const { error } = await from
      .update({ status, updated_at: now })
      .eq("id", i.id);

    if (error) {
      // 3a) Rollback + mensagem detalhada (causa real: RLS, code, etc)
      console.error("[vesting] status update error", error);
      if (previous) queryClient.setQueryData(queryKey, previous);
      const e = error as { message?: string; code?: string; details?: string; hint?: string };
      const parts = [e?.message, e?.code ? `(code: ${e.code})` : null, e?.details, e?.hint].filter(Boolean);
      toast.error(parts.length > 0 ? parts.join(" · ") : "Erro ao atualizar status.");
      return;
    }
    // 3b) Sincroniza com servidor (sem causar flicker — o cache já tem a resposta certa)
    queryClient.invalidateQueries({ queryKey, refetchType: "active" });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const from = supabase.from("vesting_indicators" as any) as any;
      const { error } = await from.delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Indicador excluído.");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey, refetchType: "active" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
    } finally {
      setIsDeleting(false);
    }
  };

  const lastUpdated =
    indicators.length > 0
      ? indicators.reduce((max, i) => (i.updated_at > max ? i.updated_at : max), indicators[0].updated_at)
      : null;

  const weightSum = indicators.reduce((acc, i) => acc + (i.weight || 0), 0);

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-xl p-4 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Vesting — primeiros 90 dias
          </h3>
        </div>
        {indicators.length > 0 && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar indicador
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : indicators.length === 0 ? (
        // Estado vazio
        <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
          <Target className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Nenhum indicador de vesting cadastrado.
          </p>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar indicador
          </Button>
        </div>
      ) : (
        <>
          {/* FAIXA 1 — Hero */}
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-center">
            <VestingRing value={progress.absolutePp} max={progress.totalWeight} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-card/40 border border-border/50 rounded-xl p-3">
                <p className="text-lg font-bold text-foreground">
                  {progress.achievedCount} de {progress.total}
                </p>
                <p className="text-xs text-muted-foreground">marcos atingidos</p>
              </div>
              <div className="bg-card/40 border border-border/50 rounded-xl p-3">
                <p className="text-lg font-bold text-foreground">
                  {progress.absolutePp.toLocaleString("pt-BR")}% de {progress.totalWeight.toLocaleString("pt-BR")}%
                </p>
                <p className="text-xs text-muted-foreground">
                  já adquirido do vesting possível
                </p>
              </div>
              <div className="bg-card/40 border border-border/50 rounded-xl p-3">
                <p className="text-lg font-bold text-foreground">
                  {lastUpdated
                    ? formatDistanceToNow(new Date(lastUpdated), { locale: ptBR, addSuffix: false })
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">desde a última atualização</p>
              </div>
            </div>
          </div>

          {/* Aviso de soma de pesos acima de 100% */}
          {weightSum > 100 && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Soma dos pesos: {weightSum.toLocaleString("pt-BR")}% (acima de 100%)
            </div>
          )}

          {/* FAIXA 2 — Alerta de risco */}
          {progress.hasRisk && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400">
                Atenção:{" "}
                {indicators
                  .filter((i) => i.status === "em_risco" || i.status === "nao_atingido")
                  .map((i) => i.name)
                  .join(", ")}{" "}
                {indicators.filter((i) => i.status === "em_risco" || i.status === "nao_atingido").length === 1
                  ? "precisa de atenção."
                  : "precisam de atenção."}
              </p>
            </div>
          )}

          {/* FAIXA 3 — Lista CRUD */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {sorted.map((i) => {
              const meta = VESTING_STATUS_META[i.status];
              const valueStr = formatValueVsTarget(i);
              const frac = progress.fractions[i.id] ?? 0;
              const tone = indicatorTone(i, frac);
              return (
                <div
                  key={i.id}
                  className={`group bg-card/40 border rounded-xl p-3 space-y-2 ${
                    i.status === "em_risco" ? "border-amber-500/40" : "border-border/50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${meta.dotClass}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{i.name}</p>
                      <p className="text-xs text-muted-foreground">{i.goal_description}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {i.weight.toLocaleString("pt-BR")}%
                    </Badge>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(i)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(i)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* barra de progresso — preenchimento = fração, cor = tom
                      fidedigno (status forte > faixa de progresso) */}
                  <div className={`h-1.5 ${tone.trackClass} rounded-full overflow-hidden`}>
                    <div
                      className={`h-full ${tone.barClass} transition-[width] duration-500 ease-out`}
                      style={{ width: `${Math.round(frac * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{Math.round(frac * 100)}% do marco</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Select value={i.status} onValueChange={(v) => updateStatus(i, v as VestingStatus)}>
                        <SelectTrigger className={`h-7 text-[11px] px-2 w-auto gap-1 ${meta.badgeClass}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {VESTING_STATUS_META[s].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {valueStr && (
                        <span className="text-xs text-muted-foreground">{valueStr}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {i.owner_name && (
                        <span className="text-[10px] text-muted-foreground">👤 {i.owner_name}</span>
                      )}
                      {i.evidence_url && (
                        <a
                          href={i.evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-primary inline-flex items-center gap-0.5 hover:underline"
                        >
                          Evidência <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && !isSaving && setDialogOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar indicador" : "Novo indicador de vesting"}</DialogTitle>
            <DialogDescription>
              Soma atual dos pesos cadastrados: {weightSum.toLocaleString("pt-BR")}%
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nome *</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} disabled={isSaving} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Meta / descrição *</label>
              <Textarea value={form.goal_description} onChange={(e) => setForm((f) => ({ ...f, goal_description: e.target.value }))} disabled={isSaving} className="min-h-[60px]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Peso (%) *</label>
                <Input type="number" value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} disabled={isSaving} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Responsável</label>
                <Input value={form.owner_name} onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))} disabled={isSaving} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Link de evidência</label>
              <Input value={form.evidence_url} onChange={(e) => setForm((f) => ({ ...f, evidence_url: e.target.value }))} disabled={isSaving} placeholder="https://..." />
            </div>

            <div className="border-t border-border/40 pt-3 space-y-3">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Medição numérica (opcional)
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Meta (nº)</label>
                  <Input type="number" value={form.target_value} onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))} disabled={isSaving} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Atual (nº)</label>
                  <Input type="number" value={form.current_value} onChange={(e) => setForm((f) => ({ ...f, current_value: e.target.value }))} disabled={isSaving} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Unidade</label>
                  <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} disabled={isSaving} placeholder="serviços, x, R$" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Direção</label>
                  <Select value={form.direction} onValueChange={(v) => setForm((f) => ({ ...f, direction: v as "gte" | "lte" }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gte">Maior é melhor</SelectItem>
                      <SelectItem value="lte">Menor é melhor (ex: CAC)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Progresso manual (%)</label>
                  <Input type="number" value={form.progress_pct} onChange={(e) => setForm((f) => ({ ...f, progress_pct: e.target.value }))} disabled={isSaving} placeholder="opcional" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && !isDeleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir indicador</AlertDialogTitle>
            <AlertDialogDescription>
              Remover <strong>"{deleteTarget?.name}"</strong> dos indicadores de vesting?{" "}
              <span className="text-destructive font-medium">Não é possível desfazer.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
