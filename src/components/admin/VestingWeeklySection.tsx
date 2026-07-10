// ============================================================================
// VestingWeeklySection — evolução semanal dos indicadores de vesting
// ============================================================================
// Os 90 dias são divididos em 12 semanas fixas (eixo próprio, separado das
// semanas de checkpoint). Três blocos:
//   1. Gráfico de evolução: progresso ponderado (%) semana a semana
//   2. Matriz semanas × indicadores (valor + cor de status por célula)
//   3. Detalhe da semana selecionada: medições por indicador + dificuldades
//      e destaques (editável para admin; read-only com prop readOnly)
//
// Ao salvar a medição da semana mais recente, o snapshot do indicador em
// vesting_indicators (current_value/status) é atualizado — o dashboard
// existente continua refletindo a "foto de hoje".
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  type VestingIndicator,
  type VestingStatus,
  VESTING_STATUS_META,
  computeVestingProgress,
} from "./vesting";

const WEEKS = Array.from({ length: 12 }, (_, i) => i + 1);

const STATUS_OPTIONS: VestingStatus[] = [
  "pendente",
  "em_andamento",
  "em_risco",
  "atingido",
  "nao_atingido",
];

export interface Measurement {
  id: string;
  submission_id: string;
  indicator_id: string;
  week_number: number;
  // SEMÂNTICA (jun/2026):
  //   value_before = "Atual" — valor medido pelo gestor naquela semana
  //   value        = "Meta semanal" — alvo da semana (sugerido como
  //                  target_value/12 cumulativo, editável). Para indicadores
  //                  com direction='lte' (CAC), a meta é constante = target.
  // Os nomes das colunas foram preservados para compatibilidade com dados
  // já gravados; a UI traduz para "Atual / Meta".
  value: number | null;
  value_before: number | null;
  status: VestingStatus;
  comment: string | null;
}

export interface WeekNote {
  id: string;
  submission_id: string;
  week_number: number;
  difficulties: string | null;
  highlights: string | null;
}

interface Props {
  submissionId: string;
  readOnly?: boolean;
  // Dados pré-carregados (página pública via RPC get_public_ongoing) — quando
  // presentes, o componente não consulta o Supabase (anon não passa na RLS)
  // e o modo readOnly é implícito.
  dataOverride?: {
    indicators: VestingIndicator[];
    measurements: Measurement[];
    weekNotes: WeekNote[];
  };
}

// Linha de edição de um indicador na semana selecionada
interface DraftRow {
  valueBefore: string; // Atual (valor medido na semana)
  value: string;       // Meta semanal (alvo da semana)
  status: VestingStatus;
  comment: string;
}

// "atual / meta" com formatação pt-BR; omite partes ausentes.
function formatActualVsTarget(
  actual: number | null,
  target: number | null,
  unit?: string | null,
): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);
  const u = unit && unit !== "R$" ? ` ${unit}` : "";
  const a = actual != null ? fmt(actual) : "—";
  const t = target != null ? fmt(target) : "—";
  return `${a} / ${t}${u}`;
}

// Meta semanal sugerida para um indicador na semana N.
//   - direction='gte' (maior é melhor): target_value / 12 × week_number
//     (alvo CUMULATIVO até o fim da semana). Ex.: target 120, semana 3 → 30.
//   - direction='lte' (menor é melhor, ex.: CAC): target_value constante,
//     pois o alvo é um teto que vale para toda semana.
//   - sem target_value definido: null (sem sugestão).
function suggestedWeeklyTarget(
  indicator: VestingIndicator,
  weekNumber: number,
): number | null {
  if (indicator.target_value == null) return null;
  if (indicator.direction === "lte") return indicator.target_value;
  const v = (indicator.target_value / 12) * weekNumber;
  // Arredonda em até 2 casas para não poluir o input
  return Math.round(v * 100) / 100;
}

