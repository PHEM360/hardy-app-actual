// Deterministic colour coding for free-form document category strings (e.g. a
// company's customisable document categories). Same category text always maps
// to the same colour, and common category names get a hand-picked colour so
// they line up with the fixed household document categories.

export type CategoryColorClasses = { text: string; bg: string; dot: string };

const PALETTE: CategoryColorClasses[] = [
  { text: "text-emerald-700", bg: "bg-emerald-100", dot: "bg-emerald-500" },
  { text: "text-blue-700", bg: "bg-blue-100", dot: "bg-blue-500" },
  { text: "text-amber-700", bg: "bg-amber-100", dot: "bg-amber-500" },
  { text: "text-violet-700", bg: "bg-violet-100", dot: "bg-violet-500" },
  { text: "text-rose-700", bg: "bg-rose-100", dot: "bg-rose-500" },
  { text: "text-sky-700", bg: "bg-sky-100", dot: "bg-sky-500" },
  { text: "text-orange-700", bg: "bg-orange-100", dot: "bg-orange-500" },
  { text: "text-teal-700", bg: "bg-teal-100", dot: "bg-teal-500" },
  { text: "text-fuchsia-700", bg: "bg-fuchsia-100", dot: "bg-fuchsia-500" },
  { text: "text-indigo-700", bg: "bg-indigo-100", dot: "bg-indigo-500" },
  { text: "text-lime-700", bg: "bg-lime-100", dot: "bg-lime-500" },
  { text: "text-cyan-700", bg: "bg-cyan-100", dot: "bg-cyan-500" },
];

const NEUTRAL: CategoryColorClasses = { text: "text-gray-600", bg: "bg-gray-100", dot: "bg-gray-400" };

// Indexes into PALETTE for categories that show up by default across the app
// (companies' DEFAULT_DOCUMENT_CATEGORIES plus household's fixed set), so the
// "obvious" ones get a colour that reads as intentional rather than random.
const NAMED: Record<string, number> = {
  receipt: 0,
  invoice: 1,
  warranty: 1,
  certificate: 2,
  statement: 2,
  contract: 4,
  insurance: 5,
  id: 9,
  manual: 3,
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getCategoryColorClasses(category?: string | null): CategoryColorClasses {
  const key = (category ?? "").trim().toLowerCase();
  if (!key || key === "other") return NEUTRAL;
  const named = NAMED[key];
  if (named !== undefined) return PALETTE[named];
  return PALETTE[hashString(key) % PALETTE.length];
}
