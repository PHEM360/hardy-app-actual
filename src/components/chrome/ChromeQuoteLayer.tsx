import { useEffect, useState } from "react";
import {
  HEADER_COPY,
  headerCopyStartIndex,
  rotateHeaderCopy,
  type HeaderCopyBank,
} from "@/lib/headerCopy";

const BANK_META: Record<HeaderCopyBank, { label: string; wash: string; ink: string }> = {
  quotes: {
    label: "Motivational",
    wash: "radial-gradient(ellipse at 70% 40%, rgba(255,214,140,0.28), transparent 58%)",
    ink: "rgba(255,246,228,0.96)",
  },
  sceptic: {
    label: "Sceptic",
    wash: "radial-gradient(ellipse at 68% 45%, rgba(160,190,255,0.22), transparent 60%)",
    ink: "rgba(232,238,255,0.96)",
  },
  jokes: {
    label: "Joke",
    wash: "radial-gradient(ellipse at 72% 42%, rgba(255,210,120,0.24), transparent 58%)",
    ink: "rgba(255,248,230,0.96)",
  },
  qotd: {
    label: "Quote",
    wash: "radial-gradient(ellipse at 66% 48%, rgba(255,228,190,0.26), transparent 62%)",
    ink: "rgba(255,244,226,0.96)",
  },
};

const ROTATE_MS: Record<HeaderCopyBank, number> = {
  quotes: 8000,
  sceptic: 9000,
  jokes: 7500,
  qotd: 10000,
};

export function ChromeQuoteLayer({ bank, compact = false }: { bank: HeaderCopyBank; compact?: boolean }) {
  const [index, setIndex] = useState(() => headerCopyStartIndex(bank));
  const meta = BANK_META[bank];

  useEffect(() => {
    setIndex(headerCopyStartIndex(bank));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % HEADER_COPY[bank].length);
    }, ROTATE_MS[bank]);
    return () => window.clearInterval(id);
  }, [bank]);

  const text = rotateHeaderCopy(bank, index);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: meta.wash }} />
      <div
        className={`absolute flex min-w-0 flex-col justify-center ${
          compact
            ? "bottom-1.5 left-[30%] right-24 top-1.5"
            : "bottom-2 left-[36%] right-3 top-2 sm:left-[40%]"
        }`}
      >
        <p
          className={`font-semibold uppercase tracking-[0.18em] text-white/55 ${
            compact ? "mb-0.5 text-[8px]" : "mb-1 text-[9px]"
          }`}
        >
          {meta.label}
        </p>
        <p
          key={`${bank}-${index}`}
          className={`font-display font-semibold leading-snug drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)] ${
            compact ? "line-clamp-2 text-[11px]" : "line-clamp-3 text-[13px] sm:text-sm"
          }`}
          style={{ color: meta.ink }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
