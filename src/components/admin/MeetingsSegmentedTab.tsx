// Aba "Reuniões" segmentada em dois dropdowns:
//   1. "Reuniões antes do fechamento da parceria" — reuniões category='general'
//      (conteúdo da MeetingsTab original, inalterado)
//   2. "Reuniões de checkpoint" — reuniões category='ongoing' agrupadas em
//      semanas (conteúdo extraído da antiga OngoingTab)
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CalendarDays, Activity } from "lucide-react";
import { MeetingsTab } from "./MeetingsTab";
import { CheckpointMeetingsSection } from "./CheckpointMeetingsSection";

interface MeetingsSegmentedTabProps {
  submissionId: string;
}

export function MeetingsSegmentedTab({ submissionId }: MeetingsSegmentedTabProps) {
  return (
    <Accordion
      type="multiple"
      defaultValue={["pre-fechamento"]}
      className="space-y-3"
    >
      <AccordionItem
        value="pre-fechamento"
        className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-xl px-4 overflow-hidden"
      >
        <AccordionTrigger className="hover:no-underline py-3.5">
          <div className="flex items-center gap-2.5 text-left">
            <CalendarDays className="w-4 h-4 text-primary shrink-0" />
            <span className="font-semibold text-sm">
              Reuniões antes do fechamento da parceria
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-4">
          <MeetingsTab submissionId={submissionId} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem
        value="checkpoint"
        className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-xl px-4 overflow-hidden"
      >
        <AccordionTrigger className="hover:no-underline py-3.5">
          <div className="flex items-center gap-2.5 text-left">
            <Activity className="w-4 h-4 text-accent shrink-0" />
            <span className="font-semibold text-sm">Reuniões de checkpoint</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-4">
          <CheckpointMeetingsSection submissionId={submissionId} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
