import { useNavigate } from "react-router-dom";
import { Inbox } from "lucide-react";
import { useCaptureInbox } from "@/hooks/useCaptureInbox";
import { captureItemThumb, capturePagesLabel } from "@/lib/captureInbox";

export function UnallocatedInboxWidget({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const { items, loading } = useCaptureInbox();
  const expenses = items.filter((item) => item.kind === "expense").length;
  const documents = items.length - expenses;
  const preview = items.slice(0, compact ? 0 : 3);

  const summary = loading && !items.length
    ? "Loading…"
    : items.length === 0
      ? "Inbox is clear"
      : [
          expenses ? `${expenses} expense${expenses === 1 ? "" : "s"}` : "",
          documents ? `${documents} document${documents === 1 ? "" : "s"}` : "",
        ].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={() => navigate("/unallocated")}
      className={`flex h-full w-full min-w-0 flex-col text-left ${compact ? "items-center justify-center gap-1.5 px-2 py-3" : "gap-2 px-3 py-3"}`}
    >
      <div className={`flex min-w-0 ${compact ? "flex-col items-center gap-1.5" : "items-center gap-3"}`}>
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-sm">
          <Inbox className="h-5 w-5" />
          {items.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1 text-[10px] font-bold text-foreground shadow-sm">
              {items.length > 99 ? "99+" : items.length}
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className={`block font-display font-bold leading-tight ${compact ? "text-center text-[11px]" : "text-sm"}`}>
            Unallocated
          </span>
          <span className={`block text-muted-foreground ${compact ? "text-center text-[10px]" : "text-xs"}`}>
            {compact ? (items.length ? `${items.length} to sort` : "Clear") : summary}
          </span>
        </span>
      </div>
      {!compact && preview.length > 0 && (
        <div className="flex gap-1.5">
          {preview.map((item) => (
            <div key={item.id} className="h-10 w-10 overflow-hidden rounded-lg bg-muted">
              {captureItemThumb(item) ? (
                <img src={captureItemThumb(item) || ""} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-[9px] font-semibold text-muted-foreground">
                  {capturePagesLabel(item.files?.length || 0)}
                </span>
              )}
            </div>
          ))}
          {items.length > preview.length && (
            <span className="flex h-10 items-center rounded-lg px-1.5 text-[10px] font-semibold text-muted-foreground">
              +{items.length - preview.length}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
