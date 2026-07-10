import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const stages = [
  {
    number: "01",
    phase: "Discovery",
    description: "Conecte sua tese ao nosso ecossistema.",
    items: ["Submissão", "Pitch Inicial", "Plano de Vesting"],
  },
  {
    number: "02",
    phase: "Build",
    description: "Construa e teste em mercado com agilidade.",
    items: ["Design Sprint", "Vibe Coding", "Validação de Mercado"],
  },
  {
    number: "03",
    phase: "Scale",
    description: "Lance a sua empresa focando no que importa.",
    items: [
      "Report de Resultados",
      "Formalização da empresa",
      "Lançamento Oficial",
    ],
  },
];

export function RoadmapSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="jornada"
      className="section-dark section-y-lg"
      ref={ref}
    >
      <div className="container-editorial">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="grid lg:grid-cols-12 gap-8 mb-20"
        >
          <div className="lg:col-span-3">
            <p className="eyebrow text-white/60">[05 - A Jornada]</p>
          </div>
          <div className="lg:col-span-9">
            <h2 className="text-white max-w-3xl">
              Do insight ao impacto<span className="text-primary">.</span>
            </h2>
            <p className="body-lg text-white/70 mt-6 max-w-2xl">
              Três fases, um caminho de aceleração coordenado de ponta a ponta.
            </p>
          </div>
        </motion.div>

        <div className="border-t border-white/15">
          {stages.map((s, i) => (
            <motion.div
              key={s.phase}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="grid lg:grid-cols-12 gap-6 py-10 border-b border-white/15"
            >
              <div className="lg:col-span-1 caption text-white/50">
                {s.number}
              </div>
              <div className="lg:col-span-3">
                <h3
                  className="text-white"
                  style={{
                    fontSize: "clamp(2rem, 3vw + 0.5rem, 2.75rem)",
                    fontWeight: 400,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.05,
                  }}
                >
                  {s.phase}
                </h3>
              </div>
              <div className="lg:col-span-4">
                <p className="text-white/80 leading-relaxed">{s.description}</p>
              </div>
              <div className="lg:col-span-4">
                <ul className="space-y-2">
                  {s.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 text-white/70 text-[0.95rem]"
                    >
                      <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
