import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Search,
  AlertCircle,
  CheckCircle2,
  Link2,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  WorkspaceTask,
  PRIORITIES,
  PRIORITY_LABEL,
  TIPO_LABEL,
  STATUS_LABEL,
  PERFIS,
  TIPOS,
  STATUSES,
} from "./types";
import { TaskDetailSheet } from "./TaskDetailSheet";
import { AddTaskDialog } from "./AddTaskDialog";

const PRIORITY_COLOR: Record<WorkspaceTask["priority"], string> = {
  P0: "bg-destructive/20 text-destructive border-destructive/30",
  P1: "bg-primary/20 text-primary border-primary/30",
  P2: "bg-muted-foreground/15 text-foreground border-border",
  P3: "bg-muted/40 text-muted-foreground border-border",
};

const TIPO_COLOR: Record<WorkspaceTask["tipo"], string> = {
  ajuste: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  melhoria: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  nova: "bg-accent/15 text-accent border-accent/30",
};

const STATUS_COLOR: Record<WorkspaceTask["status"], string> = {
  pendente: "bg-muted/40 text-muted-foreground border-border",
  em_andamento: "bg-primary/20 text-primary border-primary/30",
  aceita: "bg-accent/20 text-accent border-accent/30",
  rejeitada: "bg-destructive/20 text-destructive border-destructive/30",
  concluida: "bg-accent/30 text-accent border-accent/40",
};

export function WorkspaceBoard() {
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WorkspaceTask | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    P0: true, P1: true, P2: true, P3: true,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [fTipo, setFTipo] = useState<string>("todos");
  const [fPerfil, setFPerfil] = useState<string>("todos");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [fPriority, setFPriority] = useState<string>("todos");
  const [fDecisao, setFDecisao] = useState<string>("todas"); // todas | validado | aberta

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("workspace_tasks")
      .select("*")
      .is("deleted_at", null)
      .order("priority", { ascending: true })
      .order("external_id", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar tasks", { description: error.message });
    } else {
      setTasks((data ?? []) as WorkspaceTask[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const toggleDecisao = async (t: WorkspaceTask, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !t.tem_decisao_aberta;
    setTasks((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, tem_decisao_aberta: next } : x)),
    );
    const { error } = await supabase
      .from("workspace_tasks")
      .update({ tem_decisao_aberta: next })
      .eq("id", t.id);
    if (error) {
      toast.error("Erro ao atualizar", { description: error.message });
      fetchTasks();
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (fTipo !== "todos" && t.tipo !== fTipo) return false;
      if (fPerfil !== "todos" && t.perfil !== fPerfil) return false;
      if (fStatus !== "todos" && t.status !== fStatus) return false;
      if (fPriority !== "todos" && t.priority !== fPriority) return false;
      if (fDecisao === "validado" && t.tem_decisao_aberta) return false;
      if (fDecisao === "aberta" && !t.tem_decisao_aberta) return false;
      if (q) {
        const hay = `${t.external_id} ${t.title} ${t.description ?? ""} ${t.screen ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, search, fTipo, fPerfil, fStatus, fPriority, fDecisao]);

  const grouped = useMemo(() => {
    const map: Record<string, WorkspaceTask[]> = { P0: [], P1: [], P2: [], P3: [] };
    filtered.forEach((t) => map[t.priority].push(t));
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h2 className="text-xl font-semibold">WorkSpace · Evolução da Aurora</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} de {tasks.length} tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchTasks} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <AddTaskDialog onCreated={fetchTasks} />
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-card/40 border-border">
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, id, descrição…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <FilterSelect value={fTipo} onChange={setFTipo} label="Tipo" all="Todos os tipos"
            options={TIPOS.map((t) => ({ value: t, label: TIPO_LABEL[t] }))} />
          <FilterSelect value={fPerfil} onChange={setFPerfil} label="Perfil" all="Todos os perfis"
            options={PERFIS.map((p) => ({ value: p, label: p }))} />
          <FilterSelect value={fStatus} onChange={setFStatus} label="Status" all="Todos os status"
            options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
          <FilterSelect value={fPriority} onChange={setFPriority} label="Prioridade" all="Todas as prioridades"
            options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
          <FilterSelect
            value={fDecisao}
            onChange={setFDecisao}
            label="Decisão"
            all="Todas as decisões"
            allValue="todas"
            options={[
              { value: "validado", label: "Validado" },
              { value: "aberta", label: "Decisão Aberta" },
            ]}
          />
        </CardContent>
      </Card>

      {/* Grouped board */}
      <div className="space-y-4">
        {PRIORITIES.map((p) => {
          const isOpen = openGroups[p];
          return (
            <Collapsible
              key={p}
              open={isOpen}
              onOpenChange={(v) => setOpenGroups((g) => ({ ...g, [p]: v }))}
            >
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 w-full text-left py-1 group">
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground transition-transform ${
                      isOpen ? "" : "-rotate-90"
                    }`}
                  />
                  <Badge variant="outline" className={PRIORITY_COLOR[p]}>{p}</Badge>
                  <h3 className="text-sm font-medium text-muted-foreground group-hover:text-foreground">
                    {PRIORITY_LABEL[p]} · {grouped[p].length}
                  </h3>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                {grouped[p].length === 0 ? (
                  <p className="text-xs text-muted-foreground/70 italic px-1">
                    Nenhuma task nesta prioridade com os filtros atuais.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {grouped[p].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelected(t)}
                        className="text-left"
                      >
                        <Card
                          className={`bg-card border-border hover:border-primary/50 transition-colors h-full ${
                            t.tem_decisao_aberta ? "ring-1 ring-yellow-500/20" : ""
                          }`}
                        >
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {t.external_id}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] ${TIPO_COLOR[t.tipo]}`}>
                                {TIPO_LABEL[t.tipo]}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {t.perfil}
                              </Badge>
                            </div>
                            <h4 className="font-medium text-sm leading-snug break-words">
                              {t.title}
                            </h4>
                            {t.screen && (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {t.screen}
                              </p>
                            )}
                            <div className="flex items-center justify-between pt-1 gap-2">
                              <Badge variant="outline" className={`text-[10px] ${STATUS_COLOR[t.status]}`}>
                                {STATUS_LABEL[t.status]}
                              </Badge>
                              <div className="flex items-center gap-2">
                                {t.depends_on.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Link2 className="w-3 h-3" />
                                    {t.depends_on.length}
                                  </span>
                                )}
                                <button
                                  onClick={(e) => toggleDecisao(t, e)}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] transition-colors ${
                                    t.tem_decisao_aberta
                                      ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/25"
                                      : "bg-accent/20 text-accent border-accent/30 hover:bg-accent/30"
                                  }`}
                                  title="Alternar decisão"
                                >
                                  {t.tem_decisao_aberta ? (
                                    <>
                                      <AlertCircle className="w-3 h-3" /> Decisão Aberta
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" /> Validado
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </button>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      <TaskDetailSheet
        task={selected}
        allTasks={tasks}
        onClose={() => setSelected(null)}
        onSaved={fetchTasks}
      />
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  all,
  allValue = "todos",
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  all: string;
  allValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-[150px] h-9">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={allValue}>{all}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
