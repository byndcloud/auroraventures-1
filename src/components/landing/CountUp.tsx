import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  start: boolean;
  formatter?: (n: number) => string;
}

export function CountUp({
  end,
  duration = 2000,
  prefix = "",
  suffix = "",
  start,
  formatter,
}: CountUpProps) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!start || startedRef.current) return;
    startedRef.current = true;

    const startTime = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(end * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, end, duration]);

  const formatted = formatter
    ? formatter(value)
    : value.toLocaleString("pt-BR");

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
