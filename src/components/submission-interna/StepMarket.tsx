import { TextAreaField, YesNoField } from "@/components/submission/FormField";

interface Props {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
  isSimplified?: boolean;
}

const StepMarket = ({ form, update, isSimplified = false }: Props) => {
  const opt = !isSimplified;
  return (
    <>
      <TextAreaField label="Por que você escolheu desenvolver essa ideia? Como você sabe que as pessoas precisam do que você está criando?" value={form.whyThisIdea} onChange={(v) => update("whyThisIdea", v)} required={opt} />
      <TextAreaField label="Qual dor latente esta solução resolve? Existem evidências ou dados que comprovam essa dor?" value={form.painPoint} onChange={(v) => update("painPoint", v)} required={opt} />
      <TextAreaField label="Responda: Para [Públicos/Clientes] que têm [Problema], nós oferecemos [Solução/Produto]." value={form.valueProposition} onChange={(v) => update("valueProposition", v)} required={opt} />
      <TextAreaField label="Por que somos os melhores para resolver isso? Temos tecnologia própria, dados exclusivos ou posição de mercado única?" value={form.whyUs} onChange={(v) => update("whyUs", v)} required={opt} />
      <TextAreaField label="Quem são os principais concorrentes e o que vocês entendem sobre o negócio que eles ainda não entenderam?" value={form.competitors} onChange={(v) => update("competitors", v)} required={opt} />
      <TextAreaField label="Qual o TAM, SAM e SOM aproximado?" value={form.marketSize} onChange={(v) => update("marketSize", v)} required={opt} />
      <TextAreaField label="O modelo permite crescimento de receita sem aumento proporcional de custos?" value={form.scalability} onChange={(v) => update("scalability", v)} required={opt} />
      <TextAreaField label="Possui acesso direto a canais de venda?" value={form.salesChannels} onChange={(v) => update("salesChannels", v)} required={opt} />
      <YesNoField label="Existe alguma barreira legal imediata?" value={form.regulatory} onChange={(v) => update("regulatory", v)} id="regulatory" required={opt} />
    </>
  );
};

export default StepMarket;
