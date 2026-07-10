import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KanbanSubmission } from "./kanban";
import { DraggableKanbanCard } from "./DraggableKanbanCard";

interface DroppableKanbanColumnProps {
  id: string;
  icon: string;
  label: string;
  submissions: KanbanSubmission[];
  onCardClick: (sub: KanbanSubmission) => void;
  isKilled?: boolean;
}

export const DroppableKanbanColumn = memo(function DroppableKanbanColumn({
  id,
  icon,
  label,
  submissions,
  onCardClick,
  isKilled,
}: DroppableKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[260px] w-[260px] rounded-xl border transition-all ${
        isOver
          ? "border-primary/60 bg-primary/5 shadow-lg shadow-primary/10"
          : isKilled
          ? "bg-destructive/5 border-destructive/20"
          : "bg-card/20 border-border/40"
      }`}
    >
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{label}</h3>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
          {submissions.length}
        </span>
      </div>
      <ScrollArea className="flex-1 max-h-[calc(100vh-340px)]">
        <div className="p-3 space-y-2.5">
          <SortableContext items={submissions.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <AnimatePresence mode="popLayout">
              {submissions.map((sub) => (
                <DraggableKanbanCard
                  key={sub.id}
                  submission={sub}
                  onCardClick={onCardClick}
                />
              ))}
            </AnimatePresence>
          </SortableContext>
          {submissions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8 opacity-50">
              {isOver ? "Soltar aqui..." : "Nenhuma iniciativa"}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});
