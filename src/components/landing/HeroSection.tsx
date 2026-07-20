import { useNavigate } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { getDashboardPath } from "@/lib/roles";

export function HeroSection() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = () => {
    if (!session || !profile) {
      navigate("/login");
      return;
    }
    const role = profile.role;
    // Sem role em user_roles = precisa de atendimento admin.
    if (role === null) {
      navigate("/acesso-negado");
      return;
    }
    // Founder vai direto para o fluxo de submissão; demais roles, ao painel.
    if (role === "founder") {
      navigate("/submissaomercado");
      return;
    }
    navigate(getDashboardPath(role));
  };

  return (
    <section className="section-dark pt-32 pb-20 lg:pt-40 lg:pb-28">
      <div className="container-editorial">
        <div className="grid lg:grid-cols-12 gap-8 items-end">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-12"
          >
            <h1 className="text-foreground">
              Construímos o futuro de
              <br />
              grandes negócios<span className="text-primary">.</span>
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="lg:col-span-7 lg:col-start-6 mt-12 lg:mt-16"
          >
            <p className="body-lg text-foreground/75 max-w-2xl">
              O portal de aceleração e o braço de inovação do Extreme Group.
              Transformamos hipóteses em inovações validadas através de um
              ambiente de experimentação contínua.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button
                onClick={handleSubmit}
                className="btn-editorial btn-solid btn-arrow"
              >
                Submeta sua iniciativa
                <HugeiconsIcon icon={ArrowUpRight01Icon} className="w-4 h-4" strokeWidth={1.5} data-arrow />
              </button>
              <a
                href="#extreme-group"
                className="btn-editorial btn-outline-light btn-arrow"
              >
                Saiba mais
                <HugeiconsIcon icon={ArrowDown01Icon} className="w-4 h-4" strokeWidth={1.5} data-arrow />
              </a>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container-editorial mt-24 lg:mt-32">
        <div className="hr-slim" />
        <div className="flex items-center justify-end py-5 text-foreground/60">
          <span className="eyebrow">Beyond Company</span>
        </div>
      </div>
    </section>
  );
}
