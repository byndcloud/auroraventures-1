import { TextAreaField, YesNoField } from "./FormField";

interface Props {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
  isSimplified?: boolean;
}

const StepProgress = ({ form, update, isSimplified = false }: Props) => {
  const opt = !isSimplified;
  return (
    <>
      <TextAreaField label="Há quanto está se trabalhando no projeto? Quanto desse tempo foi em regime de tempo integral? " value={form.timeWorking} onChange={(v) => update("timeWorking", v)} required={opt} />
      <TextAreaField label="Qual o cash balance (caixa atual) e o burn rate mensal (queima de caixa)? Obs.: Caso a empresa não fature, aceitamos uma previsão." value={form.cashBurn} onChange={(v) => update("cashBurn", v)} placeholder="Descreva sua situação financeira atual..." required={opt} />
      <TextAreaField label="A empresa fez alguma projeção de faturamento? Se sim, compartilhe os principais números e premissas." value={form.revenueProjection} onChange={(v) => update("revenueProjection", v)} placeholder="Descreva suas projeções de receita..." required={opt} />
      <YesNoField label="A empresa já vende, mas falha na entrega/operação por carência de tecnologia?*" value={form.sellsButFails} onChange={(v) => update("sellsButFails", v)} id="sells-fails" required={opt} />
      <TextAreaField label="Que conjunto de tecnologias você está usando, ou planeja usar, para construir este produto? Inclua os modelos de IA e as ferramentas de programação de IA que você utiliza." value={form.techStack} onChange={(v) => update("techStack", v)} placeholder="GPT-4, LangChain, React, etc." required={opt} />
      <YesNoField label="É possível reduzir custos de desenvolvimento ou CAC utilizando a expertise do Extreme Group?" value={form.reduceCosts} onChange={(v) => update("reduceCosts", v)} id="reduce-costs" required={opt} />
      <TextAreaField label="É possível testar uma versão funcional (MVP) em no máximo 4 semanas? Por favor, explique." value={form.mvp4weeks} onChange={(v) => update("mvp4weeks", v)} placeholder="Explique sua perspectiva..." required={opt} />
    </>
  );
};

export default StepProgress;
