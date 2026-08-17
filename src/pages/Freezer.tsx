import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Barcode, CalendarDays, Minus, PackageOpen, Plus, ScanLine, Search, Snowflake, Trash2 } from "lucide-react";
import { toast } from "sonner";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFreezer } from "@/hooks/useFreezer";
import { useSharedScope } from "@/hooks/useSharedScope";
import ShareAccessButton from "@/components/sharing/ShareAccessButton";
import SharedScopeSwitcher from "@/components/sharing/SharedScopeSwitcher";

type BarcodeDetectorInstance = { detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

const today = () => format(new Date(), "yyyy-MM-dd");

const Freezer = () => {
  const { scopeUserId, permission, pageTitle } = useSharedScope("freezer");
  const canEdit = permission === "edit";
  const { items, loading, addItem, updateItem, removeItem } = useFreezer(scopeUserId ?? undefined);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [dateAdded, setDateAdded] = useState(today());
  const [barcode, setBarcode] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const visibleItems = useMemo(() => [...items]
    .filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)), [items, search]);
  const total = items.reduce((sum, item) => sum + item.quantity, 0);

  const stopScanner = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const lookupBarcode = async (code: string) => {
    if (!code.trim()) return;
    setLookingUp(true);
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code.trim())}.json`);
      if (!response.ok) throw new Error("Lookup failed");
      const data = await response.json();
      if (data.status !== 1) {
        toast.info("Product not found — you can enter its name manually.");
        return;
      }
      const product = data.product ?? {};
      setName(product.product_name_en || product.product_name || product.generic_name_en || product.generic_name || "");
      setImageUrl(product.image_front_small_url || product.image_front_url || "");
      toast.success("Product identified");
    } catch {
      toast.error("Could not look up that barcode. Enter the product manually.");
    } finally {
      setLookingUp(false);
    }
  };

  const startScanner = async () => {
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      toast.info("Barcode scanning is not supported by this browser. You can type the barcode instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setScanning(true);
      requestAnimationFrame(async () => {
        const video = videoRef.current;
        if (!video) return stopScanner();
        video.srcObject = stream;
        await video.play();
        const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        const scan = async () => {
          if (!streamRef.current || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results[0]?.rawValue) {
              const code = results[0].rawValue;
              setBarcode(code);
              stopScanner();
              await lookupBarcode(code);
              return;
            }
          } catch { /* keep scanning while frames initialise */ }
          requestAnimationFrame(scan);
        };
        requestAnimationFrame(scan);
      });
    } catch {
      stopScanner();
      toast.error("Camera access was unavailable. You can type the barcode instead.");
    }
  };

  const resetForm = () => {
    stopScanner();
    setName(""); setQuantity(1); setDateAdded(today()); setBarcode(""); setImageUrl("");
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Please enter an item name.");
    setSaving(true);
    try {
      await addItem({ name: name.trim(), quantity: Math.max(1, quantity), dateAdded, ...(barcode && { barcode }), ...(imageUrl && { imageUrl }) });
      toast.success("Added to the freezer");
      setOpen(false); resetForm();
    } catch { toast.error("The item could not be added."); }
    finally { setSaving(false); }
  };

  const changeQuantity = async (id: string, current: number, next: number) => {
    if (next < 1) return;
    try { await updateItem(id, { quantity: next }); }
    catch { toast.error("Quantity could not be updated."); }
  };

  const remove = async (id: string) => {
    try { await removeItem(id); toast.success("Item removed"); }
    catch { toast.error("Item could not be removed."); }
  };

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle={`${total} ${total === 1 ? "item" : "items"} currently in stock`}
      icon={<Snowflake className="h-5 w-5" />}
      action={
        <div className="flex items-center gap-1.5">
          <SharedScopeSwitcher page="freezer" />
          <ShareAccessButton page="freezer" />
          {canEdit && (
            <Button size="sm" className="rounded-xl" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Add item</Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 pb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search freezer stock…" className="h-11 rounded-xl pl-9" />
        </div>

        {loading ? <div className="py-16 text-center text-sm text-muted-foreground">Loading freezer stock…</div> : visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <PackageOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
            <p className="font-semibold">{search ? "No matching items" : "Your freezer is empty"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{search ? "Try a different search." : "Add an item to start tracking your stock."}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleItems.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-soft">
                <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-xl bg-sky-50 dark:bg-sky-950/30">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-contain" /> : <Snowflake className="h-6 w-6 text-sky-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{item.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3 w-3" />Added {format(new Date(`${item.dateAdded}T12:00:00`), "d MMM yyyy")}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center rounded-lg border border-border">
                      <button aria-label={`Decrease ${item.name} quantity`} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={item.quantity <= 1} onClick={() => changeQuantity(item.id, item.quantity, item.quantity - 1)}><Minus className="h-3.5 w-3.5" /></button>
                      <input aria-label={`${item.name} quantity`} type="number" min="1" value={item.quantity} onChange={(e) => { const value = Number(e.target.value); if (value >= 1) changeQuantity(item.id, item.quantity, value); }} className="w-9 border-x border-border bg-transparent text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                      <button aria-label={`Increase ${item.name} quantity`} className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => changeQuantity(item.id, item.quantity, item.quantity + 1)}><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <button aria-label={`Remove ${item.name}`} onClick={() => remove(item.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetForm(); }}>
        <DialogContent aria-describedby={undefined} className="max-h-[90dvh] max-w-sm overflow-y-auto mx-4">
          <DialogHeader><DialogTitle>Add freezer item</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            {scanning && <div className="relative overflow-hidden rounded-xl bg-black"><video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" /><div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/80" /><Button type="button" variant="secondary" size="sm" className="absolute bottom-2 right-2" onClick={stopScanner}>Cancel</Button></div>}
            <div className="space-y-1.5"><Label htmlFor="freezer-barcode">Barcode (optional)</Label><div className="flex gap-2"><div className="relative flex-1"><Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="freezer-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or enter barcode" className="pl-9" /></div><Button type="button" variant="outline" size="icon" title="Scan barcode" onClick={startScanner}><ScanLine className="h-4 w-4" /></Button><Button type="button" variant="outline" onClick={() => lookupBarcode(barcode)} disabled={!barcode || lookingUp}>{lookingUp ? "Finding…" : "Find"}</Button></div></div>
            <div className="space-y-1.5"><Label htmlFor="freezer-name">Item name</Label><Input id="freezer-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken breasts" /></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="freezer-quantity">Quantity</Label><Input id="freezer-quantity" type="number" min="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} /></div><div className="space-y-1.5"><Label htmlFor="freezer-date">Date added</Label><Input id="freezer-date" type="date" value={dateAdded} onChange={(e) => setDateAdded(e.target.value)} /></div></div>
            <Button className="w-full" onClick={save} disabled={saving}>{saving ? "Adding…" : "Add to freezer"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
};

export default Freezer;
