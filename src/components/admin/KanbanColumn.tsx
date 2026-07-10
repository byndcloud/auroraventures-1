import { memo } from "react";
import { AnimatePresence } from "framer-motion";
import { KanbanSubmission } from "./kanban";
import { KanbanCard } from "./KanbanCard";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KanbanColumnProps {
  icon: string;
  label: string;
  submissions: KanbanSubmission[];
  onCardClick: (sub: KanbanSubmission) => void;
  isKilled?: boolean;
}

export const KanbanColumn = memo(function KanbanColumn({ icon, label, submissions, onCardClick, isKilled }: KanbanColumnProps) {
  return (
    <div className={`flex flex-col min-w-[260px] w-[260px] rounded-xl border ${
      isKilled ? "bg-destructive/5 border-destructive/20" : "bg-card/20 border-border/40"
    }`}>
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{label}</h3>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
          {submissions.length}
        </span>
      </div>
      <ScrollArea className="flex-1 max-h-[calc(100vh-240px)]">
        <div className="p-3 space-y-2.5">
          <AnimatePresence mode="popLayout">
            {submissions.map((sub) => (
              <KanbanCard key={sub.id} submission={sub} onCardClick={onCardClick} />
            ))}
          </AnimatePresence>
          {submissions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8 opacity-50">
              Nenhuma iniciativa
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});
