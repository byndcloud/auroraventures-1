import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AuroraLogo } from "@/components/AuroraLogo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, ArrowRight, Send, User, FileText, ShieldCheck, Lightbulb, DollarSign, Rocket, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import StepOwner from "@/components/submission-editais/StepOwner";
import StepInfoBasicas from "@/components/submission-editais/StepInfoBasicas";
import StepElegibilidade from "@/components/submission-editais/StepElegibilidade";
import StepProblemaSolucao from "@/components/submission-editais/StepProblemaSolucao";
import StepViabilidade from "@/components/submission-editais/StepViabilidade";
import StepExecucao from "@/components/submission-editais/StepExecucao";

const steps = [
  { id: 0, label: "Owner", icon: User },
  { id: 1, label: "Info Básicas", icon: FileText },
  { id: 2, label: "Elegibilidade", icon: ShieldCheck },
  { id: 3, label: "Problema & Solução", icon: Lightbulb },
  { id: 4, label: "Viabilidade", icon: DollarSign },
  { id: 5, label: "Execução", icon: Rocket },
];

const requiredKeysMap: Record<number, string[]> = {
  0: ["ownerName", "ownerPhone", "ownerEmail"],
  1: ["editalName", "editalType", "editalLink", "submissionLink", "deadline", "maxValue", "counterpart"],
  2: ["intellectualProperty", "certifications", "costBenefit", "ictRequirement"],
  3: ["editalPain", "valueSentence", "thesisFit"],
  4: ["fundingCoverage", "scalability", "regulatoryBarrier"],
  5: ["infraReuse", "vibeCoding", "responsible"],
};

// Keys that remain required even in simplified mode
const simplifiedRequiredKeysMap: Record<number, string[]> = {
  0: ["ownerName"],
  1: ["editalName"],
};

const OLD_STORAGE_KEY = "aurora_draft_editais";

function loadDraft(key: string | null) {
  if (!key) return null;
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

// key null = usuário ainda não carregado → não persiste
function saveDraft(key: string | null, form: Record<string, string>) {
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify({ form })); } catch {}
}

const SubmissionEditais = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const isSimplified = searchParams.get("simplified") === "true" || profile?.role === "admin";
  const STORAGE_KEY = user?.id ? `aurora_draft_editais_${user.id}` : null;

  // One-shot migration: move shared legacy key to user-specific key
  if (STORAGE_KEY && !localStorage.getItem(STORAGE_KEY)) {
    const legacy = localStorage.getItem(OLD_STORAGE_KEY);
    if (legacy) { localStorage.setItem(STORAGE_KEY, legacy); localStorage.removeItem(OLD_STORAGE_KEY); }
  }

  const [step, setStep] = useState(0);
  const draft = loadDraft(STORAGE_KEY);
  const [form, setForm] = useState<Record<string, string>>(draft?.form || {});

  const update = (key: string, value: string) => {
    setForm((p) => {
      const next = { ...p, [key]: value };
      saveDraft(STORAGE_KEY, next);
      return next;
    });
  };

  const validateStep = (s: number): boolean => {
    const keys = isSimplified ? (simplifiedRequiredKeysMap[s] || []) : (requiredKeysMap[s] || []);
    for (const key of keys) {
      if (!form[key]?.trim()) {
        toast.error(isSimplified
          ? "O nome da iniciativa é obrigatório."
          : "Preencha todos os campos obrigatórios antes de avançar.");
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (!validateStep(step)) return;
    if (step < steps.length - 1) setStep(step + 1);
  };
  const prev = () => step > 0 && setStep(step - 1);

  const submit = async () => {
    if (!validateStep(step)) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Você precisa estar logado."); return; }
    const projectName = form.editalName || "Sem nome";

    const cleanedForm = isSimplified
      ? Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === "" ? null : v]))
      : form;

    const { error } = await supabase.from("submissions").insert({
      user_id: user.id,
      type: "editais",
      project_name: projectName,
      data: cleanedForm as any,
    });
    if (error) {
      toast.error("Erro ao enviar submissão", { description: error.message });
    } else {
      if (STORAGE_KEY) localStorage.removeItem(STORAGE_KEY);
      if (profile?.role === "admin" || isSimplified) {
        toast.success("✅ Iniciativa adicionada ao Kanban com sucesso!");
        navigate("/admin");
        return;
      }
      supabase.functions.invoke("send-confirmation-email", {
        body: { userEmail: user.email, userName: form.ownerName || "", projectName, submissionType: "editais" },
      }).catch(() => {});
      toast.success("Submissão enviada com sucesso!", { description: "Entraremos em contato em breve." });
      navigate("/dashboard-colaborador");
    }
  };

  const stepComponents = [
    <StepOwner form={form} update={update} isSimplified={isSimplified} />,
    <StepInfoBasicas form={form} update={update} isSimplified={isSimplified} />,
    <StepElegibilidade form={form} update={update} isSimplified={isSimplified} />,
    <StepProblemaSolucao form={form} update={update} isSimplified={isSimplified} />,
    <StepViabilidade form={form} update={update} isSimplified={isSimplified} />,
    <StepExecucao form={form} update={update} isSimplified={isSimplified} />,
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex w-72 border-r border-border bg-card/30 backdrop-blur-xl flex-col p-6">
        <AuroraLogo className="mb-10" />
        <nav className="flex-1 space-y-1">
          {steps.map((s) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all ${
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : done
                    ? "text-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </nav>
        <p className="text-xs text-muted-foreground mt-auto">
          Etapa {step + 1} de {steps.length}
        </p>
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
        <AuroraLogo className="text-lg" />
        <span className="text-xs text-muted-foreground">
          {steps[step].label} ({step + 1}/{steps.length})
        </span>
      </div>

      <main className="flex-1 flex items-start justify-center p-6 md:p-12 mt-14 md:mt-0 overflow-y-auto">
        <div className="w-full max-w-xl py-6">
          {isSimplified && (
            <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 mb-6">
              <Zap className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-primary">Modo simplificado ativo.</p>
                <p className="text-xs text-muted-foreground">Apenas o nome da iniciativa é obrigatório. Preencha os demais campos depois no card do Kanban.</p>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-2">{steps[step].label}</h2>
              {stepComponents[step]}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-10 pb-10">
            <Button variant="ghost" onClick={prev} disabled={step === 0} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Anterior
            </Button>
            {step < steps.length - 1 ? (
              <Button variant="cta" onClick={next} className="gap-2">
                Próximo <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="cta" onClick={submit} className="gap-2">
                <Send className="w-4 h-4" /> Enviar Submissão
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SubmissionEditais;
