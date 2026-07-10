import { type ReactNode, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Loader2, FileText, BarChart2, CalendarDays, Clock, Link2, Check, ClipboardList, Activity } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KanbanSubmission, ORIGIN_LABELS } from "./kanban";
import { SubmissionDetails } from "./SubmissionDetails";
import { EvaluationsTab } from "./EvaluationsTab";
import { SubmissionHistory } from "./SubmissionHistory";
import { MeetingsSegmentedTab } from "./MeetingsSegmentedTab";
import { OngoingTab } from "./OngoingTab";
import { ReadoutTab } from "./ReadoutTab";
import { InitiativeCopilot } from "./InitiativeCopilot";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SubmissionPanelProps {
  submission: KanbanSubmission | null;
  onClose: () => void;
  onSaved: () => void;
}

interface SubmissionTabContentProps {
  value: string;
  children: ReactNode;
}

function SubmissionTabContent({ value, children }: SubmissionTabContentProps) {
  return (
    <TabsContent
      value={value}
      className="modal-tab-scroll absolute inset-0 mt-0 overflow-y-scroll pr-3 overscroll-contain data-[state=active]:block data-[state=inactive]:hidden"
    >
      <div className="min-h-full">
        {children}
      </div>
    </TabsContent>
  );
}

export function SubmissionPanel({ submission, onClose, onSaved }: SubmissionPanelProps) {
  const origin = submission ? ORIGIN_LABELS[submission.type] : null;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!submission) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [submission]);

  const handleShare = () => {
    if (!submission) return;
    const url = `${window.location.origin}/iniciativa/${submission.id}`;
    navigator.clipboard.writeText(url);
    window.open(url, "_blank", "noopener,noreferrer");
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast.success("Link copiado e aberto em nova aba! Restrito a @beyondcompany.com.br e @extreme.digital");
  };

  const handleDelete = async () => {
    if (!submission) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("submissions")
        .delete()
        .eq("id", submission.id);

      if (error) {
        toast.error("Erro ao excluir iniciativa. Tente novamente.");
        return;
      }

      setConfirmOpen(false);
      onClose();
      toast.success("Iniciativa excluída permanentemente.");
      onSaved();
    } catch {
      toast.error("Erro ao excluir iniciativa. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {submission && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
            />

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="pointer-events-auto relative flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[1600px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl sm:h-[calc(100vh-3rem)] sm:w-[calc(100vw-3rem)]"
            >

              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{submission.project_name || "Sem nome"}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {origin && (
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                        {origin.emoji} {origin.label}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{submission.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5 border-border/50">
                    {copied
                      ? <><Check className="w-3.5 h-3.5 text-accent" /> Copiado!</>
                      : <><Link2 className="w-3.5 h-3.5" /> Compartilhar</>
                    }
                  </Button>
                  <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden p-5">
                  <Tabs defaultValue="dados" className="grid h-full min-h-0 w-full grid-rows-[auto,minmax(0,1fr)] overflow-hidden">
                    <TabsList className="w-full shrink-0">
                      <TabsTrigger value="dados" className="flex-1 gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Dados
                      </TabsTrigger>
                      <TabsTrigger value="scorecard" className="flex-1 gap-1.5">
                        <BarChart2 className="w-3.5 h-3.5" />
                        Scorecard
                      </TabsTrigger>
                      <TabsTrigger value="readout" className="flex-1 gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5" />
                        Report
                      </TabsTrigger>
                      <TabsTrigger value="reunioes" className="flex-1 gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" />
                        Reuniões
                      </TabsTrigger>
                      {submission.status === "Ongoing" && (
                        <TabsTrigger value="ongoing" className="flex-1 gap-1.5">
                          <Activity className="w-3.5 h-3.5" />
                          Ongoing
                        </TabsTrigger>
                      )}
                      <TabsTrigger value="historico" className="flex-1 gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Histórico
                      </TabsTrigger>
                    </TabsList>

                    <div className="relative mt-5 min-h-0 overflow-hidden">
                      <SubmissionTabContent value="dados">
                        <SubmissionDetails submission={submission} onSaved={onSaved} />
                      </SubmissionTabContent>
                      <SubmissionTabContent value="scorecard">
                        <EvaluationsTab key={`evals-${submission.id}`} submissionId={submission.id} origin={submission.type as any} onSaved={onSaved} />
                      </SubmissionTabContent>
                      <SubmissionTabContent value="readout">
                        <ReadoutTab key={`readout-${submission.id}`} submissionId={submission.id} />
                      </SubmissionTabContent>
                      <SubmissionTabContent value="reunioes">
                        <MeetingsSegmentedTab key={`meetings-${submission.id}`} submissionId={submission.id} />
                      </SubmissionTabContent>
                      {submission.status === "Ongoing" && (
                        <SubmissionTabContent value="ongoing">
                          <OngoingTab
                            key={`ongoing-${submission.id}`}
                            submissionId={submission.id}
                          />
                        </SubmissionTabContent>
                      )}
                      <SubmissionTabContent value="historico">
                        <SubmissionHistory key={`history-${submission.id}`} submissionId={submission.id} />
                      </SubmissionTabContent>
                    </div>
                  </Tabs>
              </div>

              <div className="border-t border-border p-5">
                <Separator className="mb-4" />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir Iniciativa
                </Button>
              </div>

              {/* Co-Pilot flutuante — ancorado ao modal (canto inferior direito) */}
              <InitiativeCopilot
                submissionId={submission.id}
                initiativeName={submission.project_name}
                variant="inline"
              />
            </motion.div>
            </div>
          </>

        )}
      </AnimatePresence>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir iniciativa permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apagará permanentemente todos os dados, scorecards, reuniões e histórico de movimentações atrelados a esta iniciativa. Essa operação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sim, excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
