import { TextAreaField } from "@/components/submission/FormField";

interface Props {
  form: Record<string, string>;
  update: (key: string, value: string) => void;
  isSimplified?: boolean;
}

const StepExecucao = ({ form, update, isSimplified = false }: Props) => {
  const opt = !isSimplified;
  return (
    <>
      <TextAreaField label="Quais tecnologias (ex: módulos do Legis, IAs, integrações) que já possuímos internamente podem ser reutilizadas para acelerar a entrega deste projeto?" value={form.infraReuse} onChange={(v) => update("infraReuse", v)} required={opt} />
      <TextAreaField label="É possível utilizarmos ferramentas de Vibe Coding e IA para rodar um teste ou entregar um MVP funcional dentro de 1 a 4 semanas, reduzindo o tempo de pesquisa?" value={form.vibeCoding} onChange={(v) => update("vibeCoding", v)} required={opt} />
      <TextAreaField label="Quem será a pessoa ou área responsável por capitanear as reuniões com o time técnico, desenhar os requisitos V0 e garantir a submissão?" value={form.responsible} onChange={(v) => update("responsible", v)} required={opt} />
    </>
  );
};

export default StepExecucao;
