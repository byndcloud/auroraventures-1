import { TextAreaField, YesNoField } from "@/components/submission/FormField";

interface Props {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
  isSimplified?: boolean;
}

const StepProgress = ({ form, update, isSimplified = false }: Props) => {
  const opt = !isSimplified;
  return (
    <>
      <TextAreaField label="Há quanto tempo cada um está trabalhando nisso? Por favor, explique." value={form.timeWorking} onChange={(v) => update("timeWorking", v)} required={opt} />
      <TextAreaField label="Qual o cash balance (caixa atual) e o burn rate mensal (queima de caixa)? Obs.: Caso a empresa não fature, aceitamos uma previsão." value={form.cashBurn} onChange={(v) => update("cashBurn", v)} placeholder="Descreva sua situação financeira atual..." required={opt} />
      <TextAreaField label="A empresa fez alguma projeção de faturamento? Se sim, compartilhe os principais números e premissas." value={form.revenueProjection} onChange={(v) => update("revenueProjection", v)} placeholder="Descreva suas projeções de receita..." required={opt} />
      <TextAreaField label="Que conjunto de tecnologias você está usando, ou planeja usar, para construir este produto? Inclua os modelos de IA e as ferramentas de programação de IA que você utiliza." value={form.techStack} onChange={(v) => update("techStack", v)} placeholder="GPT-4, LangChain, React, etc." required={opt} />
      <YesNoField label="É possível reduzir custos de desenvolvimento ou CAC utilizando a infra de IA e automação da Beyond?" value={form.reduceCosts} onChange={(v) => update("reduceCosts", v)} id="reduce-costs" required={opt} />
      <TextAreaField label="É possível testar uma versão funcional (MVP) em no máximo 4 semanas? Por favor, explique." value={form.mvp4weeks} onChange={(v) => update("mvp4weeks", v)} required={opt} />
    </>
  );
};

export default StepProgress;
