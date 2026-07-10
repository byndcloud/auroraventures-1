import { Field, TextAreaField } from "@/components/submission/FormField";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface Props {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
  isSimplified?: boolean;
}

const TIPO_OPTIONS = [
  { value: "cpsi", label: "CPSI" },
  { value: "licitacao", label: "Licitação" },
  { value: "chamamento-publico", label: "Chamamento Público" },
  { value: "parceria-estrategica", label: "Parceria Estratégica" },
];

const StepInfoBasicas = ({ form, update, isSimplified = false }: Props) => {
  const opt = !isSimplified;
  return (
    <>
      <Field label="Nome do Edital e Órgão Fomentador" value={form.editalName} onChange={(v) => update("editalName", v)} placeholder="Ex: FINEP, FAPESP, SENAI" required={true} />
      <div className="space-y-3">
        <Label className="text-foreground">
          Tipo
          {opt
            ? <span className="text-destructive ml-1">*</span>
            : <span className="text-muted-foreground ml-1 text-xs">(opcional)</span>
          }
        </Label>
        <RadioGroup value={form.editalType || ""} onValueChange={(v) => update("editalType", v)} className="flex flex-wrap gap-3">
          {TIPO_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                form.editalType === opt.value
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
      <Field label="Link oficial do Edital" value={form.editalLink} onChange={(v) => update("editalLink", v)} placeholder="https://..." required={opt} />
      <Field label="Link de Submissão" value={form.submissionLink} onChange={(v) => update("submissionLink", v)} placeholder="https://..." required={opt} />
      <Field label="Data Limite para Submissão" type="date" value={form.deadline} onChange={(v) => update("deadline", v)} required={opt} />
      <Field label="Valor Máximo Financiado (Ticket)" value={form.maxValue} onChange={(v) => update("maxValue", v)} placeholder="R$ 0,00" required={opt} />
      <TextAreaField label="Qual o percentual ou valor de contrapartida financeira ou econômica (horas de time) que a Beyond precisará aportar?" value={form.counterpart} onChange={(v) => update("counterpart", v)} required={opt} />
    </>
  );
};

export default StepInfoBasicas;
