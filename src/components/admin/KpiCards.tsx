import { useMemo } from "react";
import { motion } from "framer-motion";
import { KanbanSubmission } from "./kanban";

interface KpiCardsProps {
  submissions: KanbanSubmission[];
}

export function KpiCards({ submissions }: KpiCardsProps) {
  const kpis = useMemo(() => {
    const active = submissions.filter((s) => s.status !== "Despriorizado");
    const mercado = submissions.filter((s) => s.type === "mercado" && s.status !== "Despriorizado");
    const interna = submissions.filter((s) => s.type === "interna" && s.status !== "Despriorizado");
    const editais = submissions.filter((s) => s.type === "editais" && s.status !== "Despriorizado");

    const passedScreening = submissions.filter(
      (s) => s.status === "Ongoing" || s.status === "Handover" || s.status === "Proposta"
    ).length;
    const totalScreened = submissions.filter(
      (s) => s.status !== "Discovery & Pitch" && s.status !== "Submissões"
    ).length;
    const approvalRate = totalScreened > 0 ? Math.round((passedScreening / totalScreened) * 100) : 0;

    return [
      { emoji: "📊", label: "Iniciativas Ativas", value: active.length, suffix: "" },
      { emoji: "🚀", label: "Mercado", value: mercado.length, suffix: "" },
      { emoji: "🏢", label: "Internas", value: interna.length, suffix: "" },
      { emoji: "📄", label: "Editais", value: editais.length, suffix: "" },
      { emoji: "🎯", label: "Taxa Aprovação", value: approvalRate, suffix: "%" },
      { emoji: "🗂️", label: "Total Cadastradas", value: submissions.length, suffix: "" },
    ];
  }, [submissions]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="glass-card p-4 flex flex-col items-center text-center gap-1 hover:border-primary/30 transition-colors"
        >
          <span className="text-xl">{kpi.emoji}</span>
          <span className="text-2xl font-black text-foreground">
            {kpi.value}{kpi.suffix}
          </span>
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
            {kpi.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
