// Barrel de hooks TanStack Query compartilhados do domínio submissions.
// Centraliza queries duplicadas nas páginas admin/viewer/founder e nos
// componentes de scorecard/reuniões/ongoing.

export { useSubmissionsWithScores } from "./useSubmissionsWithScores";
export { useMySubmissions } from "./useMySubmissions";
export { useEvaluations } from "./useEvaluations";
export { useMeetings } from "./useMeetings";
export { useOngoingWeeks } from "./useOngoingWeeks";
