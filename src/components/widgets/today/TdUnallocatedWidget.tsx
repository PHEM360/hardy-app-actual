import { useNavigate } from "react-router-dom";
import { ChevronRight, FileText, Receipt } from "lucide-react";
import { useCaptureInbox } from "@/hooks/useCaptureInbox";
import { captureItemThumb, capturePagesLabel } from "@/lib/captureInbox";
import { TdHead } from "./TdHead";

export function TdUnallocatedWidget() {
  const navigate = useNavigate();
  const { items, loading } = useCaptureInbox();
  const preview = items.slice(0, 5);

  return (
    <div className="flex h-full flex-col p-3">
      <TdHead
        emoji="📥"
        title="Unallocated expenses / documents"
        action={
          <button
            type="button"
            onClick={() => navigate("/unallocated")}
            className="flex items-center gap-0.5 text-[11px] font-medium text-primary"
          >
            {items.length ? `${items.length} to sort` : "Open"}
            <ChevronRight className="h-3 w-3" />
          </button>
        }
      />
      <button
        type="button"
        onClick={() => navigate("/unallocated")}
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto text-left"
      >
        {loading && !items.length && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="text-xs text-muted-foreground">Inbox is clear. Snap receipts, then sort them here.</p>
        )}
        {preview.map((item) => (
          <div key={item.id} className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/60 px-2.5 py-1.5">
            <div className="h-8 w-8 overflow-hidden rounded-lg bg-muted">
              {captureItemThumb(item) ? (
                <img src={captureItemThumb(item) || ""} alt="" className="h-full w-full object-cover" />
              ) : item.kind === "expense" ? (
                <Receipt className="m-1.5 h-5 w-5 text-muted-foreground" />
              ) : (
                <FileText className="m-1.5 h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <p className="min-w-0 flex-1 truncate text-xs font-medium">{item.name || "Untitled"}</p>
            <span className="shrink-0 text-[10px] text-muted-foreground">{capturePagesLabel(item.files?.length || 0)}</span>
          </div>
        ))}
      </button>
    </div>
  );
}
