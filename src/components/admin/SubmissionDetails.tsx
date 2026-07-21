import { useState, useRef, useEffect, useMemo } from "react";
import { Pencil, Save, X, Loader2, Calendar, FolderOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { KanbanSubmission } from "./kanban";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { buildLabelMap } from "@/lib/submission-field-labels";

interface SubmissionDetailsProps {
  submission: KanbanSubmission;
  onSaved?: () => void;
}

// Fallback para chaves de founder legadas (papel = PT) que não aparecem em
// nenhuma seção do submission-field-labels canônico.
const FOUNDER_LEGACY_LABELS: Record<string, string> = {
  papel: "Papel",
};

// Fields that should use textarea for editing (longer text)
const LONG_TEXT_FIELDS = new Set([
  "shortDescription", "whyIdea", "timeWorking", "cashBurn", "sellsButFails",
  "techStack", "reduceCosts", "whyThisIdea", "painPoint", "valueProposition",
  "whyUs", "competitors", "marketSize", "equityBreakdown", "externalInvestment",
  "whyApply", "expectations", "workHistory", "achievements", "projects",
]);

// Group keys into sections for display order
const SECTIONS: { title: string; keys: string[] }[] = [
  {
    title: "Solução",
    keys: ["solutionName", "shortDescription", "whyIdea", "vertical", "headquarters", "pitchDeck", "videoDemo"],
  },
  {
    title: "Progresso",
    keys: ["timeWorking", "cashBurn", "sellsButFails", "techStack", "reduceCosts", "mvp4weeks"],
  },
  {
    title: "Problema & Mercado",
    keys: ["whyThisIdea", "painPoint", "valueProposition", "whyUs", "competitors", "marketSize", "scalability", "salesChannels", "regulatory"],
  },
  {
    title: "Equity & Estrutura",
    keys: ["equityBreakdown", "hasCNPJ", "externalInvestment", "thirdPartyDep"],
  },
  {
    title: "Expectativas",
    keys: ["whyApply", "expectations"],
  },
];

function formatYesNo(val: string): string {
  if (val === "sim") return "Sim";
  if (val === "nao") return "Não";
  return val;
}

export function SubmissionDetails({ submission, onSaved }: SubmissionDetailsProps) {
  const data = submission.data || {};
  const canEdit = submission.status === "Submissões";
  const queryClient = useQueryClient();

  // Fonte única de labels: submission-field-labels (por origem) + fallback
  // legado. Nunca criar mapa paralelo no componente.
  const fieldLabelMap = useMemo(
    () => ({
      ...buildLabelMap(submission.type as string),
      ...FOUNDER_LEGACY_LABELS,
    }),
    [submission.type],
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [editProjectName, setEditProjectName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [dueDate, setDueDate] = useState(submission.due_date ?? "");
  const [driveLink, setDriveLink] = useState<string>((submission as any).briefing ?? "");
  const [driveLinkSaved, setDriveLinkSaved] = useState(false);
  const driveDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setDriveLink((submission as any).briefing ?? "");
  }, [submission.id, (submission as any).briefing]);

  const saveDriveLink = async (value: string) => {
    const { error } = await supabase
      .from("submissions")
      .update({ briefing: value || null } as any)
      .eq("id", submission.id);
    if (error) {
      toast.error("Erro ao salvar link da pasta");
      return;
    }
    setDriveLinkSaved(true);
    setTimeout(() => setDriveLinkSaved(false), 2000);
    queryClient.invalidateQueries({ queryKey: ["submissions"] });
    queryClient.invalidateQueries({ queryKey: ["iniciativa", submission.id] });
    onSaved?.();
  };

  const handleDriveLinkChange = (value: string) => {
    setDriveLink(value);
    clearTimeout(driveDebounceRef.current);
    driveDebounceRef.current = setTimeout(() => saveDriveLink(value), 1200);
  };


  const handleDueDateChange = async (value: string) => {
    setDueDate(value);
    const { error } = await supabase
      .from("submissions")
      .update({ due_date: value || null } as any)
      .eq("id", submission.id);
    if (error) {
      toast.error("Erro ao salvar data de vencimento");
      return;
    }
    toast.success("Data de vencimento atualizada");
    queryClient.invalidateQueries({ queryKey: ["submissions"] });
    onSaved?.();
  };

  const startEditing = () => {
    setEditData({ ...data });
    setEditProjectName(submission.project_name);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditData({});
  };

  const updateField = (key: string, value: string) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
  };

  const updateFounderField = (founderIndex: number, key: string, value: string) => {
    setEditData((prev) => {
      const founders = [...(prev.founders || [])];
      founders[founderIndex] = { ...founders[founderIndex], [key]: value };
      return { ...prev, founders };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("submissions")
        .update({
          project_name: editProjectName,
          data: editData,
        })
        .eq("id", submission.id);

      if (error) throw error;

      toast.success("Dados atualizados com sucesso");
      setIsEditing(false);
      onSaved?.();
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Collect all known keys from sections
  const knownKeys = new Set(SECTIONS.flatMap((s) => s.keys));
  knownKeys.add("founders");

  const currentData = isEditing ? editData : data;

  // Extra keys not in predefined sections
  const extraKeys = Object.keys(currentData).filter((k) => !knownKeys.has(k) && typeof currentData[k] !== "object");

  return (
    <div className="space-y-6 min-w-0">
      {/* Edit toggle */}
      {canEdit && (
        <div className="flex justify-end gap-2">
          {isEditing ? (
            <>
              <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={isSaving}>
                <X className="w-4 h-4 mr-1" />
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={startEditing} className="gap-2">
              <Pencil className="w-4 h-4" />
              Editar Dados
            </Button>
          )}
        </div>
      )}

      {/* General info */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-primary">Informações Gerais</h3>
        {isEditing ? (
          <EditableRow label="Projeto" value={editProjectName} onChange={setEditProjectName} />
        ) : (
          <InfoRow label="Projeto" value={submission.project_name} />
        )}
        <InfoRow label="Tipo" value={submission.type === "mercado" ? "Mercado" : submission.type === "interna" ? "Interna" : submission.type === "editais" ? "Editais" : submission.type} />
        <InfoRow label="Status" value={submission.status} />
        <InfoRow label="Submetido em" value={new Date(submission.created_at).toLocaleDateString("pt-BR")} />
      </div>

      {/* Due Date */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <Label className="text-sm font-semibold text-primary">Data de Vencimento (opcional)</Label>
        </div>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => handleDueDateChange(e.target.value)}
          className="bg-card/40 border-border/50 focus:border-primary/50"
        />
        {dueDate && (
          <button
            onClick={() => handleDueDateChange("")}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Remover data
          </button>
        )}
      </div>

      {/* Pasta do Drive */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold text-primary">Pasta do Drive</Label>
          </div>
          {driveLinkSaved && (
            <span className="text-xs text-accent font-medium animate-pulse">✓ Salvo</span>
          )}
        </div>
        <Input
          type="url"
          value={driveLink}
          onChange={(e) => handleDriveLinkChange(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/..."
          className="bg-card/40 border-border/50 focus:border-primary/50"
        />
        {driveLink && (
          <a
            href={driveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-primary hover:underline break-all"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            {driveLink}
          </a>
        )}
      </div>

      {/* Founders */}
      {currentData.founders && Array.isArray(currentData.founders) && (
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-primary">Founders</h3>
          {currentData.founders.map((f: any, i: number) => (
            <div key={i} className="p-3 rounded-lg bg-secondary/30 space-y-2">
              {isEditing ? (
                <EditableRow
                  label="Nome"
                  value={f.name || f.nome || ""}
                  onChange={(v) => updateFounderField(i, f.name !== undefined ? "name" : "nome", v)}
                />
              ) : (
                <p className="text-sm font-medium text-foreground">{f.name || f.nome || `Founder ${i + 1}`}</p>
              )}
              {Object.entries(f).filter(([key]) => key !== "name" && key !== "nome").map(([key, value]) => {
                if (!isEditing && (value === undefined || value === null || value === "")) return null;
                const label = fieldLabelMap[key] || key;
                if (isEditing) {
                  return (
                    <EditableRow
                      key={key}
                      label={label}
                      value={String(value ?? "")}
                      onChange={(v) => updateFounderField(i, key, v)}
                      long={LONG_TEXT_FIELDS.has(key)}
                    />
                  );
                }
                return (
                  <div key={key} className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</span>
                    <span className="text-sm text-foreground break-words overflow-wrap-anywhere">{formatYesNo(String(value))}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Grouped sections */}
      {SECTIONS.map((section) => {
        const entries = section.keys.filter((k) =>
          isEditing ? currentData[k] !== undefined : (currentData[k] !== undefined && currentData[k] !== null && currentData[k] !== "")
        );
        if (entries.length === 0) return null;
        return (
          <div key={section.title} className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-primary">{section.title}</h3>
            {entries.map((key) =>
              isEditing ? (
                <EditableRow
                  key={key}
                  label={fieldLabelMap[key] || key}
                  value={String(currentData[key] ?? "")}
                  onChange={(v) => updateField(key, v)}
                  long={LONG_TEXT_FIELDS.has(key)}
                />
              ) : (
                <InfoRow
                  key={key}
                  label={fieldLabelMap[key] || key}
                  value={formatYesNo(String(currentData[key]))}
                />
              )
            )}
          </div>
        );
      })}

      {/* Any extra fields not in predefined sections */}
      {extraKeys.length > 0 && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-primary">Outros</h3>
          {extraKeys.map((key) =>
            isEditing ? (
              <EditableRow
                key={key}
                label={fieldLabelMap[key] || key}
                value={String(currentData[key] ?? "")}
                onChange={(v) => updateField(key, v)}
                long={LONG_TEXT_FIELDS.has(key)}
              />
            ) : (
              <InfoRow
                key={key}
                label={fieldLabelMap[key] || key}
                value={formatYesNo(String(currentData[key]))}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-sm text-foreground break-words overflow-wrap-anywhere">{value || "-"}</span>
    </div>
  );
}

function EditableRow({
  label,
  value,
  onChange,
  long = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  long?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</span>
      {long ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-secondary/50 border-border text-sm min-h-[80px]"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-secondary/50 border-border text-sm"
        />
      )}
    </div>
  );
}
