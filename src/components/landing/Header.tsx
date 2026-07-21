import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { Menu01Icon, Cancel01Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { getDashboardPath } from "@/lib/roles";

const navItems = [
  { label: "Extreme Group", href: "#extreme-group" },
  { label: "Verticais", href: "#verticais" },
  { label: "Jornada", href: "#jornada" },
  { label: "Benefícios", href: "#beneficios" },
  { label: "Chamadas Abertas", href: "/chamadas", isRoute: true },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeHash, setActiveHash] = useState<string>("");
  const { session, profile, signOut } = useAuth();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const sectionIds = navItems
      .filter((i) => !i.isRoute)
      .map((i) => i.href.replace("#", ""));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveHash(`#${entry.target.id}`);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const dashboardPath = !session || !profile || profile.role === null
    ? "/login"
    : getDashboardPath(profile.role);

  const buttonLabel = !session ? "Login" : "Meu Painel";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/85 backdrop-blur-md border-b border-border"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="container-editorial h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center" aria-label="Aurora">
          <span
            className="text-foreground tracking-tight font-medium"
            style={{ fontSize: "1.5rem", letterSpacing: "-0.04em" }}
          >
            AURORA<span className="text-primary">.</span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-9">
          {navItems.map((item) => {
            const isActive = !item.isRoute && activeHash === item.href;
            const cls = `nav-editorial-link ${isActive ? "is-active" : ""}`;
            return item.isRoute ? (
              <Link key={item.label} to={item.href} className={cls}>
                {item.label}
              </Link>
            ) : (
              <a key={item.label} href={item.href} className={cls}>
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to={dashboardPath}
            className="btn-editorial btn-solid btn-arrow hidden md:inline-flex"
          >
            {buttonLabel}
            <HugeiconsIcon icon={ArrowUpRight01Icon} className="w-4 h-4" strokeWidth={1.5} data-arrow />
          </Link>
          {session && (
            <button
              onClick={() => signOut()}
              className="btn-editorial btn-outline hidden md:inline-flex"
            >
              Logout
            </button>
          )}
          <button
            className="lg:hidden text-foreground p-1"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen
              ? <HugeiconsIcon icon={Cancel01Icon} className="w-5 h-5" strokeWidth={1.5} />
              : <HugeiconsIcon icon={Menu01Icon} className="w-5 h-5" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-background border-b border-border"
          >
            <div className="container-editorial py-6 flex flex-col gap-4">
              {navItems.map((item) =>
                item.isRoute ? (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="text-base text-foreground/80 hover:text-foreground py-2"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.label}
                    href={item.href}
                    className="text-base text-foreground/80 hover:text-foreground py-2"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </a>
                )
              )}
              <Link
                to={dashboardPath}
                onClick={() => setMobileOpen(false)}
                className="btn-editorial btn-solid btn-arrow w-full justify-center mt-2"
              >
                {buttonLabel}
                <HugeiconsIcon icon={ArrowUpRight01Icon} className="w-4 h-4" strokeWidth={1.5} data-arrow />
              </Link>
              {session && (
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    signOut();
                  }}
                  className="btn-editorial btn-outline w-full justify-center"
                >
                  Logout
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
