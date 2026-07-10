import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { AuroraLogo } from "@/components/AuroraLogo";
import { ArrowRight, Inbox, Search } from "lucide-react";

type FilterType = "all" | "mercado" | "interno";

export default function Chamadas() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const isInternal = profile?.role === "colaborador" || profile?.role === "admin";

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["calls-page", filter, profile?.role],
    queryFn: async () => {
      let query = supabase
        .from("calls")
        .select("*")
        .eq("status", "ativa")
        .order("created_at", { ascending: false });

      if (!isInternal) {
        query = query.eq("visibility", "publica").eq("call_type", "mercado");
      }

      if (filter === "mercado") query = query.eq("call_type", "mercado");
      if (filter === "interno") query = query.eq("call_type", "interno");

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = calls.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative border-b border-border bg-card/30 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
          <Link to="/" className="inline-block mb-8">
            <AuroraLogo className="text-lg" />
          </Link>

          <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-2">
            Chamadas Abertas
          </p>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Encontre sua oportunidade
          </h1>
          <p className="text-muted-foreground max-w-xl mb-6">
            Startups, inovadores e colaboradores: conheça as chamadas ativas do
            ecossistema Extreme Group e submeta sua candidatura.
          </p>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar chamada…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card/40 border-border/50"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap mb-8">
          {([
            { value: "all" as FilterType, label: "Todas" },
            { value: "mercado" as FilterType, label: "🚀 Mercado" },
            ...(isInternal
              ? [{ value: "interno" as FilterType, label: "🏢 Interno" }]
              : []),
          ]).map((opt) => (
            <Button
              key={opt.value}
              variant={filter === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(opt.value)}
              className={filter !== opt.value ? "border-border/50" : ""}
            >
              {opt.label}
            </Button>
          ))}
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} chamada{filtered.length !== 1 ? "s" : ""}{" "}
            encontrada{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
            <Inbox className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma chamada encontrada.</p>
            <p className="text-sm mt-1">
              {search
                ? "Tente um termo diferente."
                : "Não há chamadas abertas no momento para este filtro."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((call) => {
              const remaining = call.deadline ? new Date(call.deadline).getTime() - Date.now() : null;
              const isNearDeadline = remaining !== null && remaining > 0 && remaining < 7 * 24 * 60 * 60 * 1000;

              return (
                <Link key={call.id} to={`/chamadas/${call.id}`}>
                  <div className="glass-card-hover rounded-xl p-5 flex flex-col gap-3 h-52 transition-all duration-200">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-accent/20 text-accent border-accent/30 text-xs">
                        ● Aberta
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {call.call_type === "mercado"
                          ? "🚀 Mercado"
                          : "🏢 Interno"}
                      </Badge>
                      {call.vertical && (
                        <Badge
                          variant="outline"
                          className="text-xs border-border/50"
                        >
                          {call.vertical}
                        </Badge>
                      )}
                      {isNearDeadline && (
                        <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-xs">
                          ⚡ Encerrando em breve
                        </Badge>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-snug line-clamp-2">
                        {call.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {call.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/30">
                      <span className="text-xs text-muted-foreground">
                        {call.deadline
                          ? `Até ${new Date(call.deadline).toLocaleDateString("pt-BR")}`
                          : "Prazo em aberto"}
                      </span>
                      <span className="text-primary text-xs font-medium flex items-center gap-1">
                        Participar <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
