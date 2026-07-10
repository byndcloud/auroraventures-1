import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Dollar01Icon,
  UserMultiple02Icon,
  ChartIncreaseIcon,
  PaintBoardIcon,
  Megaphone01Icon,
  Building02Icon,
  CodeIcon,
  UserAdd01Icon,
  JusticeScale01Icon,
  ConnectIcon,
  Agreement01Icon,
  ChartLineData01Icon,
  Mortarboard01Icon,
  Scissor01Icon,
  ArrowUpRight01Icon,
} from "@hugeicons/core-free-icons";
import { Link } from "react-router-dom";

const benefits = [
  { icon: Dollar01Icon, label: "Capital" },
  { icon: UserMultiple02Icon, label: "Time" },
  { icon: PaintBoardIcon, label: "Design" },
  { icon: CodeIcon, label: "Desenvolvimento" },
  { icon: ChartIncreaseIcon, label: "Growth" },
  { icon: UserAdd01Icon, label: "Recrutamento" },
  { icon: JusticeScale01Icon, label: "Jurídico" },
  { icon: Megaphone01Icon, label: "Marketing" },
  { icon: ConnectIcon, label: "Network" },
  { icon: Agreement01Icon, label: "Parceiros" },
  { icon: Building02Icon, label: "Canais de Vendas" },
  { icon: ChartLineData01Icon, label: "Financeiro" },
];

const extraBenefits = [
  {
    icon: Building02Icon,
    title: "Escritórios",
    subtitle: "Recife · SP · RJ · Brasília · MG",
  },
  {
    icon: Mortarboard01Icon,
    title: "Mentorias",
    subtitle: "Rede de mentores especialistas",
  },
  {
    icon: Scissor01Icon,
    title: "LegalZices",
    subtitle: "Barbeiro · Manicure · Massagem · Inglês",
  },
  {
    icon: Megaphone01Icon,
    title: "Extreme Group",
    subtitle: "Acesso às empresas, Diretores e C-Levels",
  },
];

export function BenefitsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="beneficios"
      className="section-light section-y-lg"
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
            <p className="eyebrow text-foreground/60">[06 - Benefícios]</p>
          </div>
          <div className="lg:col-span-9">
            <h2 className="text-foreground max-w-3xl">
              O que oferecemos.
            </h2>
            <p className="body-lg text-foreground/70 mt-6 max-w-2xl">
              Fornecemos para empreendedores um time dedicado, acesso aos nossos
              parceiros e benefícios estruturais para escalar com velocidade.
            </p>
          </div>
        </motion.div>

        {/* Lista principal de benefícios - em chips editoriais */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="border-t border-border"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-px bg-border border-l border-r border-b border-border">
            {benefits.map((b) => (
              <div
                key={b.label}
                className="bg-card flex items-center gap-3 px-5 py-6 hover:bg-foreground/[0.03] transition-colors"
              >
                <HugeiconsIcon
                  icon={b.icon}
                  className="w-4 h-4 text-foreground/60 shrink-0"
                  strokeWidth={1.5}
                />
                <span className="text-sm text-foreground font-medium">
                  {b.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Benefícios extras - destaque maior */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border mt-px"
        >
          {extraBenefits.map((b) => (
            <div
              key={b.title}
              className="bg-card p-8 flex flex-col gap-6 min-h-[180px] hover:bg-foreground/[0.03] transition-colors"
            >
              <HugeiconsIcon
                icon={b.icon}
                className="w-6 h-6 text-primary"
                strokeWidth={1.25}
              />
              <div className="mt-auto">
                <p className="text-foreground font-medium mb-1">{b.title}</p>
                <p className="caption text-foreground/60">{b.subtitle}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* CTA final - bloco grande dark */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="section-dark relative overflow-hidden mt-24 px-8 lg:px-16 py-20 lg:py-28 rounded-md border border-border"
        >
          {/* Decorative glows */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 -right-24 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-25"
            style={{ background: "hsl(var(--primary))" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-24 w-[24rem] h-[24rem] rounded-full blur-3xl opacity-15"
            style={{ background: "hsl(var(--primary))" }}
          />

          <div className="relative grid lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8">
              <p className="eyebrow text-foreground/60 mb-8">[Próximo passo]</p>
              <h2
                className="text-foreground"
                style={{
                  fontSize: "clamp(2.5rem, 6vw + 0.5rem, 5rem)",
                  fontWeight: 400,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.02,
                }}
              >
                Vem criar com a gente
                <span className="text-primary">.</span>
              </h2>
            </div>
            <div className="lg:col-span-4 lg:text-right">
              <Link
                to="/submissaomercado"
                className="btn-editorial btn-arrow inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-sm font-medium transition-colors"
              >
                Submeta sua iniciativa
                <HugeiconsIcon icon={ArrowUpRight01Icon} className="w-4 h-4" strokeWidth={1.5} data-arrow />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="section-dark border-t border-border">
      <div className="container-editorial py-16 lg:py-20">
        {/* Logo gigante editorial */}
        <div
          className="text-foreground mb-16 leading-none"
          style={{
            fontSize: "clamp(5rem, 18vw, 22rem)",
            fontWeight: 400,
            letterSpacing: "-0.05em",
          }}
        >
          AURORA<span className="text-primary">.</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-12 border-b border-border">
          <div>
            <p className="eyebrow text-foreground/50 mb-4">[Navegação]</p>
            <ul className="space-y-2 text-foreground/80">
              <li>
                <a href="#extreme-group" className="link-underline text-sm">
                  Extreme Group
                </a>
              </li>
              <li>
                <a href="#verticais" className="link-underline text-sm">
                  Verticais
                </a>
              </li>
              <li>
                <a href="#jornada" className="link-underline text-sm">
                  Jornada
                </a>
              </li>
              <li>
                <a href="#beneficios" className="link-underline text-sm">
                  Benefícios
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="eyebrow text-foreground/50 mb-4">[Programas]</p>
            <ul className="space-y-2 text-foreground/80">
              <li>
                <Link to="/chamadas" className="link-underline text-sm">
                  Chamadas Abertas
                </Link>
              </li>
              <li>
                <Link to="/submissaomercado" className="link-underline text-sm">
                  Submissão
                </Link>
              </li>
              <li>
                <Link to="/login" className="link-underline text-sm">
                  Login
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="eyebrow text-foreground/50 mb-4">[Escritórios]</p>
            <ul className="space-y-2 text-foreground/80 text-sm">
              <li>Recife</li>
              <li>São Paulo</li>
              <li>Rio de Janeiro</li>
              <li>Brasília</li>
              <li>Belo Horizonte</li>
            </ul>
          </div>

          <div>
            <p className="eyebrow text-foreground/50 mb-4">[Conecte]</p>
            <ul className="space-y-2 text-foreground/80">
              <li>
                <a href="https://www.linkedin.com/company/beyond-coo/" target="_blank" rel="noopener noreferrer" className="link-underline text-sm">
                  LinkedIn
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/beyond.coo/" target="_blank" rel="noopener noreferrer" className="link-underline text-sm">
                  Instagram
                </a>
              </li>
              <li>
                <a href="mailto:aurora@beyondcompany.com.br" className="link-underline text-sm">
                  aurora@beyondcompany.com.br
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-8">
          <p className="caption text-foreground/60">
            © {new Date().getFullYear()} AURORA - Beyond Company. Todos os
            direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
