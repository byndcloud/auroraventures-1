// TODO(monolith-split): quebrar este arquivo (≈880L) conforme §6.5 do BLUEPRINT
// em um componente por aba:
//   - InitiativeDataTab       (dados da iniciativa + edição)
//   - InitiativeScorecardTab  (scorecard render + comparação)
//   - InitiativeMeetingsTab   (reuniões + checkpoint)
//   - InitiativeOngoingTab    (vesting + progresso)
//   - InitiativeHistoryTab    (audit log)
//   - InitiativeCopilotPanel  (chat contextual)
// Rastreamento: docs/FOLLOWUPS.md · "Monolith split — IniciativaDetalhe".
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { type SubmissionOrigin } from "@/components/admin/common";
import { BLOCO1_FIELDS, BLOCO2_FIELDS, SCORECARD_META } from "@/components/admin/scorecard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Download, Calendar, User, ArrowRight, ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AuroraLogo } from "@/components/AuroraLogo";
import { SECTIONS_BY_ORIGIN, buildLabelMap, type FieldSection } from "@/lib/submission-field-labels";
import { ReadoutTab } from "@/components/admin/ReadoutTab";
import { OngoingViewerSection } from "@/components/admin/OngoingViewerSection";
import { VestingViewerSection } from "@/components/admin/VestingViewerSection";
import { VestingWeeklySection } from "@/components/admin/VestingWeeklySection";
import { InitiativeCopilot } from "@/components/admin/InitiativeCopilot";
import {
  StructuredMinutesView,
  type StructuredMinutes,
} from "@/components/admin/StructuredMinutesView";

// ── Tipo de uma reunião (espelha colunas relevantes de public.meetings) ──
interface MeetingRow {
  id: string;
  title: string;
  meeting_date: string;
  pre_agenda: string | null;
  transcript: string | null;
  smart_minutes: string | null;
  processing_status:
    | "pending"
    | "queued"
    | "processing"
    | "completed"
    | "failed"
    | null;
  error_message: string | null;
  minutes_structured: StructuredMinutes | null;
}

// ── Helper de badge de status (mesma lógica do MeetingsTab) ──
function getMeetingStatusBadge(meeting: MeetingRow) {
  if (
    meeting.processing_status === "queued" ||
    meeting.processing_status === "processing"
  ) {
    return {
      label: "🤖 Processando",
      className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    };
  }
  if (meeting.processing_status === "failed") {
    return {
      label: "Falhou",
      className: "bg-destructive/20 text-destructive border-destructive/30",
    };
  }
  if (meeting.minutes_structured || meeting.smart_minutes) {
    return {
      label: "Ata gerada",
      className: "bg-accent/20 text-accent border-accent/30",
    };
  }
  if (new Date(meeting.meeting_date) > new Date()) {
    return {
      label: "Agendada",
      className: "bg-primary/20 text-primary border-primary/30",
    };
  }
  return {
    label: "Pendente de Ata",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  };
}

const ALL_SECTIONS = [
  "briefing",
  "dados",
  "scorecard",
  "readout",
  "reunioes",
  "ongoing",
  "historico",
] as const;
type Section = (typeof ALL_SECTIONS)[number];

const SECTION_LABELS: Record<string, string> = {
  briefing: "Pasta do drive",
  dados: "Dados",
  scorecard: "Scorecard",
  readout: "Report",
  reunioes: "Reuniões",
  ongoing: "Ongoing",
  historico: "Histórico",
};

// Determina quais seções aparecem com base no status atual da iniciativa.
// "Ongoing" só aparece quando a iniciativa está nas fases Ongoing ou Handover.
function resolveSections(status: string | null | undefined): readonly Section[] {
  if (status === "Ongoing" || status === "Handover") return ALL_SECTIONS;
  return ALL_SECTIONS.filter((s) => s !== "ongoing");
}

