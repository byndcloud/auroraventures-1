import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Sparkles, Loader2, Skull, FileText, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SubmissionOrigin } from "./common";
import { ScorecardForm } from "./ScorecardForm";
import { useAuth } from "@/contexts/AuthContext";

interface EvaluationRow {
  id: string;
  submission_id: string;
  author_id: string;
  source: "ai" | "manual";
  final_score: number;
  has_veto: boolean;
  verdict: string;
  processing_status: "pending" | "processing" | "completed" | "failed";
  error_message: string | null;
  report: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
  // Join opcional
  author?: { full_name: string | null } | null;
}

interface EvaluationsTabProps {
  submissionId: string;
  origin: SubmissionOrigin;
  onSaved: () => void;
}

export function EvaluationsTab({ submissionId, origin, onSaved }: EvaluationsTabProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // "new" = formulário de nova manual ainda não persistida
  const [creatingNew, setCreatingNew] = useState(false);
  const [reportOpen, setReportOpen] = useState(true);
  const [triggeringAI, setTriggeringAI] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data: evaluations = [], isLoading } = useQuery<EvaluationRow[]>({
    queryKey: ["evaluations", submissionId],
    queryFn: async () => {
      // Sem FK declarada entre evaluations.author_id e profiles, então buscamos
      // as evaluations e enriquecemos com profiles em uma segunda query.
      const { data, error } = await supabase
        .from("evaluations")
        .select(
          "id, submission_id, author_id, source, final_score, has_veto, verdict, processing_status, error_message, report, summary, created_at, updated_at",
        )
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as Omit<EvaluationRow, "author">[];
      const authorIds = Array.from(new Set(rows.map((r) => r.author_id).filter(Boolean)));
      const authorMap: Record<string, { full_name: string | null }> = {};
      if (authorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", authorIds);
        for (const p of profs ?? []) {
          authorMap[p.user_id] = { full_name: p.full_name };
        }
      }
      return rows.map((r) => ({ ...r, author: authorMap[r.author_id] ?? null }));
    },
    enabled: !!submissionId,
    refetchInterval: (q) => {
      const rows = (q.state.data as EvaluationRow[] | undefined) ?? [];
      return rows.some((r) => r.processing_status === "processing") ? 4000 : false;
    },
  });

  // Seleciona automaticamente a mais recente completed quando a lista carrega.
  useEffect(() => {
    if (selectedId || creatingNew) return;
    const firstCompleted = evaluations.find((e) => e.processing_status === "completed");
    if (firstCompleted) setSelectedId(firstCompleted.id);
  }, [evaluations, selectedId, creatingNew]);

  const selected = useMemo(
    () => evaluations.find((e) => e.id === selectedId) ?? null,
    [evaluations, selectedId],
  );

  const handleEvaluateWithAI = async () => {
    setTriggeringAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("evaluate-with-ai", {
        body: { submissionId },
      });
      if (error) throw error;
      toast.success("Avaliação por IA iniciada", {
        description: "O agente está analisando a iniciativa. Isso costuma levar 30s a 2min.",
      });
      // Refetch imediato pra capturar o novo row em 'processing'
      qc.invalidateQueries({ queryKey: ["evaluations", submissionId] });
      if (data?.evaluationId) setSelectedId(data.evaluationId);
    } catch (err: any) {
      toast.error("Falha ao iniciar avaliação IA", {
        description: err.message ?? "Erro inesperado",
      });
    } finally {
      setTriggeringAI(false);
    }
  };

  const handleCreateNew = () => {
    setCreatingNew(true);
    setSelectedId(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    const { error } = await supabase.from("evaluations").delete().eq("id", id);
    setDeleteTargetId(null);
    if (error) {
      toast.error("Falha ao excluir", { description: error.message });
      return;
    }
    toast.success("Avaliação excluída");
    if (selectedId === id) setSelectedId(null);
    qc.invalidateQueries({ queryKey: ["evaluations", submissionId] });
    onSaved();
  };

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ["evaluations", submissionId] });
    setCreatingNew(false);
    onSaved();
  };

  const hasProcessing = evaluations.some((e) => e.processing_status === "processing");

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Avaliações</h3>
          <p className="text-xs text-muted-foreground">
            {evaluations.length === 0
              ? "Nenhuma avaliação ainda."
              : `${evaluations.length} avaliação${evaluations.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEvaluateWithAI}
              disabled={triggeringAI || hasProcessing}
              className="border-primary/50 gap-2"
            >
              {triggeringAI || hasProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-primary" />
              )}
              {hasProcessing ? "IA processando…" : "Avaliar com IA"}
            </Button>
          )}
          {isAdmin && (
            <Button variant="secondary" size="sm" onClick={handleCreateNew} className="gap-2">
              <Plus className="w-4 h-4" />
              Nova manual
            </Button>
          )}
        </div>
      </div>

      {/* Lista de avaliações */}
      {!isLoading && evaluations.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {evaluations.map((e) => (
            <EvaluationCard
              key={e.id}
              evaluation={e}
              selected={!creatingNew && selectedId === e.id}
              canDelete={isAdmin}
              onClick={() => {
                setCreatingNew(false);
                setSelectedId(e.id);
              }}
              onDelete={() => setDeleteTargetId(e.id)}
            />
          ))}
        </div>
      )}

      {/* Estado: criando nova manual */}
      {creatingNew && (
        <div className="glass-card p-4 border-accent/30">
          <p className="text-xs text-muted-foreground mb-3">
            Nova avaliação manual — salve para persistir.
          </p>
          <ScorecardForm
            key={`new-${submissionId}`}
            submissionId={submissionId}
            origin={origin}
            evaluationId={undefined}
            onSaved={handleSaved}
          />
        </div>
      )}

      {/* Estado: avaliação selecionada */}
      {!creatingNew && selected && selected.processing_status === "processing" && (
        <div className="glass-card p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          A IA está analisando a iniciativa. Esta página atualiza sozinha.
        </div>
      )}

      {!creatingNew && selected && selected.processing_status === "failed" && (
        <div className="glass-card p-4 border-destructive/30 text-sm">
          <p className="font-semibold text-destructive mb-1">Avaliação falhou</p>
          <p className="text-xs text-muted-foreground">
            {selected.error_message ?? "Erro desconhecido. Tente disparar novamente."}
          </p>
        </div>
      )}

      {!creatingNew && selected && selected.processing_status === "completed" && (
        <div className="space-y-4">
          {/* Resumo + relatório (apenas IA) */}
          {selected.source === "ai" && (selected.summary || selected.report) && (
            <div className="glass-card p-4 space-y-3">
              {selected.summary && (
                <div>
                  <p className="text-xs font-semibold text-primary mb-1">Resumo executivo</p>
                  <p className="text-sm leading-relaxed">{selected.summary}</p>
                </div>
              )}
              {selected.report && (
                <div className="pt-2 border-t border-border/30">
                  <button
                    type="button"
                    onClick={() => setReportOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Relatório completo (Aurora + Paul Graham)
                    {reportOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {reportOpen && (
                    <div className="mt-3 text-sm">
                      <MarkdownReport source={selected.report} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Formulário do scorecard pré-carregado com a avaliação selecionada */}
          <ScorecardForm
            key={`edit-${selected.id}`}
            submissionId={submissionId}
            origin={origin}
            evaluationId={selected.id}
            onSaved={handleSaved}
          />
        </div>
      )}

      {!isLoading && evaluations.length === 0 && !creatingNew && (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          Esta iniciativa ainda não tem avaliações. Clique em <strong>Avaliar com IA</strong> ou{" "}
          <strong>Nova manual</strong> para começar.
        </div>
      )}

      {/* Confirmação de exclusão (AlertDialog em vez de confirm() nativo) */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(o) => !o && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir avaliação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a avaliação permanentemente. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EvaluationCard({
  evaluation,
  selected,
  canDelete,
  onClick,
  onDelete,
}: {
  evaluation: EvaluationRow;
  selected: boolean;
  canDelete: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const date = new Date(evaluation.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
  const isAI = evaluation.source === "ai";
  const isProcessing = evaluation.processing_status === "processing";
  const isFailed = evaluation.processing_status === "failed";

  const authorLabel = isAI
    ? "IA Aurora"
    : evaluation.author?.full_name || "Manual";

  const scoreColor = evaluation.has_veto
    ? "text-destructive"
    : evaluation.final_score > 80
    ? "text-accent"
    : evaluation.final_score >= 60
    ? "text-yellow-400"
    : "text-destructive";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className={`glass-card p-3 text-left transition-all hover:border-primary/50 cursor-pointer relative ${
        selected ? "border-primary ring-1 ring-primary/30" : ""
      }`}
    >
      {canDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-2 right-2 p-1.5 rounded border border-destructive/30 bg-destructive/5 hover:bg-destructive/15 text-destructive transition"
          aria-label="Excluir avaliação"
          title="Excluir avaliação"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      <div className="flex items-center justify-between mb-1.5 pr-9">
        <Badge variant={isAI ? "default" : "secondary"} className="gap-1 text-[10px]">
          {isAI && <Sparkles className="w-2.5 h-2.5" />}
          {isAI ? "IA" : "Manual"}
        </Badge>
        <span className="text-[10px] text-muted-foreground">{date}</span>
      </div>
      <p className="text-xs font-medium truncate mb-1.5">{authorLabel}</p>
      {isProcessing ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processando…
        </div>
      ) : isFailed ? (
        <p className="text-xs text-destructive">Falhou</p>
      ) : (
        <div className="flex items-center justify-between">
          <span className={`text-2xl font-black ${scoreColor}`}>
            {evaluation.final_score.toFixed(1)}
          </span>
          <span className={`text-[10px] font-bold ${scoreColor}`}>
            {evaluation.has_veto && <Skull className="inline w-3 h-3 mr-0.5" />}
            {evaluation.verdict || "—"}
          </span>
        </div>
      )}
    </div>
  );
}

// Renderiza markdown leve do relatório IA: headings (##/###), bold, bullets,
// linhas em branco, separadores. Não tenta interpretar tabelas — quando
// detectadas, são exibidas em monospace para preservar o layout.
function MarkdownReport({ source }: { source: string }) {
  const blocks: JSX.Element[] = [];
  const lines = source.split("\n");
  let i = 0;
  let key = 0;
  let bulletBuf: string[] = [];
  let paraBuf: string[] = [];
  let tableBuf: string[] = [];

  const flushBullets = () => {
    if (bulletBuf.length === 0) return;
    blocks.push(
      <ul key={`l${key++}`} className="list-disc pl-5 space-y-1 my-2">
        {bulletBuf.map((b, idx) => (
          <li key={idx} className="leading-relaxed">
            {renderInline(b)}
          </li>
        ))}
      </ul>,
    );
    bulletBuf = [];
  };
  const flushPara = () => {
    if (paraBuf.length === 0) return;
    const joined = paraBuf.join(" ").trim();
    if (joined) {
      blocks.push(
        <p key={`p${key++}`} className="leading-relaxed my-2">
          {renderInline(joined)}
        </p>,
      );
    }
    paraBuf = [];
  };
  const flushTable = () => {
    if (tableBuf.length === 0) return;
    blocks.push(
      <pre
        key={`t${key++}`}
        className="text-[11px] font-mono bg-secondary/40 p-2 rounded my-2 overflow-x-auto"
      >
        {tableBuf.join("\n")}
      </pre>,
    );
    tableBuf = [];
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (line.startsWith("|")) {
      flushBullets();
      flushPara();
      tableBuf.push(line);
      i++;
      continue;
    } else {
      flushTable();
    }

    if (line.startsWith("### ")) {
      flushBullets();
      flushPara();
      blocks.push(
        <h4 key={`h${key++}`} className="text-sm font-semibold text-primary mt-4 mb-1">
          {line.slice(4)}
        </h4>,
      );
    } else if (line.startsWith("## ")) {
      flushBullets();
      flushPara();
      blocks.push(
        <h3 key={`h${key++}`} className="text-base font-bold text-primary mt-5 mb-2">
          {line.slice(3)}
        </h3>,
      );
    } else if (line.trim() === "---") {
      flushBullets();
      flushPara();
      blocks.push(<hr key={`hr${key++}`} className="my-3 border-border/30" />);
    } else if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      bulletBuf.push(line.replace(/^\s*[-*]\s+/, ""));
    } else if (line.trim() === "") {
      flushBullets();
      flushPara();
    } else {
      paraBuf.push(line);
    }
    i++;
  }
  flushTable();
  flushBullets();
  flushPara();

  return <div className="text-sm">{blocks}</div>;
}

function renderInline(text: string): React.ReactNode {
  // **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
