import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, LogOut, Eye } from "lucide-react";
import { AuroraLogo } from "@/components/AuroraLogo";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { FilterBar } from "@/components/admin/FilterBar";
import { KanbanColumn } from "@/components/admin/KanbanColumn";
import { KpiCards } from "@/components/admin/KpiCards";
import { KanbanSubmission, KANBAN_PHASES, OriginFilter } from "@/components/admin/kanban";
import { useSubmissionsWithScores } from "@/features/submissions/hooks";

const DashboardViewer = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<OriginFilter>("todos");

  const { data: fetched, isLoading, isFetching, refetch } = useSubmissionsWithScores();
  const submissions = useMemo(() => fetched ?? [], [fetched]);
  const loading = isLoading || isFetching;

  const fetchData = useCallback(async () => {
    await refetch();
  }, [refetch]);

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

  const handleCardClick = useCallback((sub: KanbanSubmission) => {
    navigate(`/iniciativa/${sub.id}`);
  }, [navigate]);

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "VW";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-border flex items-center px-6 gap-4 bg-card/30 backdrop-blur-xl shrink-0">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <AuroraLogo as="span" className="text-lg" />
        <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
          <Eye className="w-3 h-3" />
          Visualizador
        </Badge>
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
              <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="px-6 pt-4 pb-3">
        <KpiCards submissions={submissions} />
      </div>

      {/* Filters — no AddInitiativeDialog */}
      <div className="px-6 py-3 border-b border-border/50 bg-card/10">
        <FilterBar active={filter} onChange={setFilter} />
      </div>

      {/* Kanban Board — read-only, no DnD */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex gap-4 p-6 min-w-max">
            {columns.map((col) => (
              <KanbanColumn
                key={col.key}
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
      </div>
    </div>
  );
};

export default DashboardViewer;
