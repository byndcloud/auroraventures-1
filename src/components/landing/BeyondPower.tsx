import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import logoExtremeGroup from "@/assets/logo-extreme-group.svg";
import logoEds from "@/assets/logo-eds.svg";
import logoBeyond from "@/assets/logo-beyond.svg";
import logoEdx from "@/assets/logo-edx.svg";
import logoPointer from "@/assets/logo-pointer.svg";
import logoGpsit from "@/assets/logo-gpsit.svg";
import logoBora from "@/assets/logo-bora.svg";
import logoVolund from "@/assets/logo-volund.svg";
import { CountUp } from "./CountUp";

const companies: { name: string; logo: string; url?: string }[] = [
  { name: "EDS", logo: logoEds, url: "https://www2.extremedigital.com.br/" },
  { name: "Beyond Co.", logo: logoBeyond, url: "https://beyondcompany.com.br/" },
  { name: "EDX", logo: logoEdx, url: "https://goedx.com.br/" },
  { name: "Pointer", logo: logoPointer, url: "https://pointertech.digital/" },
  { name: "GPS IT", logo: logoGpsit, url: "https://gpsit.com.br/" },
  { name: "Bora!", logo: logoBora, url: "https://somosbora.com.br/index.html" },
  { name: "Völund", logo: logoVolund, url: "https://volund.com.br/" },
];

const bigNumbers = [
  {
    end: 2000,
    prefix: "+",
    suffix: "",
    formatter: (n: number) => n.toLocaleString("pt-BR"),
    description: "Colaboradores (Extremers) atuando em projetos estratégicos.",
  },
  {
    end: 44,
    prefix: "+",
    suffix: "Mi",
    description: "Atendimentos digitais viabilizados em serviços públicos.",
  },
  {
    end: 1,
    prefix: "+",
    suffix: "Mi",
    description: "Horas/ano dedicadas ao desenvolvimento de novas soluções.",
  },
  {
    end: 9,
    prefix: "+",
    suffix: "Mi",
    description: "Pessoas impactadas por dados integrados em saúde.",
  },
];

export function BeyondPower() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="extreme-group" className="section-cream section-y-lg" ref={ref}>
      <div className="container-editorial">
        {/* Eyebrow + heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="grid lg:grid-cols-12 gap-8 mb-20"
        >
          <div className="lg:col-span-3">
            <p className="eyebrow text-foreground/60">[01 - O Ecossistema]</p>
          </div>
          <div className="lg:col-span-9">
            <h2 className="text-foreground max-w-4xl">
              Você já conhece o Extreme Group? A AURORA é o braço de inovação e
              novos negócios desse ecossistema.
            </h2>
            <p className="body-lg text-foreground/70 mt-8 max-w-2xl">
              Integramos especialistas, soluções corporativas e execução em escala.
              Juntos, fornecemos experiências digitais de ponta, IA, arquitetura
              cloud e hiperautomação.
            </p>
          </div>
        </motion.div>

        {/* Big numbers - sem cards, divisores horizontais editoriais */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="border-t border-border"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
            {bigNumbers.map((item) => (
              <div key={item.description} className="py-10 px-5 first:pl-0">
                <div className="stat-number text-foreground mb-4">
                  <CountUp
                    end={item.end}
                    prefix={item.prefix}
                    suffix={item.suffix}
                    formatter={item.formatter}
                    start={inView}
                    duration={2000}
                  />
                </div>
                <p className="text-sm text-foreground/70 leading-snug max-w-[18ch]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-border" />
        </motion.div>

        {/* Empresas do grupo */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-20"
        >
          <div className="flex items-end justify-between flex-wrap gap-6 mb-10">
            <div>
              <p className="eyebrow text-foreground/60 mb-4">[Empresas do grupo]</p>
              <h3 className="text-foreground max-w-xl">
                Conheça as empresas que compõem o ecossistema.
              </h3>
            </div>
            <img
              src={logoExtremeGroup}
              alt="Extreme Group"
              className="h-10 w-auto opacity-90"
              style={{ filter: "brightness(0)" }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 border-t border-l border-border">
            {companies.map((company) => {
              const hasUrl = Boolean(company.url);
              const cardClass = "group relative aspect-[4/3] border-r border-b border-border bg-card hover:bg-background transition-colors duration-300 flex items-center justify-center p-8";
              const inner = (
                <>
                  <img
                    src={company.logo}
                    alt={`Logo ${company.name}`}
                    className="h-14 lg:h-16 w-auto max-w-[85%] object-contain transition-all duration-300 opacity-90 group-hover:opacity-100 group-hover:scale-105 [filter:brightness(0)] group-hover:[filter:brightness(0)_invert(1)]"
                  />
                  {hasUrl && (
                    <span className="absolute top-4 right-4 text-foreground/50 group-hover:text-primary transition-colors">
                      <HugeiconsIcon icon={ArrowUpRight01Icon} className="w-4 h-4" strokeWidth={1.5} />
                    </span>
                  )}
                  <span className="absolute bottom-4 left-4 eyebrow text-foreground/60 group-hover:text-foreground transition-colors">
                    {company.name}
                  </span>
                </>
              );
              return hasUrl ? (
                <a
                  key={company.name}
                  href={company.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cardClass}
                >
                  {inner}
                </a>
              ) : (
                <div key={company.name} className={cardClass}>
                  {inner}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
