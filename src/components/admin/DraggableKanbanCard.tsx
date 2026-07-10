import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KanbanCard } from "./KanbanCard";
import { KanbanSubmission } from "./kanban";

interface DraggableKanbanCardProps {
  submission: KanbanSubmission;
  onCardClick: (submission: KanbanSubmission) => void;
}

export const DraggableKanbanCard = memo(function DraggableKanbanCard({ submission, onCardClick }: DraggableKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: submission.id,
    data: { submission },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard submission={submission} onCardClick={onCardClick} />
    </div>
  );
});
