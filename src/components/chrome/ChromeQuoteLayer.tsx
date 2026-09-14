import type { HeaderCopyBank } from "@/lib/headerCopy";

const BANK_WASH: Record<HeaderCopyBank, string> = {
  quotes: "radial-gradient(ellipse at 62% 40%, rgba(255,214,140,0.32), transparent 62%)",
  sceptic: "radial-gradient(ellipse at 60% 45%, rgba(160,190,255,0.26), transparent 64%)",
  jokes: "radial-gradient(ellipse at 64% 42%, rgba(255,210,120,0.28), transparent 62%)",
  qotd: "radial-gradient(ellipse at 58% 48%, rgba(255,228,190,0.3), transparent 66%)",
};

/** Soft wash + oversized mark so the quote text in the header row feels printed on the chrome. */
export function ChromeQuoteLayer({ bank, compact = false }: { bank: HeaderCopyBank; compact?: boolean }) {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: BANK_WASH[bank] }} />
      <p
        className={`pointer-events-none absolute font-display font-semibold leading-none text-white/[0.12] ${
          compact ? "-right-1 top-0 text-[4.6rem]" : "right-2 top-0 text-[7.5rem] sm:text-[8.5rem]"
        }`}
      >
        “
      </p>
    </div>
  );
}
