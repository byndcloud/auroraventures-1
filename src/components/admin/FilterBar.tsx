import { motion } from "framer-motion";
import { OriginFilter, ORIGIN_LABELS } from "./kanban";

interface FilterBarProps {
  active: OriginFilter;
  onChange: (filter: OriginFilter) => void;
}

const filters: { key: OriginFilter; label: string; emoji?: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "mercado", label: ORIGIN_LABELS.mercado.label, emoji: ORIGIN_LABELS.mercado.emoji },
  { key: "interna", label: ORIGIN_LABELS.interna.label, emoji: ORIGIN_LABELS.interna.emoji },
  { key: "editais", label: ORIGIN_LABELS.editais.label, emoji: ORIGIN_LABELS.editais.emoji },
];

export function FilterBar({ active, onChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            active === f.key
              ? "text-primary-foreground"
              : "text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary"
          }`}
        >
          {active === f.key && (
            <motion.div
              layoutId="filter-active"
              className="absolute inset-0 bg-primary rounded-lg"
              transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className="relative z-10">
            {f.emoji && <span className="mr-1.5">{f.emoji}</span>}
            {f.label}
          </span>
        </button>
      ))}
    </div>
  );
}
