import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Field, TextAreaField } from "./FormField";

interface Props {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
  isSimplified?: boolean;
}

const VERTICAL_OPTIONS = [
  { value: "legaltech", label: "LegalTech" },
  { value: "edtech", label: "EdTech" },
  { value: "healthtech", label: "HealthTech" },
  { value: "govtech", label: "GovTech" },
  { value: "outra", label: "Outra" },
];

const StepSolution = ({ form, update, isSimplified = false }: Props) => {
  const opt = !isSimplified;
  return (
    <>
      <Field label="Nome da solução/empresa" value={form.solutionName} onChange={(v) => update("solutionName", v)} required={true} />
      <Field label="Descreva o que a solução faz em 50 caracteres ou menos" value={form.shortDescription} onChange={(v) => update("shortDescription", v)} placeholder="Max 50 caracteres" required={opt} />
      <TextAreaField label="Por que você escolheu esta ideia? Possui experiência prática nesta área?" value={form.whyIdea} onChange={(v) => update("whyIdea", v)} required={opt} />
      <div className="space-y-3">
        <Label className="text-foreground">
          Vertical
          {opt
            ? <span className="text-destructive ml-1">*</span>
            : <span className="text-muted-foreground ml-1 text-xs">(opcional)</span>
          }
        </Label>
        <RadioGroup value={form.vertical || ""} onValueChange={(v) => update("vertical", v)} className="flex flex-wrap gap-3">
          {VERTICAL_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                form.vertical === opt.value
                  ? "bg-primary/10 border-primary text-primary font-medium"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <RadioGroupItem value={opt.value} className="sr-only" />
              {opt.label}
            </label>
          ))}
        </RadioGroup>
      </div>
      <Field label="Onde a empresa está sediada?" value={form.headquarters} onChange={(v) => update("headquarters", v)} required={opt} />
      <Field label="Envio Pitch Deck (PDF/PPT)  (Link compartilhável)" value={form.pitchDeck} onChange={(v) => update("pitchDeck", v)} placeholder="https://..." required={false} />
      <Field label="Envio Vídeo de Demo da solução (até 5 min)" value={form.videoDemo} onChange={(v) => update("videoDemo", v)} placeholder="https://..." required={false} />
    </>
  );
};

export default StepSolution;
