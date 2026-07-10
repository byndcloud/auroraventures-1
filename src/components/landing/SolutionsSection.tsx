import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";

const solutions: {
  name: string;
  description: string;
  tag: string;
  number: string;
  url?: string;
}[] = [
  {
    name: "Absens",
    description:
      "Redução de absenteísmo no SUS com IA preditiva e gestão inteligente de agendamentos.",
    tag: "HealthTech",
    number: "01",
    url: "https://absens.com.br",
  },
  {
    name: "Legis",
    description:
      "Automação jurídica com análise de documentos, geração de peças e gestão processual.",
    tag: "LegalTech",
    number: "02",
    url: "https://legishub.com.br",
  },
  {
    name: "Erudio",
    description:
      "EAD corporativo com trilhas adaptativas, gamificação e analytics de aprendizagem.",
    tag: "EdTech",
    number: "03",
  },
  {
    name: "Quoti",
    description:
      "Plataforma low-code para construção rápida de aplicações internas e automações.",
    tag: "Platform",
    number: "04",
  },
];

export function SolutionsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="section-light section-y-lg" ref={ref}>
      <div className="container-editorial">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="grid lg:grid-cols-12 gap-8 mb-20"
        >
          <div className="lg:col-span-3">
            <p className="eyebrow text-foreground/60">[04 - Portfólio]</p>
          </div>
          <div className="lg:col-span-9">
            <h2 className="text-foreground max-w-3xl">
              Ecossistema de soluções.
            </h2>
            <p className="body-lg text-foreground/70 mt-6 max-w-2xl">
              O que já construímos e estamos operando hoje.
            </p>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-px bg-border border border-border">
          {solutions.map((s, i) => {
            const hasUrl = Boolean(s.url);
            return (
              <motion.article
                key={s.name}
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="bg-card group relative p-8 lg:p-10 min-h-[280px] flex flex-col hover:bg-foreground/[0.02] transition-colors"
              >
                {hasUrl && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.name}
                    className="absolute inset-0 z-10"
                  />
                )}
                <div className="flex items-start justify-between mb-12">
                  <span
                    className="font-mono text-foreground/40"
                    style={{ fontSize: "0.875rem", letterSpacing: "0.04em" }}
                  >
                    / {s.number}
                  </span>
                  <span className="badge-primary">{s.tag}</span>
                </div>

                <h3
                  className="text-foreground mb-4"
                  style={{
                    fontSize: "clamp(2rem, 3vw + 0.5rem, 2.75rem)",
                    fontWeight: 400,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.05,
                  }}
                >
                  {s.name}
                </h3>
                <p className="text-foreground/70 leading-relaxed max-w-md">
                  {s.description}
                </p>

                {hasUrl && (
                  <HugeiconsIcon
                    icon={ArrowUpRight01Icon}
                    className="absolute bottom-8 right-8 w-5 h-5 text-foreground/40 group-hover:text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-all"
                    strokeWidth={1.5}
                  />
                )}
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
