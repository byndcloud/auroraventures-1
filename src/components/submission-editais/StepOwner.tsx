import { Field } from "@/components/submission/FormField";

interface Props {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
  isSimplified?: boolean;
}

const StepOwner = ({ form, update, isSimplified = false }: Props) => {
  const opt = !isSimplified;
  return (
    <>
      <Field label="Nome completo" value={form.ownerName} onChange={(v) => update("ownerName", v)} required={true} />
      <Field label="Telefone" value={form.ownerPhone} onChange={(v) => update("ownerPhone", v)} placeholder="+55 (11) 99999-9999" required={opt} />
      <Field label="Email" type="email" value={form.ownerEmail} onChange={(v) => update("ownerEmail", v)} required={opt} />
    </>
  );
};

export default StepOwner;
