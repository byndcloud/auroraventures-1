// ============================================================================
// InitiativeCopilot — botão flutuante + painel de chat com o co-pilot da Aurora
// ============================================================================
// Acesso: admin e colaborador. Renderiza:
//   - Botão FAB no canto inferior direito (com ícone de sparkles)
//   - Sheet lateral com histórico da conversa + input
//
// Comportamento:
//   - Ao abrir, carrega a sessão mais recente do usuário com esta iniciativa
//   - Se não existir, mostra estado inicial (sem mensagens)
//   - Enviar mensagem → Edge Function copilot-chat → resposta aparece
//   - Mensagens persistem (sessão por usuário + iniciativa)
//   - Botão "Nova conversa" cria uma sessão limpa
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sparkles, Send, Plus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface InitiativeCopilotProps {
  submissionId: string;
  initiativeName?: string;
  // Posicionamento do botão flutuante:
  //   'fixed'  — ancora no viewport (default, usado em /iniciativa)
  //   'inline' — ancora no parent posicionado (usado dentro do modal admin)
  variant?: "fixed" | "inline";
}

interface ChatSession {
  id: string;
  submission_id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export function InitiativeCopilot({
  submissionId,
  initiativeName,
  variant = "fixed",
}: InitiativeCopilotProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Só admin/colaborador veem o co-pilot
  const canUse =
    profile?.role === "admin" || profile?.role === "colaborador";

  // ─── Carrega sessão mais recente quando abre ─────────────────────────────
  const { data: latestSession } = useQuery({
    queryKey: ["copilot-latest-session", submissionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_sessions" as any)
        .select("*")
        .eq("submission_id", submissionId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as unknown as ChatSession | null) ?? null;
    },
    enabled: open && canUse,
  });

  useEffect(() => {
    if (open && latestSession?.id && !activeSessionId) {
      setActiveSessionId(latestSession.id);
    }
  }, [open, latestSession, activeSessionId]);

  // ─── Mensagens da sessão ativa ───────────────────────────────────────────
  const { data: messages = [] } = useQuery({
    queryKey: ["copilot-messages", activeSessionId],
    queryFn: async () => {
      if (!activeSessionId) return [];
      const { data, error } = await supabase
        .from("chat_messages" as any)
        .select("*")
        .eq("session_id", activeSessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ChatMessage[];
    },
    enabled: !!activeSessionId,
  });

  // ─── Estado "pendente" e travamento ──────────────────────────────────────
  // Se a última mensagem é do user, ainda estamos esperando o assistant.
  // Isso cobre: refresh durante processamento, internet caiu antes da resposta
  // chegar, Edge Function ainda rodando, etc.
  const lastMessage = messages[messages.length - 1];
  const isPending = !!lastMessage && lastMessage.role === "user";

  // Após 90s pendente, considera "travado" e oferece retry
  const [isStuck, setIsStuck] = useState(false);
  useEffect(() => {
    if (!isPending) {
      setIsStuck(false);
      return;
    }
    setIsStuck(false);
    const timer = setTimeout(() => setIsStuck(true), 90_000);
    return () => clearTimeout(timer);
  }, [isPending, lastMessage?.id]);

  // ─── Realtime: novas mensagens da sessão atualizam a UI sozinhas ─────────
  useEffect(() => {
    if (!activeSessionId) return;
    const channel = supabase
      .channel(`copilot-messages:${activeSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${activeSessionId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["copilot-messages", activeSessionId],
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSessionId, queryClient]);

  // ─── Polling backup (caso Realtime não esteja habilitado) ────────────────
  // Enquanto pendente, refaz a query a cada 3s.
  useEffect(() => {
    if (!isPending || !activeSessionId) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: ["copilot-messages", activeSessionId],
      });
    }, 3_000);
    return () => clearInterval(interval);
  }, [isPending, activeSessionId, queryClient]);

  // ─── Auto-scroll para a última mensagem ──────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setIsSending(true);
    const tempInput = text;
    setInput("");

    try {
      const { data, error } = await supabase.functions.invoke("copilot-chat", {
        body: {
          submissionId,
          sessionId: activeSessionId,
          message: tempInput,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.sessionId) throw new Error("Resposta inválida");

      if (!activeSessionId) setActiveSessionId(data.sessionId);

      queryClient.invalidateQueries({ queryKey: ["copilot-messages", data.sessionId] });
      queryClient.invalidateQueries({
        queryKey: ["copilot-latest-session", submissionId],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar mensagem.");
      setInput(tempInput); // restaura input em caso de erro
    } finally {
      setIsSending(false);
    }
  };

  // Reenvia a última pergunta do usuário (útil quando a Edge Function travou
  // e a resposta nunca chegou). Cria uma nova chamada ao copilot-chat — se a
  // resposta original chegar depois, fica duplicada, sem problema.
  const handleRetry = async () => {
    if (!lastMessage || lastMessage.role !== "user" || isSending) return;
    const text = lastMessage.content;
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("copilot-chat", {
        body: { submissionId, sessionId: activeSessionId, message: text },
      });
      if (error) throw new Error(error.message);
      if (data?.sessionId && !activeSessionId) setActiveSessionId(data.sessionId);
      queryClient.invalidateQueries({
        queryKey: ["copilot-messages", data?.sessionId ?? activeSessionId],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao tentar novamente.");
    } finally {
      setIsSending(false);
    }
  };

  const handleNewSession = () => {
    setActiveSessionId(null);
    setInput("");
    queryClient.removeQueries({ queryKey: ["copilot-messages"] });
  };

  if (!canUse) return null;

  return (
    <>
      {/* FAB no canto inferior direito (do viewport ou do container parent) */}
      <button
        onClick={() => setOpen(true)}
        className={`${
          variant === "inline" ? "absolute" : "fixed"
        } bottom-3 right-6 z-40 flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all`}
        title="Co-Pilot da iniciativa"
        aria-label="Abrir co-pilot"
      >
        <Sparkles className="w-5 h-5" />
      </button>

      {/* Sheet com o chat */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md flex flex-col p-0 gap-0"
        >
          <SheetHeader className="p-4 border-b border-border/50 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <SheetTitle className="text-base truncate">
                  Co-Pilot {initiativeName ? `· ${initiativeName}` : ""}
                </SheetTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewSession}
                title="Nova conversa"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <SheetDescription className="text-xs">
              Pergunte sobre reuniões, atas, documentos e dados desta iniciativa.
            </SheetDescription>
          </SheetHeader>

          {/* Lista de mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !isSending && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Sparkles className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Pergunte algo sobre esta iniciativa
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Ex: "O que foi decidido na última reunião?"
                </p>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {/* Pensando — aparece tanto durante a chamada quanto se a última
                mensagem é do user (cobre refresh / queda de conexão) */}
            {(isSending || isPending) && !isStuck && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Pensando…
              </div>
            )}
            {/* Travado — após 90s pendente, oferece retry */}
            {isStuck && !isSending && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 space-y-2">
                <p className="text-xs text-yellow-400">
                  A resposta está demorando mais que o esperado. A conexão pode
                  ter caído ou o agente travou.
                </p>
                <Button size="sm" variant="outline" onClick={handleRetry}>
                  Tentar novamente
                </Button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border/50 shrink-0">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Pergunte algo sobre esta iniciativa…"
                className="resize-none min-h-[44px] max-h-32 text-sm"
                disabled={isSending}
              />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!input.trim() || isSending}
                className="shrink-0"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Enter envia · Shift+Enter quebra linha
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-componente: bolha de mensagem
// ──────────────────────────────────────────────────────────────────────────
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        <p
          className={`text-[10px] mt-1 ${
            isUser ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          {format(new Date(message.created_at), "HH:mm", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
}
