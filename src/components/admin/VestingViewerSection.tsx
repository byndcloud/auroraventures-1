// ============================================================================
// VestingViewerSection — board de vesting READ-ONLY (liderança)
// ============================================================================
// Renderizado na página /iniciativa/:id, dentro da seção Ongoing, ACIMA das
// semanas. Leitura executiva em 5-10s: anel + veredito + barra de pesos
// empilhada + cards read-only. Zero controles de edição.
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Target, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type VestingIndicator,
  VESTING_STATUS_META,
  useVestingProgress,
  sortIndicators,
  formatValueVsTarget,
  progressTone,
  indicatorTone,
} from "./vesting";
import { VestingRing, VestingStackedBar } from "./VestingShared";

interface Props {
  submissionId: string;
  // Dados pré-carregados (página pública via RPC) — quando presentes, o
  // componente não consulta o Supabase (anon não passa na RLS).
  indicatorsOverride?: VestingIndicator[];
}

export function VestingViewerSection({ submissionId, indicatorsOverride }: Props) {
  const { data: fetched = [], isLoading } = useQuery({
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
    enabled: !!submissionId && !indicatorsOverride,
  });
  const indicators = indicatorsOverride ?? fetched;

  const progress = useVestingProgress(indicators);
  const sorted = sortIndicators(indicators);
  // Tom calculado a partir do progresso RELATIVO (absolutePp / totalWeight),
  // mantendo a leitura de temperatura honesta — assim "No ritmo" só aparece
  // quando boa parte do vesting cadastrado já foi adquirido.
  const ratio = progress.totalWeight > 0 ? progress.absolutePp / progress.totalWeight : 0;
  const tone = progressTone(ratio * 100);

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl mb-6" />;
  }

  if (indicators.length === 0) {
    return null; // sem indicadores, não polui a página
  }

  const lastUpdated = indicators.reduce(
    (max, i) => (i.updated_at > max ? i.updated_at : max),
    indicators[0].updated_at,
  );

  return (
    <div className="glass-card rounded-xl p-6 mb-6 space-y-5">
      {/* Título da subseção */}
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Vesting — primeiros 90 dias
        </h3>
      </div>

      {/* Hero: anel + veredito */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <VestingRing value={progress.absolutePp} max={progress.totalWeight} size={160} />
        <div className="flex-1 text-center sm:text-left space-y-1">
          <p className={`text-lg font-bold ${tone.text}`}>{tone.verdict}</p>
          <p className="text-sm text-foreground">
            {progress.absolutePp.toLocaleString("pt-BR")}% adquirido de{" "}
            {progress.totalWeight.toLocaleString("pt-BR")}% possível ·{" "}
            {progress.achievedCount} de {progress.total} marcos atingidos
          </p>
          <p className="text-xs text-muted-foreground">
            Os marcos cadastrados cobrem {progress.totalWeight.toLocaleString("pt-BR")}% do vesting total
          </p>
        </div>
      </div>

      {/* Barra de pesos empilhada */}
      <VestingStackedBar indicators={sorted} progress={progress} />

      {/* Cards read-only */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sorted.map((i) => {
          const meta = VESTING_STATUS_META[i.status];
          const valueStr = formatValueVsTarget(i);
          const frac = progress.fractions[i.id] ?? 0;
          const tone = indicatorTone(i, frac);
          return (
            <div
              key={i.id}
              className={`bg-card/40 border rounded-xl p-3 space-y-2 ${
                i.status === "em_risco" ? "ring-1 ring-amber-500/40 border-border/50" : "border-border/50"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${meta.dotClass}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{i.goal_description}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${meta.badgeClass}`}>
                    {meta.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {Math.round(frac * 100)}% do marco
                  </span>
                </div>
              </div>

              <div className={`h-1.5 ${tone.trackClass} rounded-full overflow-hidden`}>
                <div
                  className={`h-full ${tone.barClass} transition-[width] duration-500 ease-out`}
                  style={{ width: `${Math.round(frac * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                <span className="text-muted-foreground">
                  {valueStr ?? "—"}
                  <span className="ml-2 text-[10px]">vale {i.weight.toLocaleString("pt-BR")}% do vesting</span>
                </span>
                <div className="flex items-center gap-2">
                  {i.owner_name && <span className="text-[10px] text-muted-foreground">👤 {i.owner_name}</span>}
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

      <p className="text-[10px] text-muted-foreground text-right">
        Atualizado há {formatDistanceToNow(new Date(lastUpdated), { locale: ptBR })}
      </p>
    </div>
  );
}
