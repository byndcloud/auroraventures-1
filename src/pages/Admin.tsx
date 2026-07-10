import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, LogOut, Settings, LayoutList, Megaphone, Briefcase } from "lucide-react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, DragOverlay, closestCorners } from "@dnd-kit/core";
import { AuroraLogo } from "@/components/AuroraLogo";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { FilterBar } from "@/components/admin/FilterBar";
import { DroppableKanbanColumn } from "@/components/admin/DroppableKanbanColumn";
import { KanbanCard } from "@/components/admin/KanbanCard";
import { SubmissionPanel } from "@/components/admin/SubmissionPanel";
import { AddInitiativeDialog } from "@/components/admin/AddInitiativeDialog";
import { KpiCards } from "@/components/admin/KpiCards";
import { CallsManager } from "@/components/admin/CallsManager";
import { WorkspaceBoard } from "@/components/admin/workspace/WorkspaceBoard";
import { KanbanSubmission, KANBAN_PHASES, OriginFilter } from "@/components/admin/kanban";
import { SubmissionOrigin } from "@/components/admin/common";

const Admin = () => {
  const { user, signOut } = useAuth();
  const [submissions, setSubmissions] = useState<KanbanSubmission[]>([]);
  const [filter, setFilter] = useState<OriginFilter>("todos");
  const [selectedSub, setSelectedSub] = useState<KanbanSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: subs, error: subsErr } = await supabase
        .from("submissions")
        .select("id, project_name, type, status, created_at, user_id, due_date, briefing, data")
        .order("created_at", { ascending: false })
        .limit(500);

      if (subsErr) throw subsErr;

      // Avaliação mais recente (completed) por submission.
      // Order desc + Map.set ignorando duplicatas garante "latest wins".
      const { data: scoresData } = await supabase
        .from("evaluations")
        .select("submission_id, scores, final_score, has_veto, verdict, created_at")
        .eq("processing_status", "completed")
        .order("created_at", { ascending: false });

      const scoresMap = new Map<string, any>();
      (scoresData || []).forEach((s: any) => {
        if (!scoresMap.has(s.submission_id)) {
          scoresMap.set(s.submission_id, {
            scores: s.scores,
            final_score: s.final_score,
            has_veto: s.has_veto,
            verdict: s.verdict,
          });
        }
      });

      const mapped: KanbanSubmission[] = (subs || []).map((s: any) => ({
        id: s.id,
        project_name: s.project_name,
        type: s.type as SubmissionOrigin,
        status: s.status,
        data: (typeof s.data === 'object' && s.data !== null ? s.data : {}) as Record<string, any>,
        created_at: s.created_at,
        user_id: s.user_id,
        due_date: s.due_date ?? null,
        scores: scoresMap.get(s.id) || null,
      }));

      setSubmissions(mapped);

      if (selectedSub) {
        const updated = mapped.find((m) => m.id === selectedSub.id);
        if (updated) setSelectedSub(updated);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedSub?.id]);

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(
    () => filter === "todos" ? submissions : submissions.filter((s) => s.type === filter),
    [submissions, filter]
  );

  const columns = useMemo(
    () => KANBAN_PHASES.map((phase) => ({
      ...phase,
      submissions: filtered.filter((s) => s.status === phase.key),
    })),
    [filtered]
  );

  const activeSubmission = useMemo(
    () => activeDragId ? submissions.find((s) => s.id === activeDragId) || null : null,
    [activeDragId, submissions]
  );

  const handleCardClick = useCallback((sub: KanbanSubmission) => setSelectedSub(sub), []);
  const noopCardClick = useCallback((_sub: KanbanSubmission) => {}, []);

  const handleDragStart = (event: any) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const draggedId = active.id as string;
    const overId = over.id as string;

    // Determine target column: either dropped on a column directly, or on a card inside a column
    let targetColumnKey = overId;
    const isColumn = KANBAN_PHASES.some((p) => p.key === overId);
    if (!isColumn) {
      // Dropped over a card — find which column that card belongs to
      const targetCard = submissions.find((s) => s.id === overId);
      if (!targetCard) return;
      targetColumnKey = targetCard.status;
    }

    const sub = submissions.find((s) => s.id === draggedId);
    if (!sub || sub.status === targetColumnKey) return;

    // Optimistic update
    setSubmissions((prev) =>
      prev.map((s) => s.id === draggedId ? { ...s, status: targetColumnKey } : s)
    );

    try {
      const { error } = await supabase
        .from("submissions")
        .update({ status: targetColumnKey })
        .eq("id", draggedId);

      if (error) throw error;

      // Audit log – fire and forget
      supabase
        .from("submission_history")
        .insert({
          submission_id: draggedId,
          from_status: sub.status,
          to_status: targetColumnKey,
          moved_by: user?.id,
        })
        .then(({ error: histErr }) => {
          if (histErr) console.error("Audit log error:", histErr);
        });

      const phaseLabel = KANBAN_PHASES.find((p) => p.key === targetColumnKey)?.label || targetColumnKey;
      toast.success(`Movido para ${phaseLabel}`);
    } catch (err: any) {
      toast.error("Erro ao mover card", { description: err.message });
      fetchData(); // rollback
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const initials = user?.email ? user.email.substring(0, 2).toUpperCase() : "AD";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-border flex items-center px-6 gap-4 bg-card/30 backdrop-blur-xl shrink-0">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <AuroraLogo as="span" className="text-lg" />
        <span className="text-sm text-muted-foreground ml-2">Centro de Comando</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 focus:outline-none">
                <Avatar className="h-9 w-9 cursor-pointer border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                {user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="w-4 h-4 mr-2" />
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Tabs */}
      <Tabs defaultValue="kanban" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-3">
          <TabsList>
            <TabsTrigger value="kanban" className="gap-1.5">
              <LayoutList className="w-4 h-4" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="chamadas" className="gap-1.5">
              <Megaphone className="w-4 h-4" />
              Chamadas
            </TabsTrigger>
            <TabsTrigger value="workspace" className="gap-1.5">
              <Briefcase className="w-4 h-4" />
              WorkSpace
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="kanban" className="flex-1 flex flex-col overflow-hidden mt-0">
          {/* KPI Cards */}
          <div className="px-6 pt-4 pb-3">
            <KpiCards submissions={submissions} />
          </div>

          {/* Filters */}
          <div className="px-6 py-3 border-b border-border/50 bg-card/10 flex items-center justify-between gap-4">
            <FilterBar active={filter} onChange={setFilter} />
            <AddInitiativeDialog />
          </div>

          {/* Kanban Board with DnD */}
          <div className="flex-1 overflow-hidden">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <ScrollArea className="h-full">
                <div className="flex gap-4 p-6 min-w-max">
                  {columns.map((col) => (
                    <DroppableKanbanColumn
                      key={col.key}
                      id={col.key}
                      icon={col.icon}
                      label={col.label}
                      submissions={col.submissions}
                      onCardClick={handleCardClick}
                      isKilled={col.key === "Despriorizado"}
                    />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              <DragOverlay>
                {activeSubmission ? (
                  <div className="w-[240px] opacity-90">
                    <KanbanCard submission={activeSubmission} onCardClick={noopCardClick} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </TabsContent>

        <TabsContent value="chamadas" className="flex-1 overflow-auto mt-0">
          <div className="px-6 py-6">
            <CallsManager />
          </div>
        </TabsContent>

        <TabsContent value="workspace" className="flex-1 overflow-auto mt-0">
          <div className="px-6 py-6">
            <WorkspaceBoard />
          </div>
        </TabsContent>
      </Tabs>

      {/* Side Panel */}
      <SubmissionPanel
        submission={selectedSub}
        onClose={() => setSelectedSub(null)}
        onSaved={fetchData}
      />
    </div>
  );
};

export default Admin;
