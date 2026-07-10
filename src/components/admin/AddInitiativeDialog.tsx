import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const origens = [
  { emoji: "🚀", label: "Mercado", rota: "/submissaomercado" },
  { emoji: "🏢", label: "Interno", rota: "/submissaointerna" },
  { emoji: "📄", label: "Editais", rota: "/submissaoeditais" },
];

export function AddInitiativeDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [simplified, setSimplified] = useState(false);

  const handleSelect = (rota: string) => {
    setOpen(false);
    navigate(simplified ? `${rota}?simplified=true` : rota);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          Adicionar Iniciativa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Qual a origem da oportunidade?</DialogTitle>
          <DialogDescription>Selecione o tipo de iniciativa para preencher o formulário completo</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-primary" />
            <div>
              <Label htmlFor="simplified-toggle" className="text-sm font-medium text-foreground cursor-pointer">
                Submissão Simplificada
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Todos os campos ficam opcionais - preencha o restante depois no card.
              </p>
            </div>
          </div>
          <Switch
            id="simplified-toggle"
            checked={simplified}
            onCheckedChange={setSimplified}
          />
        </div>

        <div className="grid gap-3 py-2">
          {origens.map((o) => (
            <button
              key={o.rota}
              onClick={() => handleSelect(o.rota)}
              className="flex items-center gap-4 px-5 py-4 rounded-lg border border-border bg-card hover:bg-accent/10 hover:border-primary/40 transition-all text-left"
            >
              <span className="text-2xl">{o.emoji}</span>
              <span className="text-sm font-medium text-foreground">{o.label}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
