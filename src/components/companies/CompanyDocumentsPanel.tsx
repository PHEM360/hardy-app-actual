import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { FileText } from "lucide-react";
import { db } from "@/lib/firebase";

type CompanyDocument = {
  id: string;
  name: string;
  category?: string;
  fileUrl?: string;
  fileType?: string;
  fileUrls?: string[];
};

export function CompanyDocumentsPanel({ companyId }: { companyId: string }) {
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    const q = query(collection(db, "companies", companyId, "documents"), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        setDocuments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyDocument)));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [companyId]);

  if (loading && !documents.length) {
    return <p className="text-sm text-muted-foreground">Loading documents…</p>;
  }

  if (!documents.length) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-8 text-center shadow-card">
        <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="font-semibold">No documents yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Add them from Home → Add expense or document, and pick this company.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {documents.map((docItem) => {
        const url = docItem.fileUrl || docItem.fileUrls?.[0];
        const image = (docItem.fileType || "").startsWith("image/");
        return (
          <a
            key={docItem.id}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card"
          >
            {url && image ? (
              <img src={url} alt="" className="h-32 w-full object-cover" />
            ) : (
              <div className="flex h-24 items-center justify-center bg-muted/40">
                <FileText className="h-7 w-7 text-muted-foreground" />
              </div>
            )}
            <p className={`truncate px-3 text-sm font-semibold ${docItem.category ? "pt-2" : "py-2"}`}>{docItem.name || "Document"}</p>
            {docItem.category && (
              <p className="truncate px-3 pb-2 text-[11px] text-muted-foreground">{docItem.category}</p>
            )}
          </a>
        );
      })}
    </div>
  );
}
