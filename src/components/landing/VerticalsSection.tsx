import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const verticals = [
  {
    number: "01",
    title: "GovTechs",
    description:
      "Tecnologia para o setor público: licitações, transparência e eficiência administrativa.",
  },
  {
    number: "02",
    title: "HealthTechs",
    description:
      "Soluções para gestão de saúde pública, redução de absenteísmo e otimização de atendimentos.",
  },
  {
    number: "03",
    title: "LegalTechs",
    description:
      "Automação jurídica, compliance e gestão de processos com IA para escritórios e departamentos jurídicos.",
  },
  {
    number: "04",
    title: "EdTechs",
    description:
      "Plataformas de ensino corporativo, EAD e capacitação com inteligência adaptativa.",
  },
];

export function VerticalsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="verticais" className="section-light section-y-lg" ref={ref}>
      <div className="container-editorial">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="grid lg:grid-cols-12 gap-8 mb-16"
        >
          <div className="lg:col-span-3">
            <p className="eyebrow text-foreground/60">[02 - Verticais]</p>
          </div>
          <div className="lg:col-span-9">
            <h2 className="text-foreground max-w-3xl">
              Onde colocamos nossa energia.
            </h2>
            <p className="body-lg text-foreground/70 mt-6 max-w-2xl">
              Foco em B2G e B2B nas etapas de Ideação, Validação e Early Stage.
              Não nos limitamos a essas caixinhas - estamos sempre abertos a ir
              além e explorar novas frentes de inovação.
            </p>
          </div>
        </motion.div>

        <div className="border-t border-border">
          {verticals.map((v, i) => (
            <motion.div
              key={v.title}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="grid lg:grid-cols-12 gap-x-6 gap-y-3 py-8 border-b border-border items-start"
            >
              <div className="lg:col-span-1 caption text-foreground/50">
                {v.number}
              </div>
              <div className="lg:col-span-3">
                <h3
                  className="text-foreground"
                  style={{
                    fontSize: "clamp(1.5rem, 2vw + 0.5rem, 2rem)",
                    fontWeight: 400,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {v.title}
                </h3>
              </div>
              <div className="lg:col-span-8">
                <p className="text-foreground/75 leading-relaxed max-w-2xl">
                  {v.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
