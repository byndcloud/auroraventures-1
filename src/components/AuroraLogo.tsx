import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AuroraLogoProps {
  className?: string;
  as?: "link" | "span";
  to?: string;
}

export function AuroraLogo({ className, as = "link", to = "/" }: AuroraLogoProps) {
  const inner = (
    <>
      AURORA<span className="text-primary">.</span>
    </>
  );

  const baseClass = cn(
    "text-2xl md:text-3xl font-bold tracking-tight text-foreground",
    className
  );

  if (as === "span") {
    return (
      <span className={baseClass} style={{ fontFamily: "'Syne', sans-serif" }}>
        {inner}
      </span>
    );
  }

  return (
    <Link to={to} className={baseClass} style={{ fontFamily: "'Syne', sans-serif" }}>
      {inner}
    </Link>
  );
}
