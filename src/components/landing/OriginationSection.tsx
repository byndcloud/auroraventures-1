import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const pillars = [
  {
    number: "01",
    title: "Mercado",
    items: ["M&A de Startups", "Inovação aberta", "Parcerias Estratégicas"],
  },
  {
    number: "02",
    title: "Editais",
    items: [
      "Captação a fundo perdido",
      "Programas governamentais",
      "Incentivos fiscais",
    ],
  },
  {
    number: "03",
    title: "Interno",
    items: ["Intraempreendedorismo", "Time Extreme", "Spin-offs"],
  },
];

export function OriginationSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="section-cream section-y-lg" ref={ref}>
      <div className="container-editorial">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="grid lg:grid-cols-12 gap-8 mb-20"
        >
          <div className="lg:col-span-3">
            <p className="eyebrow text-foreground/60">[03 - Originação]</p>
          </div>
          <div className="lg:col-span-9">
            <h2 className="text-foreground max-w-3xl">
              Onde olhamos para encontrar
              <br />
              oportunidades.
            </h2>
            <p className="body-lg text-foreground/70 mt-6 max-w-2xl">
              Três caminhos que alimentam o ecossistema de inovação da Aurora.
            </p>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-px bg-border">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.12 }}
              className="bg-card p-8 lg:p-10 flex flex-col min-h-[320px]"
            >
              <div className="flex items-baseline justify-between mb-10">
                <span
                  className="font-mono text-foreground/40"
                  style={{ fontSize: "0.875rem", letterSpacing: "0.04em" }}
                >
                  / {p.number}
                </span>
              </div>
              <h3
                className="text-foreground mb-8"
                style={{
                  fontSize: "clamp(1.75rem, 2.5vw + 0.5rem, 2.5rem)",
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.05,
                }}
              >
                {p.title}
              </h3>
              <ul className="mt-auto space-y-3 border-t border-border pt-6">
                {p.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-foreground/75 text-[0.95rem]"
                  >
                    <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
