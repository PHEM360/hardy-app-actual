import { useEffect, useState } from "react";
import {
  HEADER_COPY,
  headerCopyStartIndex,
  rotateHeaderCopy,
  type HeaderCopyBank,
} from "@/lib/headerCopy";

const ROTATE_MS: Record<HeaderCopyBank, number> = {
  quotes: 8000,
  sceptic: 9000,
  jokes: 7500,
  qotd: 10000,
};

export const HEADER_COPY_LABEL: Record<HeaderCopyBank, string> = {
  quotes: "Motivational",
  sceptic: "Sceptic",
  jokes: "Joke",
  qotd: "Quote",
};

export function useRotatingHeaderCopy(bank: HeaderCopyBank | null | undefined) {
  const [index, setIndex] = useState(() => (bank ? headerCopyStartIndex(bank) : 0));

  useEffect(() => {
    if (!bank) return;
    setIndex(headerCopyStartIndex(bank));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % HEADER_COPY[bank].length);
    }, ROTATE_MS[bank]);
    return () => window.clearInterval(id);
  }, [bank]);

  if (!bank) return null;
  return {
    bank,
    label: HEADER_COPY_LABEL[bank],
    text: rotateHeaderCopy(bank, index),
    index,
  };
}
