// ============================================================================
// OngoingPublico — visão pública (sem login) da seção Ongoing de uma iniciativa
// ============================================================================
// Rota: /ongoing/:token (fora de ProtectedRoute).
// Os dados vêm exclusivamente da RPC get_public_ongoing(token) — SECURITY
// DEFINER no Postgres, validando o token contra ongoing_share_links.enabled.
// Nenhuma tabela é exposta diretamente ao role anon.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldX } from "lucide-react";
import { VestingViewerSection } from "@/components/admin/VestingViewerSection";
import {
  VestingWeeklySection,
  type Measurement,
  type WeekNote,
} from "@/components/admin/VestingWeeklySection";
import { type VestingIndicator } from "@/components/admin/vesting";

interface PublicOngoingPayload {
  project_name: string;
  status: string;
  indicators: VestingIndicator[];
  measurements: Measurement[];
  week_notes: WeekNote[];
}

export default function OngoingPublico() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-ongoing", token],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_public_ongoing", {
        p_token: token,
      });
      if (error) throw error;
      return (data ?? null) as PublicOngoingPayload | null;
    },
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 px-6 text-center">
        <ShieldX className="w-10 h-10 text-muted-foreground/50" />
        <h1 className="text-lg font-semibold text-foreground">
          Link inválido ou desativado
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Este link de acompanhamento não existe ou foi revogado. Solicite um
          novo link ao time da Aurora.
        </p>
      </div>
    );
  }

  // submissionId não é necessário: os componentes recebem os dados injetados
  // (override) e não consultam o Supabase.
  return (
    <div className="min-h-screen bg-background">
      {/* Header público enxuto */}
      <header className="border-b border-border/40 bg-card/30 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Aurora · Acompanhamento Ongoing
            </p>
            <h1 className="text-xl font-bold text-foreground">
              {data.project_name}
            </h1>
          </div>
          <span className="text-2xl font-black tracking-tight text-primary">
            AURORA<span className="text-foreground">.</span>
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <VestingViewerSection
          submissionId="public"
          indicatorsOverride={data.indicators}
        />
        <VestingWeeklySection
          submissionId="public"
          dataOverride={{
            indicators: data.indicators,
            measurements: data.measurements,
            weekNotes: data.week_notes,
          }}
        />
        <p className="text-[10px] text-muted-foreground text-center pb-6">
          Visualização somente leitura, compartilhada pela equipe Aurora /
          Beyond. Os dados refletem o último registro semanal.
        </p>
      </main>
    </div>
  );
}
