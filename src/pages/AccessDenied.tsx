import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getDashboardPath } from "@/lib/roles";
import { ShieldX } from "lucide-react";
import { motion } from "framer-motion";

export default function AccessDenied() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(profile ? getDashboardPath(profile.role) : "/");
    }, 3000);
    return () => clearTimeout(timer);
  }, [profile, navigate]);

  return (
    <div className="min-h-screen bg-background hero-gradient flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-10 h-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
        <p className="text-muted-foreground">
          Você não tem permissão para acessar esta página. Redirecionando para o seu painel...
        </p>
      </motion.div>
    </div>
  );
}
