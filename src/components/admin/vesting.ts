// ============================================================================
// Lógica compartilhada dos Indicadores de Vesting
// ============================================================================
// Tipos + metadados de status + cálculo de progresso (hook único, fonte de
// verdade usada pelo painel admin E pelo viewer da liderança).
// ============================================================================
import { useMemo } from "react";

export type VestingStatus =
  | "pendente"
  | "em_andamento"
  | "em_risco"
  | "atingido"
  | "nao_atingido";

export interface VestingIndicator {
  id: string;
  submission_id: string;
  name: string;
  goal_description: string;
  weight: number;
  status: VestingStatus;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  direction: "gte" | "lte";
  progress_pct: number | null;
  owner_name: string | null;
  evidence_url: string | null;
  notes: string | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

export const VESTING_STATUS_META: Record<
  VestingStatus,
  { label: string; badgeClass: string; dotClass: string; barClass: string }
> = {
  pendente: {
    label: "Pendente",
    badgeClass: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    dotClass: "bg-yellow-400",
    barClass: "bg-yellow-400/60",
  },
  em_andamento: {
    label: "Em andamento",
    badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    dotClass: "bg-blue-400",
    barClass: "bg-blue-400",
  },
  em_risco: {
    label: "Em risco",
    badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    dotClass: "bg-amber-400",
    barClass: "bg-amber-400",
  },
  atingido: {
    label: "Atingido",
    badgeClass: "bg-accent/20 text-accent border-accent/30",
    dotClass: "bg-accent",
    barClass: "bg-accent",
  },
  nao_atingido: {
    label: "Não atingido",
    badgeClass: "bg-destructive/20 text-destructive border-destructive/30",
    dotClass: "bg-destructive",
    barClass: "bg-destructive",
  },
};

// Ordenação para exibição: o que precisa de atenção sobe.
const STATUS_SORT_RANK: Record<VestingStatus, number> = {
  em_risco: 0,
  nao_atingido: 1,
  pendente: 2,
  em_andamento: 3,
  atingido: 4,
};

export function sortIndicators(list: VestingIndicator[]): VestingIndicator[] {
  return [...list].sort((a, b) => {
    const r = STATUS_SORT_RANK[a.status] - STATUS_SORT_RANK[b.status];
    if (r !== 0) return r;
    const oa = a.display_order ?? Number.MAX_SAFE_INTEGER;
    const ob = b.display_order ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return a.created_at.localeCompare(b.created_at);
  });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// Fração de cumprimento [0,1] de um indicador.
//
// Precedência (do mais forte para o mais fraco):
//   1. status 'atingido'     => 1 (override humano explícito; conta como pleno
//                                  mesmo sem números, com evidência separada)
//   2. status 'nao_atingido' => 0 (marco perdido; conta zerado)
//   3. progress_pct manual   => progress_pct/100 (override numérico — admin
//                                  digitou um %, vale acima de qualquer status)
//   4. target + current      => cálculo proporcional, respeitando direction
//                                  (CAC inverte: target/current)
//   5. status 'em_andamento' ou 'em_risco' SEM números => 0.5 (convenção:
//                                  "em progresso, mas ainda não comprovado")
//   6. status 'pendente'     SEM números => 0
//
// Mudança importante: target/current têm precedência SOBRE o status (exceto
// os dois absolutos). Antes, um indicador 'pendente' com current_value
// preenchido aparecia com fração 0 — o número era ignorado. Agora a barra
// reflete o progresso numérico assim que current_value é registrado, mesmo
// se o admin ainda não mexeu no Select de status.
export function indicatorFraction(i: VestingIndicator): number {
  // 1) Absolutos por status
  if (i.status === "atingido") return 1;
  if (i.status === "nao_atingido") return 0;

  // 2) Override manual numérico — prevalece sobre status
  if (i.progress_pct != null) return clamp(i.progress_pct / 100, 0, 1);

  // 3) Cálculo proporcional por valor atual vs meta
  if (i.target_value != null && i.current_value != null) {
    // Sem dado de base ou de medição => 0 (a barra fica vazia).
    // Em particular: current_value === 0 (sem progresso medido) ou
    // target_value === 0 (sem alvo definido) => fração 0, mesmo se o
    // status manual diz "em_andamento". Honesto: sem número, sem barra.
    if (i.target_value === 0 || i.current_value === 0) return 0;
    if (i.direction === "lte") {
      // menor é melhor (CAC): custo <= alvo => 1
      return clamp(i.target_value / i.current_value, 0, 1);
    }
    return clamp(i.current_value / i.target_value, 0, 1);
  }

  // 4) Sem qualquer medição numérica => 0
  //    Removida a antiga convenção "0.5" para status em_andamento/em_risco
  //    sem dados — gerava a sensação de "barra na metade" mesmo com
  //    current_value vazio.
  return 0;
}

export interface VestingProgress {
  relativePct: number; // 0-100 ponderado pelos pesos cadastrados
  absolutePp: number; // pontos percentuais do vesting (Σ f*weight)
  totalWeight: number; // Σ weight
  achievedCount: number;
  total: number;
  fractions: Record<string, number>;
  hasRisk: boolean;
  weightOver100: boolean;
}

export function computeVestingProgress(
  indicators: VestingIndicator[],
): VestingProgress {
  const fractions: Record<string, number> = {};
  let weightedSum = 0;
  let totalWeight = 0;
  let achievedCount = 0;
  let hasRisk = false;

  for (const i of indicators) {
    const f = indicatorFraction(i);
    fractions[i.id] = f;
    weightedSum += f * i.weight;
    totalWeight += i.weight;
    if (i.status === "atingido") achievedCount++;
    if (i.status === "em_risco" || i.status === "nao_atingido") hasRisk = true;
  }

  const relativePct = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;

  return {
    relativePct: Math.round(relativePct),
    absolutePp: Math.round(weightedSum * 10) / 10,
    totalWeight: Math.round(totalWeight * 10) / 10,
    achievedCount,
    total: indicators.length,
    fractions,
    hasRisk,
    weightOver100: totalWeight > 100,
  };
}

export function useVestingProgress(
  indicators: VestingIndicator[],
): VestingProgress {
  return useMemo(() => computeVestingProgress(indicators), [indicators]);
}

// Cor da barra de progresso de um indicador, refletindo de forma fidedigna o
// VALOR (fração) + o STATUS quando o status é semanticamente forte.
//
// Regra:
//   - status 'nao_atingido' => sempre vermelho (marco perdido, ignora fração)
//   - status 'em_risco'     => sempre âmbar (sinaliza risco, ignora fração)
//   - status 'atingido'     => verde (override humano de marco batido)
//   - status 'pendente' ou 'em_andamento' => cor por faixa de fração:
//        100%      => verde (virtualmente batido)
//        70–99%    => azul (perto do alvo)
//        30–69%    => laranja-primary (em progresso saudável)
//        1–29%     => âmbar (precisa atenção)
//        0%        => trilha neutra (sem dado / pendente vazio)
//
// Assim a barra mostra o VALOR real e a cor reage ao progresso, enquanto o
// dot e o Badge continuam refletindo o STATUS manual escolhido pelo admin.
export function indicatorTone(
  i: VestingIndicator,
  fraction: number,
): { barClass: string; trackClass: string } {
  if (i.status === "nao_atingido")
    return { barClass: "bg-destructive", trackClass: "bg-destructive/15" };
  if (i.status === "em_risco")
    return { barClass: "bg-amber-500", trackClass: "bg-amber-500/15" };
  if (i.status === "atingido")
    return { barClass: "bg-accent", trackClass: "bg-secondary" };

  // pendente | em_andamento — cor por faixa da fração
  if (fraction >= 1) return { barClass: "bg-accent", trackClass: "bg-secondary" };
  if (fraction >= 0.7) return { barClass: "bg-blue-400", trackClass: "bg-secondary" };
  if (fraction >= 0.3) return { barClass: "bg-primary", trackClass: "bg-secondary" };
  if (fraction > 0) return { barClass: "bg-amber-400", trackClass: "bg-secondary" };
  // fração 0 (sem dado / sem progresso) — trilha neutra
  return { barClass: "bg-muted-foreground/30", trackClass: "bg-secondary" };
}

// Cor do anel/headline por faixa de progresso (leitura de temperatura).
export function progressTone(pct: number): {
  ring: string;
  text: string;
  verdict: string;
} {
  if (pct >= 67) {
    return { ring: "text-accent", text: "text-accent", verdict: "No ritmo para vestir" };
  }
  if (pct >= 34) {
    return { ring: "text-primary", text: "text-primary", verdict: "Em evolução" };
  }
  return { ring: "text-amber-400", text: "text-amber-400", verdict: "Fora do ritmo" };
}

// Formata "valor atual / meta" com unidade, respeitando direction.
export function formatValueVsTarget(i: VestingIndicator): string | null {
  const unit = i.unit?.trim() ?? "";
  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);

  // CAC / menor-é-melhor com unidade monetária
  const isMoney = unit === "R$";

  const cur = i.current_value;
  const tgt = i.target_value;

  if (cur == null && tgt == null) return null;

  const curStr =
    cur == null ? "—" : isMoney ? `R$ ${fmt(cur)}` : `${fmt(cur)}`;
  const tgtStr =
    tgt == null
      ? null
      : isMoney
        ? `R$ ${fmt(tgt)}`
        : `${fmt(tgt)}`;

  const tail = isMoney ? "" : unit && unit !== "x" ? ` ${unit}` : "";
  const xSuffix = unit === "x" ? "x" : "";

  if (tgtStr == null) {
    return `${curStr}${xSuffix}${tail}`;
  }
  const arrow = i.direction === "lte" ? "≤" : "/";
  return `${curStr}${xSuffix}${tail} ${arrow} ${tgtStr}${xSuffix}${tail}`.trim();
}
