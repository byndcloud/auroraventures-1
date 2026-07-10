import { memo } from "react";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { KanbanSubmission, ORIGIN_LABELS } from "./kanban";
import { Badge } from "@/components/ui/badge";

interface KanbanCardProps {
  submission: KanbanSubmission;
  onCardClick: (submission: KanbanSubmission) => void;
}

function getVerticalFromData(data: Record<string, any>): string | null {
  return data?.vertical || data?.setor || null;
}

function getScoreColor(score?: number, hasVeto?: boolean) {
  if (hasVeto) return "bg-destructive/20 border-destructive/40 text-destructive";
  if (!score) return "";
  if (score > 80) return "bg-accent/10 border-accent/30";
  if (score >= 60) return "bg-yellow-500/10 border-yellow-500/30";
  return "bg-destructive/10 border-destructive/30";
}

function getDueDateStatus(dueDate: string | null | undefined) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `Vencido há ${Math.abs(diffDays)}d`, color: "text-destructive bg-destructive/10 border-destructive/30" };
  if (diffDays === 0) return { label: "Vence hoje", color: "text-destructive bg-destructive/10 border-destructive/30" };
  if (diffDays <= 7) return { label: `Vence em ${diffDays}d`, color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" };
  return { label: new Date(dueDate).toLocaleDateString("pt-BR"), color: "text-accent bg-accent/10 border-accent/30" };
}

export const KanbanCard = memo(function KanbanCard({ submission, onCardClick }: KanbanCardProps) {
  const origin = ORIGIN_LABELS[submission.type] || { label: submission.type, emoji: "📋" };
  const vertical = getVerticalFromData(submission.data);
  const score = submission.scores?.final_score;
  const hasVeto = submission.scores?.has_veto;
  const dueDateStatus = getDueDateStatus(submission.due_date);

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => onCardClick(submission)}
      className={`w-full text-left p-3.5 rounded-lg border transition-all hover:shadow-md hover:shadow-primary/5 hover:border-primary/30 cursor-pointer ${
        score !== undefined
          ? getScoreColor(score, hasVeto)
          : "bg-card/60 border-border/60 hover:bg-card/80"
      }`}
    >
      <p className="font-semibold text-sm text-foreground truncate">
        {submission.project_name || "Sem nome"}
      </p>

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-primary/30 text-primary">
          {origin.emoji} {origin.label}
        </Badge>
        {vertical && (
          <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5">
            {vertical}
          </Badge>
        )}
        {dueDateStatus && (
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${dueDateStatus.color}`}>
            <Calendar className="w-3 h-3" />
            {dueDateStatus.label}
          </span>
        )}
      </div>

      {score !== undefined && (
        <div className="mt-2 flex items-center justify-between">
          <span className={`text-xs font-bold ${
            hasVeto ? "text-destructive" : score > 80 ? "text-accent" : score >= 60 ? "text-yellow-400" : "text-destructive"
          }`}>
            {hasVeto ? "VETO" : score.toFixed(1)}
          </span>
          {submission.scores?.verdict && (
            <span className="text-[10px] text-muted-foreground">{submission.scores.verdict}</span>
          )}
        </div>
      )}
    </motion.button>
  );
});
