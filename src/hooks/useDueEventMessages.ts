import { useEffect } from "react";
import { toast } from "sonner";
import { useCalendar } from "@/hooks/useCalendar";
import { composerUrl, messageViaLabel } from "@/lib/eventMessages";

export function useDueEventMessages() {
  const { events, updateEvent } = useCalendar();

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      for (const event of events) {
        if (!event.id) continue;
        for (const plan of event.messagePlans || []) {
          if (plan.sentAt || !plan.body.trim()) continue;
          const due = new Date(plan.sendAt).getTime();
          if (!Number.isFinite(due) || due > now) continue;
          const key = `hh-msgplan:${event.id}:${plan.id}`;
          try {
            if (sessionStorage.getItem(key)) continue;
            sessionStorage.setItem(key, "1");
          } catch {
            /* ignore */
          }
          toast(`${messageViaLabel(plan.via)} ready for ${event.title}`, {
            description: plan.to ? `To ${plan.to}` : "Opens your usual messaging app.",
            duration: Infinity,
            action: {
              label: "Send",
              onClick: () => {
                window.open(composerUrl(plan), "_blank", "noopener,noreferrer");
                void updateEvent(event.id!, {
                  messagePlans: (event.messagePlans || []).map((item) =>
                    item.id === plan.id ? { ...item, sentAt: new Date().toISOString() } : item,
                  ),
                });
              },
            },
          });
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [events, updateEvent]);
}
