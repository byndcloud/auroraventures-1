import { Link } from "react-router-dom";
import { CalendarClock, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Call } from "./CallsCarousel";

interface CallDetailSheetProps {
  call: Call | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CallDetailSheet({ call, open, onOpenChange }: CallDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {call && (
          <div className="space-y-6 py-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {call.status === "ativa" ? (
                  <Badge className="bg-accent/20 text-accent border-accent/30">● Aberta</Badge>
                ) : (
                  <Badge variant="secondary">Encerrada</Badge>
                )}
                {call.vertical && (
                  <Badge variant="outline">{call.vertical}</Badge>
                )}
              </div>
              <SheetTitle className="text-xl font-bold leading-snug">
                {call.title}
              </SheetTitle>
              {call.deadline && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4" />
                  Inscrições até{" "}
                  {new Date(call.deadline).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Sobre esta chamada
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {call.description}
              </p>
            </div>

            <Separator />

            {call.status === "ativa" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Preencha o formulário de participação para submeter sua candidatura.
                </p>
                <Link
                  to={`/chamadas/${call.id}`}
                  onClick={() => onOpenChange(false)}
                >
                  <Button className="w-full" size="lg">
                    <Send className="w-4 h-4 mr-2" />
                    Ir para o Formulário
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="glass-card rounded-xl p-4 text-center space-y-1">
                <p className="text-sm font-medium">Esta chamada foi encerrada.</p>
                <p className="text-xs text-muted-foreground">
                  Você participou desta chamada. Os resultados serão divulgados em breve.
                </p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
