// Componente compartilhado para renderizar uma ata estruturada (JSONB) gerada
// pelo agente Volund OS. Reusado pela aba Reuniões do SubmissionPanel e pela
// página /iniciativa. Renderiza apenas seções que tenham conteúdo.
import { Badge } from "@/components/ui/badge";

export interface StructuredMinutes {
  titulo_sugerido?: string;
  data_reuniao?: string | null;
  participantes?: string[];
  resumo_executivo?: string;
  topicos_discutidos?: Array<{ titulo: string; detalhes: string }>;
  decisoes?: Array<{
    descricao: string;
    tomada_por?: string | null;
    contexto?: string;
  }>;
  proximos_passos?: Array<{
    descricao: string;
    responsavel?: string | null;
    prazo?: string | null;
  }>;
  bloqueios_riscos?: Array<{
    descricao: string;
    severidade?: "baixa" | "media" | "alta";
  }>;
  metricas_mencionadas?: Array<{
    metrica: string;
    valor: string;
    contexto?: string;
  }>;
  sentimento_geral?: { score: number; justificativa: string };
}

const severityClass = (s?: string) =>
  s === "alta"
    ? "bg-destructive/20 text-destructive border-destructive/30"
    : s === "media"
      ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      : "bg-muted text-muted-foreground border-border/50";

export function StructuredMinutesView({ minutes }: { minutes: StructuredMinutes }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-accent">✨ Ata estruturada · Volund OS</p>
      </div>

      {/* Resumo executivo */}
      {minutes.resumo_executivo && (
        <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-lg p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">📌 Resumo executivo</p>
          <p className="text-sm leading-relaxed">{minutes.resumo_executivo}</p>
        </div>
      )}

      {/* Participantes */}
      {minutes.participantes && minutes.participantes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {minutes.participantes.map((p, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {p}
            </Badge>
          ))}
        </div>
      )}

      {/* Tópicos discutidos */}
      {minutes.topicos_discutidos && minutes.topicos_discutidos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">💬 Tópicos discutidos</p>
          {minutes.topicos_discutidos.map((t, i) => (
            <div key={i} className="bg-card/30 border border-border/40 rounded-md p-3">
              <p className="text-sm font-semibold mb-1">{t.titulo}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{t.detalhes}</p>
            </div>
          ))}
        </div>
      )}

      {/* Decisões */}
      {minutes.decisoes && minutes.decisoes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">⚖️ Decisões</p>
          {minutes.decisoes.map((d, i) => (
            <div
              key={i}
              className="bg-card/30 border-l-2 border-l-accent border border-border/40 rounded-md p-3"
            >
              <p className="text-sm">{d.descricao}</p>
              <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                {d.tomada_por && <span>👤 {d.tomada_por}</span>}
                {d.contexto && <span>· {d.contexto}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Próximos passos */}
      {minutes.proximos_passos && minutes.proximos_passos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">✅ Próximos passos</p>
          {minutes.proximos_passos.map((p, i) => (
            <div key={i} className="bg-card/30 border border-border/40 rounded-md p-3">
              <p className="text-sm">{p.descricao}</p>
              <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                {p.responsavel && <span>👤 {p.responsavel}</span>}
                {p.prazo && <span>📅 {p.prazo}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bloqueios / riscos */}
      {minutes.bloqueios_riscos && minutes.bloqueios_riscos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">🚧 Bloqueios e riscos</p>
          {minutes.bloqueios_riscos.map((b, i) => (
            <div
              key={i}
              className="bg-card/30 border border-border/40 rounded-md p-3 flex items-start gap-2"
            >
              <Badge variant="outline" className={`text-[10px] ${severityClass(b.severidade)}`}>
                {b.severidade ?? "—"}
              </Badge>
              <p className="text-sm flex-1">{b.descricao}</p>
            </div>
          ))}
        </div>
      )}

      {/* Métricas mencionadas */}
      {minutes.metricas_mencionadas && minutes.metricas_mencionadas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">📊 Métricas mencionadas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {minutes.metricas_mencionadas.map((m, i) => (
              <div key={i} className="bg-card/30 border border-border/40 rounded-md p-3">
                <p className="text-xs text-muted-foreground">{m.metrica}</p>
                <p className="text-sm font-semibold">{m.valor}</p>
                {m.contexto && (
                  <p className="text-xs text-muted-foreground mt-1">{m.contexto}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sentimento geral */}
      {minutes.sentimento_geral && (
        <div className="bg-card/30 border border-border/40 rounded-md p-3 flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            Sentimento {minutes.sentimento_geral.score}/5
          </Badge>
          <p className="text-xs text-muted-foreground flex-1">
            {minutes.sentimento_geral.justificativa}
          </p>
        </div>
      )}
    </div>
  );
}
