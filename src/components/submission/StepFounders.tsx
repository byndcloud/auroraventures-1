import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Field, TextAreaField, YesNoField, SectionTitle } from "./FormField";
import { Plus, Trash2, UserCircle } from "lucide-react";
import type { FounderData } from "@/pages/Submission";

interface Props {
  founders: FounderData[];
  activeFounder: number;
  setActiveFounder: (i: number) => void;
  updateFounder: (index: number, key: string, value: string) => void;
  addFounder: () => void;
  removeFounder: (index: number) => void;
  isSimplified?: boolean;
}

const GENDER_OPTIONS = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "nao-binario", label: "Não-binário" },
  { value: "prefiro-nao-dizer", label: "Prefiro não dizer" },
];

const StepFounders = ({ founders, activeFounder, setActiveFounder, updateFounder, addFounder, removeFounder, isSimplified = false }: Props) => {
  const f = founders[activeFounder];
  const upd = (key: string, value: string) => updateFounder(activeFounder, key, value);
  const opt = !isSimplified;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {founders.map((founder, i) => (
          <button
            key={i}
            onClick={() => setActiveFounder(i)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all border ${
              activeFounder === i
                ? "bg-primary/10 border-primary text-primary font-semibold"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <UserCircle className="w-4 h-4" />
            {founder.name || `Founder ${i + 1}`}
          </button>
        ))}
        <Button variant="outline" size="sm" onClick={addFounder} className="gap-1">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </Button>
      </div>

      {founders.length > 1 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeFounder(activeFounder)}
            className="text-destructive hover:text-destructive gap-1 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remover {f?.name || `Founder ${activeFounder + 1}`}
          </Button>
        </div>
      )}

      <SectionTitle>Básico</SectionTitle>
      <Field label="Nome completo" value={f?.name} onChange={(v) => upd("name", v)} required={true} />
      <Field label="Telefone" value={f?.phone} onChange={(v) => upd("phone", v)} placeholder="+55 (11) 99999-9999" required={opt} />
      <Field label="Email" type="email" value={f?.email} onChange={(v) => upd("email", v)} required={opt} />
      <div className="space-y-3">
        <Label className="text-foreground">
          Gênero
          {opt
            ? <span className="text-destructive ml-1">*</span>
            : <span className="text-muted-foreground ml-1 text-xs">(opcional)</span>
          }
        </Label>
        <RadioGroup value={f?.gender || ""} onValueChange={(v) => upd("gender", v)} className="flex flex-wrap gap-3">
          {GENDER_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                f?.gender === opt.value
                  ? "bg-primary/10 border-primary text-primary font-medium"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <RadioGroupItem value={opt.value} className="sr-only" />
              {opt.label}
            </label>
          ))}
        </RadioGroup>
      </div>
      <Field label="Data de nascimento" type="date" value={f?.birthdate} onChange={(v) => upd("birthdate", v)} required={opt} />
      <Field label="Cidade que vive" value={f?.city} onChange={(v) => upd("city", v)} required={opt} />
      <Field label="Redes sociais" value={f?.socialMedia} onChange={(v) => upd("socialMedia", v)} placeholder="Instagram, Twitter, etc." required={opt} />

      <SectionTitle>Background e Trajetória</SectionTitle>
      <Field label="Educação" value={f?.education} onChange={(v) => upd("education", v)} placeholder="Formação acadêmica" required={opt} />
      <TextAreaField label="Histórico de trabalho" value={f?.workHistory} onChange={(v) => upd("workHistory", v)} placeholder="Descreva suas experiências profissionais relevantes..." required={opt} />
      <Field label="LinkedIn" value={f?.linkedin} onChange={(v) => upd("linkedin", v)} placeholder="https://linkedin.com/in/..." required={opt} />
      <TextAreaField label="Quais conquistas o fundador se orgulha de ter alcançado?" value={f?.achievements} onChange={(v) => upd("achievements", v)} required={opt} />
      <TextAreaField label="Conte-nos sobre projetos que você já desenvolveu. Por exemplo, aplicativos, sites ou contribuições para projetos de código aberto. Inclua URLs, se possível." value={f?.projects} onChange={(v) => upd("projects", v)} required={opt} />

      <SectionTitle>Responsabilidades e Atuação</SectionTitle>
      <Field label="Qual é o seu título? (CEO, CTO, Vendas, etc.)" value={f?.title} onChange={(v) => upd("title", v)} placeholder="Ex: CEO" required={opt} />
      <Field label="Quanto de equity você tem? (%)" type="number" value={f?.founderEquity} onChange={(v) => upd("founderEquity", v)} placeholder="50" required={opt} />
      <Field label="Qual a disponibilidade real (horas/semana) para se dedicar ao projeto?" type="number" value={f?.hours} onChange={(v) => upd("hours", v)} placeholder="40" required={opt} />
      <YesNoField label="Você é um founder técnico? (desenvolvedor)" value={f?.technical} onChange={(v) => upd("technical", v)} id={`tech-${activeFounder}`} required={opt} />
      <YesNoField label="Você está atualmente na faculdade?" value={f?.inCollege} onChange={(v) => upd("inCollege", v)} id={`college-${activeFounder}`} required={opt} />
      <Field label="Envio de apresentação em vídeo de até 1 minuto do founder (URL)" value={f?.founderVideo} onChange={(v) => upd("founderVideo", v)} placeholder="https://..." required={opt} />

      <SectionTitle>Perfil e Dinâmica de Time</SectionTitle>
      <TextAreaField label="Quem escreve o código ou faz o trabalho técnico?" value={f?.techPerson} onChange={(v) => upd("techPerson", v)} required={opt} />
      <TextAreaField label="Como o time de fundadores se conheceu?" value={f?.howMet} onChange={(v) => upd("howMet", v)} required={false} />
    </>
  );
};

export default StepFounders;
