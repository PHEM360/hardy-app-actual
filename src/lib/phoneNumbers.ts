export function formatUkNumber(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return `+${raw.slice(1).replace(/\D/g, "")}`;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) return `+44${digits.slice(1)}`;
  if (digits.length === 10) return `+44${digits}`;
  if (digits.startsWith("44") && digits.length >= 11) return `+${digits}`;
  if (digits.length >= 8) return `+${digits}`;
  return digits;
}

export function prettyNumber(input: string) {
  const e164 = formatUkNumber(input);
  if (e164.startsWith("+44") && e164.length === 13) {
    const rest = e164.slice(3);
    return `0${rest.slice(0, 4)} ${rest.slice(4, 7)} ${rest.slice(7)}`;
  }
  return e164 || input;
}

export function threadKey(a: string, b: string) {
  const left = formatUkNumber(a);
  const right = formatUkNumber(b);
  return [left, right].sort().join("|");
}
