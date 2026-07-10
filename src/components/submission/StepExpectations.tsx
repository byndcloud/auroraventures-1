import { TextAreaField } from "./FormField";

interface Props {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
  isSimplified?: boolean;
}

const StepExpectations = ({ form, update, isSimplified = false }: Props) => {
  const opt = !isSimplified;
  return (
    <>
      <TextAreaField label="O que o convenceu a aplicar para o modelo de Venture Builder da Beyond?" value={form.whyApply} onChange={(v) => update("whyApply", v)} minH="120px" required={opt} />
      <TextAreaField label="Em quais áreas você espera receber mais ajuda? (Ex: Vendas, Desenvolvimento de Software, Jurídico, Contatos B2G)" value={form.expectations} onChange={(v) => update("expectations", v)} placeholder="Vendas, Desenvolvimento de Software, Jurídico, Contatos B2G..." minH="120px" required={opt} />
    </>
  );
};

export default StepExpectations;
