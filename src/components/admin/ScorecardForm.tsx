// INVARIANTE DE ARQUITETURA: Os dados deste componente são vinculados exclusivamente ao submission_id.
// O campo `status` da submissão (coluna do Kanban) não afeta a leitura nem a escrita dos scores/reuniões.
// Ao mover um card entre colunas, apenas submissions.status é alterado no banco - os demais dados permanecem intactos.

import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Save, ArrowRight, Skull, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SubmissionOrigin } from "./common";
import {
  BLOCO1_FIELDS, BLOCO2_FIELDS,
  calcFinalScore, checkVetos, getVerdict, SCORECARD_META, sumWeights,
} from "./scorecard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ScorecardFormProps {
  submissionId: string;
  origin: SubmissionOrigin;
  onSaved: () => void;
  // Quando informado, edita a avaliação específica. Quando undefined, carrega
  // a mais recente completed (compat) e cria nova manual se nenhuma existir.
  evaluationId?: string;
}

export function ScorecardForm({ submissionId, origin, onSaved, evaluationId }: ScorecardFormProps) {
  const bloco2 = BLOCO2_FIELDS[origin] || BLOCO2_FIELDS.mercado;

  const [scores, setScores] = useState<Record<string, number | boolean>>({});
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadingScores, setLoadingScores] = useState(true);
  // Id da evaluation que o form está editando. Pode vir via prop, ser
  // descoberta no fetch (latest), ou ser null (criar nova manual no save).
  const [currentEvalId, setCurrentEvalId] = useState<string | null>(evaluationId ?? null);

  useEffect(() => {
    const fetchScores = async () => {
      setLoadingScores(true);

      let query = supabase
        .from("evaluations")
        .select("id, scores, descriptions")
        .eq("submission_id", submissionId)
        .eq("processing_status", "completed");

      query = evaluationId
        ? query.eq("id", evaluationId)
        : query.order("created_at", { ascending: false }).limit(1);

      const { data } = await query.maybeSingle();

      if (data?.scores && typeof data.scores === "object") {
        setScores(data.scores as Record<string, number | boolean>);
        setCurrentEvalId(data.id);
      } else {
        setScores({});
        setCurrentEvalId(evaluationId ?? null);
      }
      if (data?.descriptions && typeof data.descriptions === "object") {
        setDescriptions(data.descriptions as Record<string, string>);
      } else {
        setDescriptions({});
      }
      setLoadingScores(false);
    };

    if (submissionId) fetchScores();
  }, [submissionId, evaluationId]);

  const finalScore = useMemo(() => calcFinalScore(scores, origin), [scores, origin]);
  const hasVeto = useMemo(() => checkVetos(scores, origin), [scores, origin]);
  const verdict = useMemo(() => getVerdict(finalScore, hasVeto), [finalScore, hasVeto]);

  const b1WeightSum = useMemo(() => sumWeights(BLOCO1_FIELDS), []);
  const b2WeightSum = useMemo(() => sumWeights(bloco2), [bloco2]);
  const weightsValid = b1WeightSum === 100 && b2WeightSum === 100;

  const updateField = (key: string, value: number | boolean) => {
    setScores((prev) => ({ ...prev, [key]: value }));
  };
  const updateDescription = (key: string, value: string) => {
    setDescriptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const scoreData = {
        scores: scores as any,
        descriptions: descriptions as any,
        final_score: finalScore,
        has_veto: hasVeto,
        verdict: verdict.label,
        updated_at: new Date().toISOString(),
      };

      if (currentEvalId) {
        const { error } = await supabase
          .from("evaluations")
          .update(scoreData)
          .eq("id", currentEvalId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("evaluations")
          .insert({
            ...scoreData,
            submission_id: submissionId,
            author_id: user.id,
            source: "manual",
            processing_status: "completed",
          })
          .select("id")
          .single();
        if (error) throw error;
        if (inserted) setCurrentEvalId(inserted.id);
      }

      // Suggest move
      if (hasVeto || finalScore < 60) {
        toast.success("Avaliação salva!", {
          description: `Nota: ${finalScore.toFixed(1)} - ${verdict.label}`,
          action: {
            label: "Mover → Despriorizado",
            onClick: async () => {
              await supabase.from("submissions").update({ status: "Despriorizado" }).eq("id", submissionId);
              onSaved();
              toast.info("Card movido para Despriorizado");
            },
          },
        });
      } else if (finalScore > 80) {
        toast.success("Avaliação salva!", {
          description: `Nota: ${finalScore.toFixed(1)} - ${verdict.label}`,
          action: {
            label: "Mover → Ongoing",
            onClick: async () => {
              await supabase.from("submissions").update({ status: "Ongoing" }).eq("id", submissionId);
              onSaved();
              toast.info("Card movido para Ongoing");
            },
          },
        });
      } else {
        toast.success("Avaliação salva!", {
          description: `Nota: ${finalScore.toFixed(1)} - ${verdict.label}`,
        });
      }

      onSaved();
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const scoreColor = hasVeto
    ? "text-destructive"
    : finalScore > 80
    ? "text-accent"
    : finalScore >= 60
    ? "text-yellow-400"
    : "text-destructive";

  const verdictBg = hasVeto
    ? "bg-destructive/10 border-destructive/30"
    : finalScore > 80
    ? "bg-accent/10 border-accent/30"
    : finalScore >= 60
    ? "bg-yellow-500/10 border-yellow-500/30"
    : "bg-destructive/10 border-destructive/30";

  if (loadingScores) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Carregando scorecard…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={`flex items-center justify-between p-4 rounded-xl border ${verdictBg}`}>
        <div>
          <p className="text-xs text-muted-foreground">Nota Final</p>
          <p className={`text-4xl font-black ${scoreColor}`}>{finalScore.toFixed(1)}</p>
        </div>
        <div className={`px-4 py-2 rounded-full text-sm font-bold border ${verdictBg} ${scoreColor}`}>
          {hasVeto && <Skull className="inline w-4 h-4 mr-1" />}
          {verdict.label}
        </div>
      </div>

      {/* Bloco 1 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-primary mb-1">Bloco 1 - Negócio & Produto</h3>
        <p className="text-xs text-muted-foreground mb-4">Peso: 60%</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {BLOCO1_FIELDS.map((f) => (
            <div key={f.key}>
              <ScoreInput
                label={f.label}
                weight={`${f.weight}%`}
                value={(scores[f.key] as number) || 0}
                onChange={(v) => updateField(f.key, v)}
                fieldKey={f.key}
                description={descriptions[f.key] ?? ""}
                onDescriptionChange={(v) => updateDescription(f.key, v)}
              />
              {f.isVeto && (
                <VetoCheckbox
                  label={f.label}
                  checked={!!scores[`veto_${f.key}`]}
                  onChange={(v) => updateField(`veto_${f.key}`, v)}
                />
              )}
            </div>
          ))}
        </div>
        <p className={`mt-3 text-xs font-medium ${b1WeightSum === 100 ? "text-green-400" : "text-destructive"}`}>
          Total dos pesos: {b1WeightSum}/100 {b1WeightSum === 100 ? "✓" : "≠ 100%"}
        </p>
      </div>

      {/* Bloco 2 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-accent mb-1">
          Bloco 2 - {origin === "mercado" ? "Mercado & Founders" : origin === "interna" ? "Interno" : "Editais"}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Peso: 40%</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {bloco2.map((f) => (
            <div key={f.key}>
              <ScoreInput
                label={f.label}
                weight={`${f.weight}%`}
                value={(scores[f.key] as number) || 0}
                onChange={(v) => updateField(f.key, v)}
                fieldKey={f.key}
                description={descriptions[f.key] ?? ""}
                onDescriptionChange={(v) => updateDescription(f.key, v)}
              />
              {f.isVeto && (
                <VetoCheckbox
                  label={f.label}
                  checked={!!scores[`veto_${f.key}`]}
                  onChange={(v) => updateField(`veto_${f.key}`, v)}
                />
              )}
            </div>
          ))}
        </div>
        <p className={`mt-3 text-xs font-medium ${b2WeightSum === 100 ? "text-green-400" : "text-destructive"}`}>
          Total dos pesos: {b2WeightSum}/100 {b2WeightSum === 100 ? "✓" : "≠ 100%"}
        </p>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/30 mt-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          className="border-primary/50 gap-2 opacity-70 cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          Avaliar com IA
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={weightsValid ? -1 : 0}>
              <Button variant="cta" onClick={handleSave} disabled={saving || !weightsValid}>
                {saving ? "Salvando..." : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Avaliação
                    {finalScore > 80 && !hasVeto && <ArrowRight className="w-4 h-4 ml-2" />}
                  </>
                )}
              </Button>
            </span>
          </TooltipTrigger>
          {!weightsValid && (
            <TooltipContent>
              <p>Configure os pesos para fechar 100% antes de salvar</p>
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </div>
  );
}

function ScoreInput({ label, weight, value, onChange, fieldKey, description, onDescriptionChange }: {
  label: string;
  weight: string;
  value: number;
  onChange: (v: number) => void;
  fieldKey: string;
  description: string;
  onDescriptionChange: (v: string) => void;
}) {
  const meta = SCORECARD_META[fieldKey];
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <Label className="text-xs text-foreground">{label}</Label>
        <span className="text-[10px] text-muted-foreground">{weight}</span>
      </div>
      {meta && (
        <>
          <p className="text-xs text-primary/80 leading-snug">{meta.pergunta}</p>
          <p className="text-xs text-muted-foreground leading-snug italic">{meta.justificativa}</p>
        </>
      )}
      <Input
        type="number"
        min={0}
        max={100}
        value={value || ""}
        onChange={(e) => onChange(Math.min(100, Math.max(0, Number(e.target.value))))}
        className="bg-secondary/50 border-border h-8 text-sm"
        placeholder="0-100"
      />
      <textarea
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Justificativa da nota (opcional)"
        rows={2}
        className="w-full bg-secondary/30 border border-border rounded-md p-2 text-xs leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-primary/40"
      />
    </div>
  );
}

function VetoCheckbox({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="mt-1.5 flex items-center gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/20">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
        className="border-destructive data-[state=checked]:bg-destructive"
      />
      <AlertTriangle className="w-3 h-3 text-destructive" />
      <span className="text-[11px] font-medium text-destructive">VETO - {label}</span>
    </div>
  );
}
