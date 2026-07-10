import { TextAreaField } from "@/components/submission/FormField";

interface Props {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
  isSimplified?: boolean;
}

const StepViabilidade = ({ form, update, isSimplified = false }: Props) => {
  const opt = !isSimplified;
  return (
    <>
      <TextAreaField label="O valor do fomento cobre integralmente o desenvolvimento da solução? O dinheiro é liberado em um tempo compatível com a nossa necessidade de experimentação ágil?" value={form.fundingCoverage} onChange={(v) => update("fundingCoverage", v)} required={opt} />
      <TextAreaField label="Após entregarmos o projeto para o edital, esta solução pode ser vendida de forma escalável (como um SaaS) para outros clientes do setor público ou privado, sem que o custo aumente na mesma proporção?" value={form.scalability} onChange={(v) => update("scalability", v)} required={opt} />
      <TextAreaField label="Existe alguma barreira regulatória ou norma técnica complexa atrelada ao escopo deste edital que possa inviabilizar o negócio?" value={form.regulatoryBarrier} onChange={(v) => update("regulatoryBarrier", v)} required={opt} />
    </>
  );
};

export default StepViabilidade;
