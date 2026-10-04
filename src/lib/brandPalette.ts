/**
 * Hardy Hub's accent palette: deep jewel tones, chosen to read as premium
 * (think Wimbledon green and purple, British Airways navy and red) rather
 * than bright primaries. Use these for section bands, tiles and key blocks.
 * White text is readable on every one. See AGENTS.md "Colour".
 */
export const JEWEL = {
  ink: "#14213D",
  petrol: "#17475C",
  forest: "#1F4D3A",
  burgundy: "#6E1F2F",
  cobalt: "#22407A",
  aubergine: "#4A2A52",
  bronze: "#8A6424",
  slate: "#3B4759",
  oxblood: "#7A2E2A",
  teal: "#1B5E5A",
  indigo: "#3A2A5E",
  moss: "#4A5D23",
  plum: "#6B2248",
  marine: "#1C4A6E",
} as const;

/** The order to hand colours out in when a set of items each needs its own. */
export const JEWEL_CYCLE: string[] = [
  JEWEL.petrol, JEWEL.burgundy, JEWEL.forest, JEWEL.cobalt, JEWEL.aubergine, JEWEL.bronze,
  JEWEL.teal, JEWEL.oxblood, JEWEL.indigo, JEWEL.slate, JEWEL.moss, JEWEL.plum,
];

/** Fixed meanings. Good, warning (dark text on brass) and bad. */
export const STATUS_COLOR = {
  good: "#1F6B4F",
  warn: "#C9A24A",
  warnText: "#2A2110",
  bad: "#9B2C2C",
} as const;

/** The brass hairline that finishes header bands (the `band` CSS class uses the same value). */
export const BRASS = "#C6A15B";
