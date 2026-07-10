import { SubmissionOrigin } from "./common";

export type OriginFilter = "todos" | SubmissionOrigin;

export interface KanbanSubmission {
  id: string;
  project_name: string;
  type: SubmissionOrigin;
  status: string;
  data: Record<string, any>;
  created_at: string;
  user_id: string;
  due_date?: string | null;
  scores?: {
    scores: Record<string, number | boolean>;
    final_score: number;
    has_veto: boolean;
    verdict: string;
  } | null;
}

export const KANBAN_PHASES = [
  { key: "Discovery & Pitch", label: "1. Discovery & Pitch", icon: "💡" },
  { key: "Submissões", label: "2. Submissão", icon: "📥" },
  { key: "Screening", label: "3. Avaliação", icon: "🔍" },
  { key: "Proposta", label: "4. Proposta", icon: "📋" },
  { key: "Ongoing", label: "5. Ongoing", icon: "🚤" },
  { key: "Handover", label: "6. Handover", icon: "🚀" },
  { key: "Despriorizado", label: "7. Despriorizado", icon: "⏸️" },
] as const;

export const ORIGIN_LABELS: Record<SubmissionOrigin, { label: string; emoji: string }> = {
  mercado: { label: "Mercado", emoji: "🚀" },
  interna: { label: "Interno", emoji: "🏢" },
  editais: { label: "Editais", emoji: "📄" },
};
