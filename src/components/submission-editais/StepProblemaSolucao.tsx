import { TextAreaField } from "@/components/submission/FormField";

interface Props {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
  isSimplified?: boolean;
}

const StepProblemaSolucao = ({ form, update, isSimplified = false }: Props) => {
  const opt = !isSimplified;
  return (
    <>
      <TextAreaField label="Qual a dor latente que o edital visa resolver?" value={form.editalPain} onChange={(v) => update("editalPain", v)} required={opt} />
      <TextAreaField label='Preencha a frase: "Para [Públicos/Clientes do Edital] que sofrem com [Problema], nós propomos construir [Solução], utilizando [Nossa Tecnologia/Diferencial]."' value={form.valueSentence} onChange={(v) => update("valueSentence", v)} required={opt} />
      <TextAreaField label="A solução exigida pelo edital se encaixa nas teses da Beyond (LegalTechs, EdTechs, HealthTechs, GovTechs) ou gera valor para nossos parceiros atuais?" value={form.thesisFit} onChange={(v) => update("thesisFit", v)} required={opt} />
    </>
  );
};

export default StepProblemaSolucao;
