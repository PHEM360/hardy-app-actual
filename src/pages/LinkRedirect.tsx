import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { Loader2, LinkIcon } from "lucide-react";
import { db } from "@/lib/firebase";

type Status = "loading" | "redirecting" | "not-found";

export default function LinkRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slug) {
        setStatus("not-found");
        return;
      }
      try {
        const snap = await getDoc(doc(db, "qrLinkSlugs", slug));
        const url = snap.exists() ? (snap.data().url as string | undefined) : undefined;
        if (cancelled) return;
        if (url) {
          setStatus("redirecting");
          window.location.replace(url);
        } else {
          setStatus("not-found");
        }
      } catch {
        if (!cancelled) setStatus("not-found");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-3 text-center max-w-xs">
        {status === "not-found" ? (
          <>
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-muted text-muted-foreground">
              <LinkIcon className="w-5 h-5" />
            </span>
            <p className="text-sm font-semibold text-foreground">This link isn't active</p>
            <p className="text-xs text-muted-foreground">
              It may have been changed or removed. Check the QR code again or contact whoever shared it.
            </p>
          </>
        ) : (
          <>
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Taking you there…</p>
          </>
        )}
      </div>
    </div>
  );
}
