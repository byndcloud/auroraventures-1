// Diálogo de edição dos metadados de uma reunião — título, data/hora e link
// externo da ata (pre_agenda). Conteúdo da ata é editado em outro diálogo.
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EditMeetingDialogProps {
  meeting: {
    id: string;
    submission_id: string;
    title: string;
    meeting_date: string;
  } | null;
  onClose: () => void;
}

// Converte ISO timestamp em string aceita por <input type="datetime-local">
function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditMeetingDialog({ meeting, onClose }: EditMeetingDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (meeting) {
      setTitle(meeting.title);
      setMeetingDate(isoToDatetimeLocal(meeting.meeting_date));
    }
  }, [meeting]);

  if (!meeting) return null;

  const handleSave = async () => {
    if (!title.trim() || !meetingDate) {
      toast.error("Título e data são obrigatórios.");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("meetings")
        .update({
          title: title.trim(),
          meeting_date: new Date(meetingDate).toISOString(),
        })
        .eq("id", meeting.id);
      if (error) throw error;
      toast.success("Reunião atualizada.");
      queryClient.invalidateQueries({ queryKey: ["meetings", meeting.submission_id] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar reunião.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!meeting} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar reunião</DialogTitle>
          <DialogDescription>
            Atualize título e data/hora da reunião.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Título da Reunião *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Data e Hora *</label>
            <Input
              type="datetime-local"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              disabled={isSaving}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
