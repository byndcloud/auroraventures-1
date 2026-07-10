// ============================================================================
// Componentes visuais compartilhados dos Indicadores de Vesting
// ============================================================================
// VestingRing       — anel radial de progresso (SVG nativo, gradiente Aurora)
// VestingStackedBar — barra de pesos empilhada (composição do vesting)
// Usados tanto pelo painel admin quanto pelo viewer da liderança.
// ============================================================================
import {
  type VestingIndicator,
  type VestingProgress,
  VESTING_STATUS_META,
  progressTone,
  indicatorTone,
} from "./vesting";

// ─── Anel de progresso ──────────────────────────────────────────────────────
// Representa "quanto do vesting JÁ FOI ADQUIRIDO" sobre o "total possível".
//   - `value` = pontos percentuais já adquiridos (Σ fração × peso). Ex: 2.
//   - `max`   = total possível (Σ pesos cadastrados). Ex: 20.
// O preenchimento do círculo é `value/max`. O número central é o `value` em
// % (ex: "2%") e o label diz "de X% possível".
//
// Tom (cor do número) é baseado no PROGRESSO RELATIVO (`value/max`) — usa a
// faixa de "temperatura" pra ler em segundos se está no ritmo, em evolução
// ou fora do ritmo.
export function VestingRing({
  value,
  max,
  size = 150,
  stroke = 12,
  label,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.max(0, Math.min(1, value / safeMax));
  const offset = circumference - ratio * circumference;
  const tone = progressTone(ratio * 100);

  // Formatação: até 1 casa decimal se necessário, sem zero à direita
  const fmt = (n: number) => {
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  };
  const valueLabel = `${fmt(value)}%`;
  const maxLabel = `${fmt(max)}%`;
  const fontSize = size >= 150 ? "text-3xl" : "text-2xl";

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="auroraVestingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--accent))" />
          </linearGradient>
        </defs>
        {/* trilha */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth={stroke}
        />
        {/* progresso */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#auroraVestingGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        <span className={`${fontSize} font-bold leading-none ${tone.text}`}>
          {valueLabel}
        </span>
        <span className="text-[10px] text-muted-foreground leading-tight mt-1">
          de {maxLabel} possível
        </span>
        {label && (
          <span className="text-[9px] text-muted-foreground/80 leading-tight mt-0.5">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Barra de pesos empilhada ───────────────────────────────────────────────
// Cada segmento = um indicador, largura proporcional ao peso, preenchimento
// proporcional à fração de cumprimento, cor pelo status.
export function VestingStackedBar({
  indicators,
  progress,
}: {
  indicators: VestingIndicator[];
  progress: VestingProgress;
}) {
  const total = progress.totalWeight || 1;

  return (
    <div className="space-y-1.5">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
        {indicators.map((i) => {
          const widthPct = (i.weight / total) * 100;
          const fill = progress.fractions[i.id] ?? 0;
          const tone = indicatorTone(i, fill);
          return (
            <div
              key={i.id}
              className="relative h-full border-r border-background/40 last:border-r-0"
              style={{ width: `${widthPct}%` }}
              title={`${i.name} · ${i.goal_description} · peso ${i.weight}% · ${Math.round(fill * 100)}% do marco`}
            >
              <div
                className={`h-full ${tone.barClass} transition-[width] duration-500 ease-out`}
                style={{ width: `${Math.round(fill * 100)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {(["atingido", "em_andamento", "em_risco", "nao_atingido", "pendente"] as const).map(
          (s) => (
            <span key={s} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={`inline-block w-2 h-2 rounded-full ${VESTING_STATUS_META[s].dotClass}`} />
              {VESTING_STATUS_META[s].label}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