export function VestingWeeklySection({
  submissionId,
  readOnly: readOnlyProp = false,
  dataOverride,
}: Props) {
  const readOnly = readOnlyProp || !!dataOverride;
  const queryClient = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [draftDifficulties, setDraftDifficulties] = useState("");
  const [draftHighlights, setDraftHighlights] = useState("");
  const [draftLoadedFor, setDraftLoadedFor] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Queries (desabilitadas quando há dataOverride) ──────────────────────
  const { data: fetchedIndicators = [], isLoading: loadingIndicatorsQ } = useQuery({
    queryKey: ["vesting-indicators", submissionId],
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
    enabled: !!submissionId && !dataOverride,
  });

  const { data: fetchedMeasurements = [], isLoading: loadingMeasurementsQ } = useQuery({
    queryKey: ["vesting-measurements", submissionId],
    queryFn: async () => {
      const from = supabase.from("vesting_measurements" as any) as any;
      const { data, error } = await from
        .select("*")
        .eq("submission_id", submissionId)
        .order("week_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Measurement[];
    },
    enabled: !!submissionId && !dataOverride,
  });

  const { data: fetchedWeekNotes = [] } = useQuery({
    queryKey: ["vesting-week-notes", submissionId],
    queryFn: async () => {
      const from = supabase.from("vesting_week_notes" as any) as any;
      const { data, error } = await from
        .select("*")
        .eq("submission_id", submissionId)
        .order("week_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WeekNote[];
    },
    enabled: !!submissionId && !dataOverride,
  });

  const indicators = dataOverride?.indicators ?? fetchedIndicators;
  const measurements = dataOverride?.measurements ?? fetchedMeasurements;
  const weekNotes = dataOverride?.weekNotes ?? fetchedWeekNotes;
  const loadingIndicators = dataOverride ? false : loadingIndicatorsQ;
  const loadingMeasurements = dataOverride ? false : loadingMeasurementsQ;

  // ─── Derivações ───────────────────────────────────────────────────────────
  // measurementsByIndicator[indicatorId][weekNumber] = Measurement
  const byIndicatorWeek = useMemo(() => {
    const map: Record<string, Record<number, Measurement>> = {};
    for (const m of measurements) {
      map[m.indicator_id] = map[m.indicator_id] ?? {};
      map[m.indicator_id][m.week_number] = m;
    }
    return map;
  }, [measurements]);

  const notesByWeek = useMemo(() => {
    const map: Record<number, WeekNote> = {};
    for (const n of weekNotes) map[n.week_number] = n;
    return map;
  }, [weekNotes]);

  const lastWeekWithData = useMemo(
    () => measurements.reduce((max, m) => Math.max(max, m.week_number), 0),
    [measurements],
  );

  // Série do gráfico: progresso ponderado por semana, com carry-forward da
  // última medição de cada indicador até a semana corrente.
  const chartData = useMemo(() => {
    if (indicators.length === 0) return [];
    return WEEKS.map((week) => {
      let anyData = false;
      const snapshot = indicators.map((ind) => {
        // Curva real (ATUAL) — usa value_before (atual medido). Semanas só
        // com meta cadastrada e sem medição real não alteram a curva.
        let latest: Measurement | null = null;
        for (let w = week; w >= 1; w--) {
          const m = byIndicatorWeek[ind.id]?.[w];
          if (m && m.value_before != null) {
            latest = m;
            break;
          }
          if (m && !latest) anyData = true; // existe registro, mesmo sem atual
        }
        if (latest) anyData = true;
        return {
          ...ind,
          current_value: latest?.value_before ?? null,
          status: latest?.status ?? "pendente",
          // progress_pct manual do snapshot não se aplica ao histórico
          progress_pct: null,
        } as VestingIndicator;
      });
      if (!anyData || week > Math.max(lastWeekWithData, 1)) {
        return { week: `S${week}`, weekNumber: week, pct: null as number | null };
      }
      const progress = computeVestingProgress(snapshot);
      return { week: `S${week}`, weekNumber: week, pct: progress.relativePct };
    });
  }, [indicators, byIndicatorWeek, lastWeekWithData]);

  // ─── Draft da semana selecionada ─────────────────────────────────────────
  // Carrega o draft quando a semana muda: medição existente da semana, ou
  // carry-forward da semana anterior, ou snapshot vazio.
  if (!readOnly && draftLoadedFor !== selectedWeek && !loadingIndicators && !loadingMeasurements) {
    const next: Record<string, DraftRow> = {};
    for (const ind of indicators) {
      const existing = byIndicatorWeek[ind.id]?.[selectedWeek];
      const suggested = suggestedWeeklyTarget(ind, selectedWeek);
      if (existing) {
        next[ind.id] = {
          valueBefore: existing.value_before != null ? String(existing.value_before) : "",
          // Meta vazia em medições antigas → cai na sugestão calculada
          value: existing.value != null
            ? String(existing.value)
            : suggested != null ? String(suggested) : "",
          status: existing.status,
          comment: existing.comment ?? "",
        };
      } else {
        // Atual: carry-forward do "atual" mais recente das semanas anteriores
        let prevActual: number | null = null;
        let prevStatus: VestingStatus = "pendente";
        for (let w = selectedWeek - 1; w >= 1; w--) {
          const m = byIndicatorWeek[ind.id]?.[w];
          if (m) {
            prevStatus = m.status;
            if (m.value_before != null) {
              prevActual = m.value_before;
              break;
            }
          }
        }
        next[ind.id] = {
          valueBefore: prevActual != null ? String(prevActual) : "",
          // Meta sugerida (target/12 cumulativo p/ gte; target p/ lte)
          value: suggested != null ? String(suggested) : "",
          status: prevStatus,
          comment: "",
        };
      }
    }
    setDrafts(next);
    const note = notesByWeek[selectedWeek];
    setDraftDifficulties(note?.difficulties ?? "");
    setDraftHighlights(note?.highlights ?? "");
    setDraftLoadedFor(selectedWeek);
  }

  const updateDraft = (indicatorId: string, patch: Partial<DraftRow>) => {
    setDrafts((prev) => ({
      ...prev,
      [indicatorId]: { ...prev[indicatorId], ...patch },
    }));
  };

  // ─── Salvar semana ────────────────────────────────────────────────────────
  const handleSaveWeek = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1) Upsert das medições (uma por indicador)
      const rows = indicators.map((ind) => {
        const d = drafts[ind.id];
        return {
          submission_id: submissionId,
          indicator_id: ind.id,
          week_number: selectedWeek,
          value_before: d?.valueBefore.trim()
            ? Number(d.valueBefore.replace(",", "."))
            : null,
          value: d?.value.trim() ? Number(d.value.replace(",", ".")) : null,
          status: d?.status ?? "pendente",
          comment: d?.comment.trim() || null,
          created_by: user?.id ?? null,
        };
      });
      const fromMeas = supabase.from("vesting_measurements" as any) as any;
      const { error: measErr } = await fromMeas.upsert(rows, {
        onConflict: "indicator_id,week_number",
      });
      if (measErr) throw measErr;

      // 2) Upsert das notas da semana
      const fromNotes = supabase.from("vesting_week_notes" as any) as any;
      const { error: notesErr } = await fromNotes.upsert(
        {
          submission_id: submissionId,
          week_number: selectedWeek,
          difficulties: draftDifficulties.trim() || null,
          highlights: draftHighlights.trim() || null,
          created_by: user?.id ?? null,
        },
        { onConflict: "submission_id,week_number" },
      );
      if (notesErr) throw notesErr;

      // 3) Snapshot: se esta é a semana mais recente com dados, sincroniza
      //    vesting_indicators (current_value/status) — dashboard reflete.
      if (selectedWeek >= lastWeekWithData) {
        const fromInd = supabase.from("vesting_indicators" as any) as any;
        for (const row of rows) {
          // Snapshot reflete o ATUAL (value_before), não a meta (value).
          // Atual vazio → não zera o snapshot, mantém o valor anterior.
          if (row.value_before == null) continue;
          const { error: indErr } = await fromInd
            .update({ current_value: row.value_before, status: row.status })
            .eq("id", row.indicator_id);
          if (indErr) {
            console.warn("Falha ao sincronizar snapshot:", indErr.message);
          }
        }
      }

      toast.success(`Semana ${selectedWeek} registrada.`);
      queryClient.invalidateQueries({ queryKey: ["vesting-measurements", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["vesting-week-notes", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["vesting-indicators", submissionId] });
      setDraftLoadedFor(null); // força recarregar draft com dados persistidos
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar a semana.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loadingIndicators || loadingMeasurements) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (indicators.length === 0) {
    return (
      <div className="glass-card rounded-xl p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Cadastre os indicadores de vesting para habilitar o acompanhamento semanal.
        </p>
      </div>
    );
  }

  const selectedNote = notesByWeek[selectedWeek];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Evolução semanal — 12 semanas</h3>
      </div>

      {/* ── 1. Gráfico de evolução ── */}
      <div className="glass-card rounded-xl p-4">
        <p className="text-xs text-muted-foreground mb-3">
          Progresso ponderado do vesting (%) semana a semana
        </p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: any) => [`${value}%`, "Progresso"]}
              />
              <Line
                type="monotone"
                dataKey="pct"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 2. Matriz semanas × indicadores ── */}
      <div className="glass-card rounded-xl p-4 overflow-x-auto">
        <p className="text-xs text-muted-foreground mb-3">
          Atual / meta semanal por indicador — clique numa coluna para abrir a semana
        </p>
        <table className="w-full text-xs border-collapse min-w-[640px]">
          <thead>
            <tr>
              <th className="text-left font-medium text-muted-foreground pb-2 pr-3">
                Indicador
              </th>
              {WEEKS.map((w) => (
                <th
                  key={w}
                  className={`pb-2 px-1 font-medium cursor-pointer transition-colors ${
                    selectedWeek === w
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setSelectedWeek(w)}
                >
                  S{w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {indicators.map((ind) => (
              <tr key={ind.id} className="border-t border-border/30">
                <td className="py-2 pr-3 font-medium max-w-[180px] truncate" title={ind.name}>
                  {ind.name}
                </td>
                {WEEKS.map((w) => {
                  const m = byIndicatorWeek[ind.id]?.[w];
                  const meta = m ? VESTING_STATUS_META[m.status] : null;
                  return (
                    <td
                      key={w}
                      className={`py-2 px-1 text-center cursor-pointer ${
                        selectedWeek === w ? "bg-primary/5" : ""
                      }`}
                      onClick={() => setSelectedWeek(w)}
                      title={
                        m
                          ? `atual / meta: ${formatActualVsTarget(m.value_before, m.value, ind.unit)}${
                              m.comment ? ` — ${m.comment}` : ""
                            }`
                          : undefined
                      }
                    >
                      {m ? (
                        <span className="inline-flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${meta!.dotClass}`} />
                          <span className="whitespace-nowrap">
                            {(() => {
                              const fmt = (n: number) =>
                                new Intl.NumberFormat("pt-BR", {
                                  maximumFractionDigits: 1,
                                  notation: "compact",
                                }).format(n);
                              // exibe "atual/meta" compacto
                              if (m.value_before != null && m.value != null)
                                return `${fmt(m.value_before)}/${fmt(m.value)}`;
                              if (m.value_before != null) return fmt(m.value_before);
                              if (m.value != null) return `—/${fmt(m.value)}`;
                              return "·";
                            })()}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 3. Detalhe da semana selecionada ── */}
      <div className="glass-card rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Semana {selectedWeek}</span>
            {selectedWeek <= lastWeekWithData &&
              (byIndicatorWeek[indicators[0]?.id]?.[selectedWeek] ||
                measurements.some((m) => m.week_number === selectedWeek)) && (
                <Badge variant="outline" className="text-[10px]">
                  registrada
                </Badge>
              )}
          </div>
          <Select
            value={String(selectedWeek)}
            onValueChange={(v) => setSelectedWeek(Number(v))}
          >
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKS.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  Semana {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {readOnly ? (
          // ── Read-only (viewer/liderança) ──
          <div className="space-y-4">
            <div className="space-y-2">
              {indicators.map((ind) => {
                const m = byIndicatorWeek[ind.id]?.[selectedWeek];
                const meta = m ? VESTING_STATUS_META[m.status] : null;
                return (
                  <div
                    key={ind.id}
                    className="flex items-center gap-3 bg-background/40 border border-border/40 rounded-md px-3 py-2"
                  >
                    <span className="text-sm font-medium flex-1 min-w-0 truncate">
                      {ind.name}
                    </span>
                    {m ? (
                      <>
                        <span
                          className="text-sm tabular-nums"
                          title="atual / meta semanal"
                        >
                          {formatActualVsTarget(m.value_before, m.value, ind.unit)}
                        </span>
                        <Badge variant="outline" className={`text-[10px] ${meta!.badgeClass}`}>
                          {meta!.label}
                        </Badge>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">sem medição</span>
                    )}
                  </div>
                );
              })}
            </div>
            {(selectedNote?.difficulties || selectedNote?.highlights) && (
              <div className="grid sm:grid-cols-2 gap-3">
                {selectedNote?.difficulties && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-md p-3">
                    <p className="text-xs font-semibold text-amber-400 mb-1">Dificuldades</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedNote.difficulties}</p>
                  </div>
                )}
                {selectedNote?.highlights && (
                  <div className="bg-accent/5 border border-accent/20 rounded-md p-3">
                    <p className="text-xs font-semibold text-accent mb-1">Destaques</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedNote.highlights}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // ── Edição (admin) ──
          <div className="space-y-4">
            <div className="space-y-2">
              {indicators.map((ind) => {
                const d = drafts[ind.id];
                return (
                  <div
                    key={ind.id}
                    className="grid grid-cols-1 sm:grid-cols-[minmax(140px,1fr)_190px_150px_1fr] gap-2 items-center bg-background/40 border border-border/40 rounded-md px-3 py-2"
                  >
                    <span className="text-sm font-medium truncate" title={ind.goal_description}>
                      {ind.name}
                      {ind.unit ? (
                        <span className="text-[10px] text-muted-foreground ml-1">
                          ({ind.unit})
                        </span>
                      ) : null}
                    </span>
                    {/* Atual / Meta semanal (sugerida) */}
                    <div className="flex items-center gap-1.5">
                      <Input
                        className="h-8 text-sm"
                        placeholder="atual"
                        inputMode="decimal"
                        title="Valor medido nesta semana"
                        value={d?.valueBefore ?? ""}
                        onChange={(e) => updateDraft(ind.id, { valueBefore: e.target.value })}
                        disabled={saving}
                      />
                      <span className="text-muted-foreground text-sm shrink-0">/</span>
                      <Input
                        className="h-8 text-sm"
                        placeholder="meta"
                        inputMode="decimal"
                        title={
                          ind.direction === "lte"
                            ? "Meta da semana (≤ alvo) — sugerida = alvo do indicador"
                            : `Meta da semana — sugerida = (alvo do indicador) / 12 × ${selectedWeek}`
                        }
                        value={d?.value ?? ""}
                        onChange={(e) => updateDraft(ind.id, { value: e.target.value })}
                        disabled={saving}
                      />
                    </div>
                    <Select
                      value={d?.status ?? "pendente"}
                      onValueChange={(v) => updateDraft(ind.id, { status: v as VestingStatus })}
                      disabled={saving}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {VESTING_STATUS_META[s].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-8 text-sm"
                      placeholder="comentário (opcional)"
                      value={d?.comment ?? ""}
                      onChange={(e) => updateDraft(ind.id, { comment: e.target.value })}
                      disabled={saving}
                    />
                  </div>
                );
              })}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-amber-400">
                  Dificuldades da semana
                </label>
                <Textarea
                  className="mt-1 min-h-[80px] text-sm"
                  placeholder="O que travou ou dificultou o avanço esta semana?"
                  value={draftDifficulties}
                  onChange={(e) => setDraftDifficulties(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-accent">
                  Destaques da semana
                </label>
                <Textarea
                  className="mt-1 min-h-[80px] text-sm"
                  placeholder="O que avançou ou merece destaque?"
                  value={draftHighlights}
                  onChange={(e) => setDraftHighlights(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveWeek} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar semana {selectedWeek}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
