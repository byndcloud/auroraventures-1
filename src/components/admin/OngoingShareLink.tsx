// Controle do link público do Ongoing (admin only).
// Gera, copia e revoga/reativa o token de ongoing_share_links — 1 por
// iniciativa. O link aponta para /ongoing/:token (página pública).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link2, Copy, Ban, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ShareLink {
  id: string;
  submission_id: string;
  token: string;
  enabled: boolean;
}

interface Props {
  submissionId: string;
}

export function OngoingShareLink({ submissionId }: Props) {
  const queryClient = useQueryClient();
  const [working, setWorking] = useState(false);

  const { data: link, isLoading } = useQuery({
    queryKey: ["ongoing-share-link", submissionId],
    queryFn: async () => {
      const from = supabase.from("ongoing_share_links" as any) as any;
      const { data, error } = await from
        .select("*")
        .eq("submission_id", submissionId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ShareLink | null;
    },
    enabled: !!submissionId,
  });

  const publicUrl = link
    ? `${window.location.origin}/ongoing/${link.token}`
    : null;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["ongoing-share-link", submissionId] });

  const handleGenerate = async () => {
    setWorking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const from = supabase.from("ongoing_share_links" as any) as any;
      const { error } = await from.insert({
        submission_id: submissionId,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Link público gerado.");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar link.");
    } finally {
      setWorking(false);
    }
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente: " + publicUrl);
    }
  };

  const handleToggle = async () => {
    if (!link) return;
    setWorking(true);
    try {
      const from = supabase.from("ongoing_share_links" as any) as any;
      const { error } = await from
        .update({ enabled: !link.enabled })
        .eq("id", link.id);
      if (error) throw error;
      toast.success(link.enabled ? "Link revogado — acesso público desativado." : "Link reativado.");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar link.");
    } finally {
      setWorking(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="glass-card rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <Link2 className="w-4 h-4 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Link público do Ongoing</p>
          {link ? (
            <p className="text-xs text-muted-foreground truncate max-w-[420px]" title={publicUrl ?? ""}>
              {publicUrl}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Compartilhe o acompanhamento (somente leitura) sem exigir login.
            </p>
          )}
        </div>
        {link && (
          <Badge
            variant="outline"
            className={`text-[10px] shrink-0 ${
              link.enabled
                ? "bg-accent/20 text-accent border-accent/30"
                : "bg-destructive/20 text-destructive border-destructive/30"
            }`}
          >
            {link.enabled ? "ativo" : "revogado"}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!link ? (
          <Button size="sm" onClick={handleGenerate} disabled={working}>
            {working ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Link2 className="w-3.5 h-3.5 mr-1.5" />
            )}
            Gerar link público
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!link.enabled}>
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copiar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggle}
              disabled={working}
              className={
                link.enabled
                  ? "text-destructive hover:text-destructive hover:bg-destructive/10"
                  : ""
              }
            >
              {working ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : link.enabled ? (
                <Ban className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              {link.enabled ? "Revogar" : "Reativar"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
