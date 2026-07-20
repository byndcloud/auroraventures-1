import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuroraLogo } from "@/components/AuroraLogo";
import { LogOut, Lightbulb, FileText, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CallsCarousel, type Call } from "@/components/dashboard/CallsCarousel";
import { CallDetailSheet } from "@/components/dashboard/CallDetailSheet";
import { useCallsForDashboard } from "@/hooks/useCallsForDashboard";
import { useMySubmissions } from "@/features/submissions/hooks";

const statusIcons: Record<string, typeof Clock> = {
  "Em Avaliação": Clock,
  "Aprovado": CheckCircle2,
  "Em Análise": AlertCircle
};

export default function DashboardColaborador() {
  const { profile, user, signOut } = useAuth();
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // user.id (auth uid) — call_responses.user_id referencia auth.users, não profiles.id
  const { data: calls = [], isLoading: isLoadingCalls } = useCallsForDashboard(
    "colaborador",
    user?.id
  );

  const { data: submissions = [] } = useMySubmissions(user?.id);

  const cards = [
  {
    icon: Lightbulb,
    title: "Submeter Ideia Interna",
    description: "Identificou uma oportunidade de desenvolver um produto escalável? ",
    to: "/submissaointerna"
  },
  {
    icon: FileText,
    title: "Submeter Edital",
    description: "Identificou uma oportunidade de desenvolver um produto escalável através de editais?",
    to: "/submissaoeditais"
  }];


  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b border-border flex items-center px-6 justify-between bg-card/30 backdrop-blur-xl">
        <AuroraLogo className="text-lg" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 focus:outline-none">
              <span className="text-sm text-muted-foreground hidden sm:block">
                {profile?.full_name || "Colaborador"}
              </span>
              <Avatar className="h-9 w-9 cursor-pointer border border-border">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {(profile?.full_name || "C").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Painel de Acompanhamento</h1>
          <p className="text-muted-foreground">Submeta iniciativas e acompanhe o status.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid sm:grid-cols-2 gap-4 mb-10">
          {cards.map((card) =>
          <Link key={card.to} to={card.to}>
              <div className="glass-card-hover p-6 flex items-start gap-4 cursor-pointer h-full">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <card.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold">{card.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
                </div>
              </div>
            </Link>
          )}
        </motion.div>

        {/* Chamadas Abertas */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-10">
          <CallsCarousel
            calls={calls}
            isLoading={isLoadingCalls}
            userRole="colaborador"
            onCallClick={(call) => {
              setSelectedCall(call);
              setIsSheetOpen(true);
            }} />
          
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="text-lg font-semibold mb-4">Minhas Iniciativas</h2>
          {submissions.length === 0 ?
          <div className="glass-card p-10 text-center text-muted-foreground">
              <p>Você ainda não possui iniciativas.</p>
              <p className="text-sm mt-1">Selecione uma opção acima para começar.</p>
            </div> :

          <div className="grid gap-4">
              {submissions.map((sub) => {
              const Icon = statusIcons[sub.status] || Clock;
              return (
                <div key={sub.id} className="glass-card p-5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{sub.project_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {sub.type === "interna" ? "Ideia Interna" : "Edital"} •{" "}
                        {new Date(sub.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Icon className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">{sub.status}</span>
                    </div>
                  </div>);

            })}
            </div>
          }
        </motion.div>
      </main>

      <CallDetailSheet
        call={selectedCall}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen} />
      
    </div>);

}