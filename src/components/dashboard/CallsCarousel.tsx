import { Link } from "react-router-dom";
import { Megaphone, ArrowRight, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export interface Call {
  id: string;
  title: string;
  description: string;
  status: string;
  call_type: string;
  visibility: string;
  vertical: string | null;
  deadline: string | null;
  created_at: string;
}

interface CallsCarouselProps {
  calls: Call[];
  isLoading: boolean;
  userRole: "colaborador" | "founder";
  onCallClick: (call: Call) => void;
}

function CallCard({ call, onClick }: { call: Call; onClick: () => void }) {
  const isActive = call.status === "ativa";
  const remaining = call.deadline ? new Date(call.deadline).getTime() - Date.now() : null;
  const isNearDeadline = isActive && remaining !== null && remaining > 0 && remaining < 7 * 24 * 60 * 60 * 1000;

  return (
    <button
      onClick={onClick}
      className="glass-card-hover rounded-xl p-5 w-72 flex-shrink-0 snap-start
                 text-left flex flex-col gap-3 h-48 transition-all duration-200
                 focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      <div className="flex items-center gap-2 flex-wrap">
        {isActive ? (
          <Badge className="bg-accent/20 text-accent border-accent/30 text-xs">
            ● Aberta
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs opacity-70">
            Encerrada
          </Badge>
        )}
        {call.vertical && (
          <Badge variant="outline" className="text-xs border-border/50">
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
        <p className="font-semibold text-sm leading-snug line-clamp-2">{call.title}</p>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{call.description}</p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <span className="text-xs text-muted-foreground">
          {call.deadline
            ? `Até ${new Date(call.deadline).toLocaleDateString("pt-BR")}`
            : "Prazo em aberto"}
        </span>
        {isActive && (
          <span className="text-primary text-xs font-medium flex items-center gap-1">
            Participar <ArrowRight className="w-3 h-3" />
          </span>
        )}
      </div>
    </button>
  );
}

export function CallsCarousel({ calls, isLoading, userRole, onCallClick }: CallsCarouselProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            {userRole === "colaborador"
              ? "Desafios Internos Abertos"
              : "Chamadas Abertas para Startups"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {userRole === "colaborador"
              ? "Oportunidades internas abertas para sua participação."
              : "Chamadas ativas para submissão da sua startup."}
          </p>
        </div>
        <Link
          to="/chamadas"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          Ver todas <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-72 flex-shrink-0 rounded-xl" />
          ))}
        </div>
      ) : calls.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma chamada aberta no momento.</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
          {calls.map((call) => (
            <CallCard key={call.id} call={call} onClick={() => onCallClick(call)} />
          ))}
        </div>
      )}
    </section>
  );
}
