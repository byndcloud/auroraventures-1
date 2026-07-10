import { TextAreaField } from "@/components/submission/FormField";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Props {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
  isSimplified?: boolean;
}

const StepElegibilidade = ({ form, update, isSimplified = false }: Props) => {
  const opt = !isSimplified;
  return (
    <>
      <TextAreaField label="O edital garante que a Propriedade Intelectual (PI) da solução desenvolvida permanecerá 100% com a Beyond/Extreme Group, ou há exigência de copropriedade com o órgão/parceiros?" value={form.intellectualProperty} onChange={(v) => update("intellectualProperty", v)} required={opt} />
      <div className="space-y-2">
        <Label className="text-foreground">
          Nós já possuímos todos os atestados de capacidade técnica e certidões exigidas para participar deste edital específico?
          {opt
            ? <span className="text-destructive ml-1">*</span>
            : <span className="text-muted-foreground ml-1 text-xs">(opcional)</span>
          }
        </Label>
        <RadioGroup value={form.certifications || ""} onValueChange={(v) => update("certifications", v)} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="sim" id="cert-yes" />
            <Label htmlFor="cert-yes" className="text-foreground">Sim, temos tudo</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="nao" id="cert-no" />
            <Label htmlFor="cert-no" className="text-foreground">Não temos, desclassificação imediata</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="em-analise" id="cert-analysis" />
            <Label htmlFor="cert-analysis" className="text-foreground">Em análise</Label>
          </div>
        </RadioGroup>
      </div>
      <TextAreaField label="O valor financiado pelo edital é maior do que o custo e o esforço burocrático de escrever o projeto e prestar contas durante meses? A solução gerada terá valor de mercado futuro?" value={form.costBenefit} onChange={(v) => update("costBenefit", v)} required={opt} />
      <TextAreaField label="O edital exige a participação obrigatória de ICTs (Institutos de Ciência e Tecnologia), universidades ou outras startups no consórcio? (Se sim, listar quem seriam)." value={form.ictRequirement} onChange={(v) => update("ictRequirement", v)} required={opt} />
    </>
  );
};

export default StepElegibilidade;
