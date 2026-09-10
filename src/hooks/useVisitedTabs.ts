import { useEffect, useState } from "react";

/**
 * Tracks which tab ids have ever been the active one, so a tab-switching page
 * can mount each tab lazily (on first visit) but then keep it mounted and
 * hidden rather than unmounting it — unmounting destroys any in-progress form
 * state in that tab, which is what forced users to save before checking
 * another tab and switching back.
 */
export function useVisitedTabs<T>(active: T) {
  const [visited, setVisited] = useState<Set<T>>(() => new Set([active]));
  useEffect(() => {
    setVisited((prev) => (prev.has(active) ? prev : new Set(prev).add(active)));
  }, [active]);
  return (tab: T) => visited.has(tab);
}
