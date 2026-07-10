// Aba "Ongoing" — dashboard de indicadores de vesting + evolução semanal.
// O sistema de semanas/reuniões de checkpoint que vivia aqui foi movido para
// a aba Reuniões (dropdown "Reuniões de checkpoint") — ver
// CheckpointMeetingsSection.tsx e MeetingsSegmentedTab.tsx.
import { VestingIndicatorsPanel } from "./VestingIndicatorsPanel";
import { VestingWeeklySection } from "./VestingWeeklySection";
import { OngoingShareLink } from "./OngoingShareLink";

interface OngoingTabProps {
  submissionId: string;
}

export function OngoingTab({ submissionId }: OngoingTabProps) {
  return (
    <div className="space-y-6">
      <OngoingShareLink submissionId={submissionId} />
      <VestingIndicatorsPanel submissionId={submissionId} />
      <VestingWeeklySection submissionId={submissionId} />
    </div>
  );
}