export default function IniciativaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const canEdit = profile?.role === "admin" || profile?.role === "colaborador";

  // ── Queries ────────────────────────────────────────────────
  const { data: submission, isLoading } = useQuery({
    queryKey: ["iniciativa", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: scorecard } = useQuery({
    queryKey: ["iniciativa-score", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("evaluations")
        .select("*")
        .eq("submission_id", id!)
        .eq("processing_status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["iniciativa-meetings", id],
    queryFn: async () => {
      // Apenas reuniões anteriores ao fechamento da parceria (category='general').
      // As reuniões da fase Ongoing (category='ongoing') aparecem só na seção
      // "Ongoing" (OngoingViewerSection), não aqui.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fromMeetings = supabase.from("meetings") as any;
      const { data } = await fromMeetings
        .select("*")
        .eq("submission_id", id!)
        .eq("category", "general")
        .order("meeting_date", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["iniciativa-history", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("submission_history")
        .select("*")
        .eq("submission_id", id!)
        .order("moved_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  // ── Briefing (read-only on this page; edited from Kanban panel) ──
  const [briefing, setBriefing] = useState("");

  useEffect(() => {
    if (submission?.briefing) setBriefing(submission.briefing as string);
  }, [submission?.briefing]);

  // ── Active section via IntersectionObserver ────────────────
  const [activeSection, setActiveSection] = useState<string>("dados");

  useEffect(() => {
    if (!submission) return;
    const observers = resolveSections(submission.status).map((sec) => {
      const el = document.getElementById(sec);
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(sec);
        },
        { rootMargin: "-40% 0px -55% 0px" }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach((o) => o?.disconnect());
  }, [submission]);

  // ── Export PDF via window.print() ────────────────────────────
  // Solução interim (ADR-0002): usamos `window.print()` + CSS `@media print`
  // em vez de rasterizar via html2canvas-pro + jspdf. Motivos:
  //   - Bundle 400+ KB menor
  //   - Sem loop de rasterização (dark theme complex color-mix quebrava)
  //   - Fidelidade nativa do browser (fontes, seleção de texto, hyperlinks)
  // Migração futura para Puppeteer/Browserless via Edge Function fica em
  // docs/FOLLOWUPS.md.
  const handleExportPDF = () => {
    if (typeof window === "undefined") return;
    window.print();
  };

  // ── Loading / Not Found ────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen hero-gradient flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">
          Acesso negado ou iniciativa não encontrada.
        </h1>
        <p className="text-muted-foreground text-sm">
          Esta página é restrita a @beyondcompany.com.br e @extreme.digital
        </p>
        <Link to="/">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
        </Link>
      </div>
    );
  }

  const submissionData = (typeof submission.data === "object" && submission.data !== null
    ? submission.data
    : {}) as Record<string, any>;

  return (
    <div id="iniciativa-root" className="min-h-screen hero-gradient">
      {/* ── Top bar ────────────────────────────────────────── */}
      <header className="print:hidden h-14 border-b border-border/50 flex items-center px-6 gap-4 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <Link
          to="/admin"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <AuroraLogo as="span" className="text-lg" />
        <div className="ml-auto flex items-center gap-3">
          <Badge
            variant="outline"
            className="border-primary/40 text-primary text-xs"
          >
            {submission.status}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="gap-1.5 border-border/50"
            title="Abre o diálogo de impressão do navegador — escolha 'Salvar como PDF'"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar PDF
          </Button>
        </div>
      </header>

      {/* ── Nav de âncoras (sticky) ─────────────────────────── */}
      <nav className="print:hidden sticky top-14 z-40 bg-card/20 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-5xl mx-auto flex overflow-x-auto scrollbar-hide">
          {resolveSections(submission?.status).map((sec) => (
            <button
              key={sec}
              onClick={() =>
                document.getElementById(sec)?.scrollIntoView({ behavior: "smooth" })
              }
              className={`px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeSection === sec
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {SECTION_LABELS[sec]}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Hero da iniciativa ──────────────────────────────── */}
      <div className="pdf-hero max-w-5xl mx-auto px-6 pt-10 pb-6">
        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold gradient-text leading-tight">
            {submission.project_name || "Iniciativa sem nome"}
          </h1>
          {submissionData.nome_founder && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <User className="w-4 h-4" />
              <span>
                {submissionData.nome_founder}
                {submissionData.email_founder && ` · ${submissionData.email_founder}`}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Calendar className="w-4 h-4" />
            Submetido em{" "}
            {format(new Date(submission.created_at), "dd 'de' MMMM 'de' yyyy", {
              locale: ptBR,
            })}
          </div>
          {(submission as any).due_date && (() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const due = new Date((submission as any).due_date);
            const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            let color = "text-accent";
            let label = due.toLocaleDateString("pt-BR");
            if (diffDays < 0) { color = "text-destructive"; label = `Vencido há ${Math.abs(diffDays)}d`; }
            else if (diffDays === 0) { color = "text-destructive"; label = "Vence hoje"; }
            else if (diffDays <= 7) { color = "text-yellow-400"; label = `Vence em ${diffDays}d`; }
            return (
              <div className={`flex items-center gap-2 text-sm ${color}`}>
                <Calendar className="w-4 h-4" />
                Vencimento: {label}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Sections ──────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 pb-20 space-y-12">
        {/* ── PASTA DO DRIVE ─────────────────────────────────── */}
        <section id="briefing" className="pdf-section">
          <div className="mb-2">
            <h2 className="text-xl font-bold text-foreground">
              Pasta do drive
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {canEdit
                ? "Edite este link no painel do card no Kanban."
                : "Documento interno - somente leitura."}
            </p>
          </div>

          <div className="glass-card rounded-xl p-6">
            {briefing ? (
              <a
                href={briefing}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline break-all"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                {briefing}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Nenhuma pasta do drive vinculada ainda.
              </p>
            )}
          </div>
        </section>

        <Separator className="border-border/30" />

        {/* ── DADOS ──────────────────────────────────────────── */}
        <section id="dados" className="pdf-section">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">Dados da Submissão</h2>
          </div>
          {(() => {
            const origin = submission.type as string;
            const fieldSections = SECTIONS_BY_ORIGIN[origin];
            const labelMap = buildLabelMap(origin);

            if (fieldSections) {
              // Structured view: show fields grouped by form sections
              // Handle founders array specially
              const founders = submissionData.founders as any[] | undefined;
              const flatData = { ...submissionData };

              return (
                <div className="space-y-8">
                  {fieldSections.map((sec: FieldSection) => {
                    // For founder sections, render each founder separately
                    if (sec.title === "Founders" && founders && founders.length > 0) {
                      return (
                        <div key={sec.title} className="space-y-4">
                          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-border/30 pb-2">
                            {sec.title}
                          </h3>
                          {founders.map((founder: any, fi: number) => (
                            <div key={fi} className="space-y-3">
                              <p className="text-xs font-semibold text-muted-foreground">
                                Founder {fi + 1}: {founder.name || "-"}
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {sec.fields.map((f) => {
                                  const val = founder[f.key];
                                  if (val === null || val === undefined || val === "") return null;
                                  return (
                                    <div key={f.key} className="glass-card rounded-xl p-4 space-y-1">
                                      <span className="text-xs font-semibold text-primary leading-snug">
                                        {f.label}
                                      </span>
                                      <p className="text-sm text-foreground leading-relaxed">
                                        {String(val)}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    // Regular sections
                    const fieldsWithValues = sec.fields.filter((f) => {
                      const val = flatData[f.key];
                      return val !== null && val !== undefined && val !== "";
                    });

                    if (fieldsWithValues.length === 0) return null;

                    return (
                      <div key={sec.title} className="space-y-4">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-border/30 pb-2">
                          {sec.title}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {fieldsWithValues.map((f) => {
                            const val = flatData[f.key];
                            return (
                              <div key={f.key} className="glass-card rounded-xl p-4 space-y-1">
                                <span className="text-xs font-semibold text-primary leading-snug">
                                  {f.label}
                                </span>
                                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                  {typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Remaining keys not in the structured map */}
                  {(() => {
                    const allMappedKeys = new Set(fieldSections.flatMap((s: FieldSection) => s.fields.map((f) => f.key)));
                    allMappedKeys.add("founders");
                    const remaining = Object.entries(flatData).filter(
                      ([k, v]) => !allMappedKeys.has(k) && v !== null && v !== undefined && v !== ""
                    );
                    if (remaining.length === 0) return null;
                    return (
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-border/30 pb-2">
                          Outros
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {remaining.map(([key, value]) => (
                            <div key={key} className="glass-card rounded-xl p-4 space-y-1">
                              <span className="text-xs font-semibold text-primary leading-snug">
                                {labelMap[key] || key.replace(/_/g, " ")}
                              </span>
                              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            }

            // Fallback: no structured mapping, show all keys with label map
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(submissionData)
                  .filter(([, v]) => v !== null && v !== undefined && v !== "")
                  .map(([key, value]) => (
                    <div key={key} className="glass-card rounded-xl p-4 space-y-1">
                      <span className="text-xs font-semibold text-primary leading-snug">
                        {labelMap[key] || key.replace(/_/g, " ")}
                      </span>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                      </p>
                    </div>
                  ))}
              </div>
            );
          })()}
        </section>

        <Separator className="border-border/30" />

        {/* ── SCORECARD ──────────────────────────────────────── */}
        <section id="scorecard" className="pdf-section">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Scorecard</h2>
            {scorecard?.final_score != null && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs text-muted-foreground">Nota Final</span>
                <span
                  className={`text-2xl font-bold ${
                    Number(scorecard.final_score) >= 80
                      ? "text-accent"
                      : Number(scorecard.final_score) >= 60
                        ? "text-primary"
                        : "text-destructive"
                  }`}
                >
                  {Number(scorecard.final_score).toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            )}
          </div>

          {scorecard ? (
            <div className="space-y-4">
              {scorecard.verdict && (
                <Badge
                  variant="outline"
                  className={`text-sm px-3 py-1 ${
                    scorecard.verdict === "Aprovar"
                      ? "badge-accelerate"
                      : scorecard.verdict === "Amadurecer"
                        ? "badge-mature"
                        : "badge-kill"
                  }`}
                >
                  Veredicto: {scorecard.verdict}
                </Badge>
              )}
              {(() => {
                const scoresMap = scorecard.scores as Record<string, number | boolean>;
                const origin = (submission?.type || "mercado") as SubmissionOrigin;
                const bloco2 = BLOCO2_FIELDS[origin] || BLOCO2_FIELDS.mercado;

                const renderField = (f: { key: string; label: string; weight: number; isVeto?: boolean }) => {
                  const val = scoresMap[f.key];
                  if (typeof val !== "number") return null;
                  const meta = SCORECARD_META[f.key];
                  const hasVeto = !!scoresMap[`veto_${f.key}`];
                  return (
                    <div key={f.key} className={`glass-card rounded-lg p-3 space-y-1 ${hasVeto ? "border-destructive/40 bg-destructive/5" : ""}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{f.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{f.weight}%</span>
                          <span className={`text-xs font-bold min-w-[28px] text-right ${
                            val >= 80 ? "text-accent" : val >= 60 ? "text-primary" : "text-destructive"
                          }`}>{val}</span>
                        </div>
                      </div>
                      {meta && (
                        <p className="text-[11px] text-muted-foreground leading-snug">{meta.pergunta}</p>
                      )}
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            val >= 80 ? "bg-accent" : val >= 60 ? "bg-primary" : "bg-destructive"
                          }`}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                      {hasVeto && (
                        <span className="text-[10px] font-bold text-destructive">⚠ VETO ATIVADO</span>
                      )}
                    </div>
                  );
                };

                return (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-primary mb-1">Bloco 1 - Negócio & Produto</h3>
                      <p className="text-xs text-muted-foreground mb-3">Peso: 60%</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {BLOCO1_FIELDS.map(renderField)}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-accent mb-1">
                        Bloco 2 - {origin === "mercado" ? "Mercado & Founders" : origin === "interna" ? "Interno" : "Editais"}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">Peso: 40%</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {bloco2.map(renderField)}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="glass-card rounded-xl p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Scorecard ainda não preenchido para esta iniciativa.
              </p>
            </div>
          )}
        </section>

        <Separator className="border-border/30" />

        {/* ── READOUT ────────────────────────────────────────── */}
        <section id="readout" className="pdf-section">
          <h2 className="text-xl font-bold text-foreground mb-6">Report</h2>
          <ReadoutTab submissionId={submission.id} readOnly />
        </section>

        <Separator className="border-border/30" />

        {/* ── REUNIÕES ───────────────────────────────────────── */}
        <section id="reunioes" className="pdf-section">
          <h2 className="text-xl font-bold text-foreground mb-6">Reuniões</h2>
          <Accordion type="multiple" defaultValue={["pre-fechamento"]} className="space-y-3">
          <AccordionItem
            value="pre-fechamento"
            className="glass-card rounded-xl border-border/50 overflow-hidden px-5"
          >
          <AccordionTrigger className="hover:no-underline py-4">
            <span className="text-sm font-semibold">
              Reuniões antes do fechamento da parceria
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-5">
          {meetings.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma reunião registrada.
              </p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-3">
              {meetings.map((raw: unknown) => {
                const meeting = raw as MeetingRow;
                const status = getMeetingStatusBadge(meeting);
                return (
                  <AccordionItem
                    key={meeting.id}
                    value={meeting.id}
                    className="glass-card rounded-xl border-border/50 overflow-hidden"
                  >
                    <AccordionTrigger className="px-5 py-4 hover:no-underline">
                      <div className="flex items-center gap-3 text-left w-full">
                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {meeting.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(
                              new Date(meeting.meeting_date),
                              "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                              { locale: ptBR }
                            )}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`ml-auto text-xs ${status.className}`}
                        >
                          {status.label}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5 pb-5 space-y-4">
                      {/* Link externo (fluxo manual) */}
                      {meeting.pre_agenda && (
                        <div>
                          <h4 className="text-xs font-semibold text-primary uppercase mb-2">
                            Link da Ata
                          </h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {meeting.pre_agenda}
                          </p>
                        </div>
                      )}

                      {/* Status de processamento Volund */}
                      {(meeting.processing_status === "queued" ||
                        meeting.processing_status === "processing") && (
                        <div className="flex items-center gap-3 py-3 px-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                          <p className="text-sm text-blue-400">
                            Aguardando o agente Volund OS gerar a ata estruturada…
                          </p>
                        </div>
                      )}
                      {meeting.processing_status === "failed" && (
                        <div className="py-3 px-3 rounded-lg bg-destructive/10 border border-destructive/30">
                          <p className="text-sm text-destructive font-semibold mb-1">
                            Falha no processamento
                          </p>
                          {meeting.error_message && (
                            <p className="text-xs text-destructive/80">
                              {meeting.error_message}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Ata estruturada (Volund) — prioritária */}
                      {meeting.minutes_structured && (
                        <StructuredMinutesView minutes={meeting.minutes_structured} />
                      )}

                      {/* Ata markdown (fluxo manual antigo) — só se não houver estruturada */}
                      {meeting.smart_minutes && !meeting.minutes_structured && (
                        <div>
                          <h4 className="text-xs font-semibold text-primary uppercase mb-2">
                            Ata da Reunião
                          </h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {meeting.smart_minutes}
                          </p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
          </AccordionContent>
          </AccordionItem>

          {/* Reuniões de checkpoint (semanas da fase pós-fechamento) */}
          <AccordionItem
            value="checkpoint"
            className="glass-card rounded-xl border-border/50 overflow-hidden px-5"
          >
          <AccordionTrigger className="hover:no-underline py-4">
            <span className="text-sm font-semibold">Reuniões de checkpoint</span>
          </AccordionTrigger>
          <AccordionContent className="pb-5">
            <OngoingViewerSection submissionId={id!} />
          </AccordionContent>
          </AccordionItem>
          </Accordion>
        </section>

        <Separator className="border-border/30" />

        {/* ── ONGOING — dashboard de indicadores (só Ongoing/Handover) ──── */}
        {(submission?.status === "Ongoing" || submission?.status === "Handover") && (
          <>
            <section id="ongoing" className="pdf-section space-y-6">
              <h2 className="text-xl font-bold text-foreground mb-6">Ongoing</h2>
              <VestingViewerSection submissionId={id!} />
              <VestingWeeklySection submissionId={id!} readOnly />
            </section>
            <Separator className="border-border/30" />
          </>
        )}

        {/* ── HISTÓRICO ──────────────────────────────────────── */}
        <section id="historico" className="pdf-section">
          <h2 className="text-xl font-bold text-foreground mb-6">Histórico</h2>
          {history.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma movimentação registrada.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6">
              <div className="absolute left-2.5 top-1 bottom-1 w-px bg-border/50" />
              {history.map((event: any, i: number) => (
                <div key={event.id || i} className="relative">
                  <div className="absolute -left-[13px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                  <div className="glass-card rounded-lg p-4 ml-2 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {event.from_status && (
                        <>
                          <Badge
                            variant="outline"
                            className="text-xs border-border/50"
                          >
                            {event.from_status}
                          </Badge>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        </>
                      )}
                      <Badge
                        variant="outline"
                        className="text-xs border-primary/40 text-primary"
                      >
                        {event.to_status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(
                        new Date(event.moved_at),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR }
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Co-Pilot flutuante (admin + colaborador) */}
      {submission && id && (
        <InitiativeCopilot
          submissionId={id}
          initiativeName={submission.project_name as string | undefined}
        />
      )}
    </div>
  );
}
