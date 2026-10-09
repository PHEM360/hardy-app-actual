import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell, Bot, Cake, CalendarDays, CalendarRange, CheckSquare, Clock, CloudSun, Droplets, Flame, Image, Inbox,
  Lightbulb, Link2, ListChecks, MessageCircle, Moon, NotebookPen, PawPrint, Receipt, Smile, Sparkles, Sunrise,
  Target, TimerOff, Zap,
} from "lucide-react";

// Widgets still pass the emoji they always have; it is mapped to a proper
// icon here so every Today widget gets the same header without each one
// being rewritten. An unknown emoji is simply shown as it is.
const ICON_FOR_EMOJI: Record<string, LucideIcon> = {
  "🤖": Bot, "🎯": Target, "✅": CheckSquare, "🌅": Sunrise, "🔥": Flame, "💧": Droplets, "😊": Smile,
  "📝": NotebookPen, "☑️": ListChecks, "🌙": Moon, "📅": CalendarDays, "🎂": Cake, "🌤️": CloudSun,
  "⏰": TimerOff, "⚡": Zap, "🔔": Bell, "💬": MessageCircle, "🖼️": Image, "🌍": CloudSun, "🧾": Receipt,
  "✨": Sparkles, "🐾": PawPrint, "🗓️": CalendarRange, "🔗": Link2, "🕒": Clock, "💡": Lightbulb, "📥": Inbox,
};

/**
 * Header band for a Today widget: a solid block in the widget's own colour
 * (`--td-accent`, set by the widget shell in Today.tsx) with a white icon
 * chip and title. It bleeds to the card edges, so the widget root keeps its
 * usual `p-3`; pass `flush` when the parent has no padding of its own.
 */
export function TdHead({
  emoji,
  title,
  action,
  flush = false,
}: {
  emoji: string;
  title: string;
  action?: ReactNode;
  flush?: boolean;
}) {
  const Icon = ICON_FOR_EMOJI[emoji];
  return (
    <div
      className={`td-head band mb-2.5 flex flex-shrink-0 items-center justify-between gap-2 px-3 py-2 text-white ${flush ? "" : "-mx-3 -mt-3"}`}
      style={{
        backgroundImage:
          "linear-gradient(165deg, color-mix(in srgb, var(--td-accent, hsl(var(--primary))) 72%, white) 0%, var(--td-accent, hsl(var(--primary))) 58%, color-mix(in srgb, var(--td-accent, hsl(var(--primary))) 82%, #0b1220) 100%)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-white/15 text-[13px] leading-none ring-1 ring-inset ring-white/20">
          {Icon ? <Icon className="h-3.5 w-3.5" /> : emoji}
        </span>
        <p className="truncate text-[11px] font-bold uppercase tracking-[0.14em]">{title}</p>
      </div>
      {action && <div className="td-head-action flex flex-shrink-0 items-center gap-1">{action}</div>}
    </div>
  );
}
