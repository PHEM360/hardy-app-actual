import { useEffect, useState } from "react";

/**
 * True if this tab "owns" a given exclusive lock name for its lifetime.
 * Used so that if /display somehow ends up open in two tabs on the same
 * device (a stray reload, a second window), only one of them actually plays
 * alarm sound — both can still show the visual state. Falls back to always
 * "true" on browsers without the Web Locks API, since a single active tab
 * is the overwhelmingly common case anyway.
 */
export function useTabLeader(lockName: string): boolean {
  const [isLeader, setIsLeader] = useState(!("locks" in navigator));

  useEffect(() => {
    if (!("locks" in navigator)) return;
    let cancelled = false;
    let released: (() => void) | null = null;

    navigator.locks
      .request(lockName, { mode: "exclusive" }, () => {
        if (cancelled) return Promise.resolve();
        setIsLeader(true);
        // Hold the lock until this effect is torn down (tab closes/unmounts).
        return new Promise<void>((resolve) => {
          released = resolve;
        });
      })
      .catch(() => {
        // Lock unsupported/unavailable — not fatal, just no dedupe this session.
      });

    return () => {
      cancelled = true;
      released?.();
    };
  }, [lockName]);

  return isLeader;
}
