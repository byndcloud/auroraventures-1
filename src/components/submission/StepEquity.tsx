import { TextAreaField, YesNoField } from "./FormField";

interface Props {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
  isSimplified?: boolean;
}

const StepEquity = ({ form, update, isSimplified = false }: Props) => {
  const opt = !isSimplified;
  return (
    <>
      <TextAreaField label="Qual o percentual de equity detido pelos fundadores e outros acionistas?" value={form.equityBreakdown} onChange={(v) => update("equityBreakdown", v)} placeholder="Ex: Fundador A - 50%, Fundador B - 30%, Investidor - 20%" required={opt} />
      <YesNoField label="Algum dos founders já possui CNPJ ou outra empresa constituída?" value={form.hasCNPJ} onChange={(v) => update("hasCNPJ", v)} id="cnpj" required={opt} />
      <YesNoField label="Já receberam algum investimento externo ou estão captando no momento?" value={form.externalInvestment} onChange={(v) => update("externalInvestment", v)} id="investment" required={opt} />
      <YesNoField label="Existe dependência de terceiros não-sócios para a tecnologia core?" value={form.thirdPartyDep} onChange={(v) => update("thirdPartyDep", v)} id="third-party" required={opt} />
    </>
  );
};

export default StepEquity;
