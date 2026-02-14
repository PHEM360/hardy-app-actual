import { useState } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Users, FileText, Shield, Calendar, ChevronDown, ChevronUp, Plus, Trash2, History, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

interface PolicyRecord {
  id: string;
  type: string;
  provider: string;
  policyNumber: string;
  startDate: string;
  endDate: string;
  monthlyPremium: number;
  addedBy: string;
  notes?: string;
  documents: HouseholdDocument[];
  current: boolean;
}

interface HouseholdDocument {
  id: string;
  name: string;
  category: string;
  date: string;
  linkedItemId?: string;
}

interface HouseholdMember {
  name: string;
  role: string;
}

const MEMBERS: HouseholdMember[] = [
  { name: "Hardy", role: "Admin" },
  { name: "Sarah", role: "Member" },
  { name: "Tom", role: "Member" },
  { name: "Emma", role: "Member" },
];

const INITIAL_POLICIES: PolicyRecord[] = [
  { id: "p1", type: "Home Insurance", provider: "Aviva", policyNumber: "AV-2024-55123", startDate: "2024-08-01", endDate: "2025-08-01", monthlyPremium: 42, addedBy: "Hardy", documents: [{ id: "d1", name: "Home Insurance Certificate", category: "Insurance", date: "2024-08-01", linkedItemId: "p1" }], current: true },
  { id: "p1h", type: "Home Insurance", provider: "LV=", policyNumber: "LV-2023-42100", startDate: "2023-08-01", endDate: "2024-07-31", monthlyPremium: 38, addedBy: "Hardy", documents: [], current: false },
  { id: "p2", type: "Car Insurance", provider: "Direct Line", policyNumber: "DL-2024-88210", startDate: "2024-05-15", endDate: "2025-05-15", monthlyPremium: 55, addedBy: "Hardy", documents: [], current: true, notes: "Hardy's car" },
  { id: "p3", type: "Car Insurance", provider: "Admiral", policyNumber: "AD-2024-91003", startDate: "2024-07-22", endDate: "2025-07-22", monthlyPremium: 38, addedBy: "Sarah", documents: [], current: true, notes: "Sarah's car" },
  { id: "p4", type: "Life Insurance", provider: "Legal & General", policyNumber: "LG-2020-44100", startDate: "2020-12-01", endDate: "2025-12-01", monthlyPremium: 28, addedBy: "Hardy", documents: [], current: true },
];

const INITIAL_DOCUMENTS: HouseholdDocument[] = [
  { id: "d1", name: "Home Insurance Certificate", category: "Insurance", date: "2024-08-01", linkedItemId: "p1" },
  { id: "d2", name: "Boiler Service Report", category: "Maintenance", date: "2024-11-15" },
  { id: "d3", name: "EPC Certificate", category: "Property", date: "2023-06-10" },
  { id: "d4", name: "Council Tax Bill 2024/25", category: "Tax", date: "2024-04-01" },
];

const CATEGORY_TILES = [
  { key: "home_insurance", label: "Home Insurance", emoji: "🏠", color: "hsl(188, 33%, 38%)", gradient: "linear-gradient(145deg, hsl(190, 25%, 88%) 0%, hsl(195, 20%, 82%) 100%)" },
  { key: "car_insurance", label: "Car Insurance", emoji: "🚗", color: "hsl(210, 28%, 40%)", gradient: "linear-gradient(145deg, hsl(210, 20%, 88%) 0%, hsl(215, 18%, 82%) 100%)" },
  { key: "life_insurance", label: "Life Insurance", emoji: "💚", color: "hsl(160, 50%, 36%)", gradient: "linear-gradient(145deg, hsl(165, 20%, 87%) 0%, hsl(170, 18%, 81%) 100%)" },
  { key: "utilities", label: "Utilities", emoji: "⚡", color: "hsl(25, 62%, 55%)", gradient: "linear-gradient(145deg, hsl(25, 25%, 88%) 0%, hsl(28, 22%, 82%) 100%)" },
  { key: "council_tax", label: "Council Tax", emoji: "🏛️", color: "hsl(200, 30%, 44%)", gradient: "linear-gradient(145deg, hsl(200, 18%, 87%) 0%, hsl(205, 16%, 81%) 100%)" },
  { key: "mortgage", label: "Mortgage", emoji: "🏦", color: "hsl(216, 19%, 30%)", gradient: "linear-gradient(145deg, hsl(215, 15%, 87%) 0%, hsl(218, 14%, 81%) 100%)" },
];

function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }

function matchCategory(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("home") && t.includes("insurance")) return "home_insurance";
  if (t.includes("car") && t.includes("insurance")) return "car_insurance";
  if (t.includes("life") && t.includes("insurance")) return "life_insurance";
  return "";
}

function getTileStyle(type: string) {
  const tile = CATEGORY_TILES.find(t => t.key === matchCategory(type));
  if (tile) return { emoji: tile.emoji, color: tile.color, gradient: tile.gradient };
  const t = type.toLowerCase();
  if (t.includes("car")) return { emoji: "🚗", color: "hsl(210, 28%, 40%)", gradient: "linear-gradient(145deg, hsl(210, 20%, 88%) 0%, hsl(215, 18%, 82%) 100%)" };
  if (t.includes("phone")) return { emoji: "📱", color: "hsl(200, 30%, 44%)", gradient: "linear-gradient(145deg, hsl(200, 18%, 87%) 0%, hsl(205, 16%, 81%) 100%)" };
  if (t.includes("pet") || t.includes("dog")) return { emoji: "🐾", color: "hsl(160, 50%, 36%)", gradient: "linear-gradient(145deg, hsl(165, 20%, 87%) 0%, hsl(170, 18%, 81%) 100%)" };
  return { emoji: "📋", color: "hsl(188, 33%, 38%)", gradient: "linear-gradient(145deg, hsl(190, 25%, 88%) 0%, hsl(195, 20%, 82%) 100%)" };
}

const Households = () => {
  const [policies, setPolicies] = useState(INITIAL_POLICIES);
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS);
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPolicy, setDetailPolicy] = useState<PolicyRecord | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyType, setHistoryType] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newType, setNewType] = useState("");
  const [newProvider, setNewProvider] = useState("");
  const [newPolicyNum, setNewPolicyNum] = useState("");
  const [newPremium, setNewPremium] = useState("");
  const [newEndDate, setNewEndDate] = useState("");

  const currentPolicies = policies.filter(p => p.current);
  const allDocuments = [
    ...documents,
    ...policies.flatMap(p => p.documents).filter(d => !documents.find(ed => ed.id === d.id)),
  ];

  const openDetail = (p: PolicyRecord) => {
    setDetailPolicy(p);
    setDetailOpen(true);
  };

  const openHistory = (type: string) => {
    setHistoryType(type);
    setHistoryOpen(true);
  };

  const historyRecords = policies.filter(p => p.type === historyType).sort((a, b) => b.startDate.localeCompare(a.startDate));

  const deletePolicy = (id: string) => {
    setPolicies(prev => prev.filter(p => p.id !== id));
  };

  const handleAdd = () => {
    if (!newType || !newProvider) return;
    const today = new Date().toISOString().split("T")[0];
    setPolicies(prev => [...prev, {
      id: `p${Date.now()}`,
      type: newType,
      provider: newProvider,
      policyNumber: newPolicyNum,
      startDate: today,
      endDate: newEndDate || today,
      monthlyPremium: parseFloat(newPremium) || 0,
      addedBy: "Hardy",
      documents: [],
      current: true,
    }]);
    setNewType(""); setNewProvider(""); setNewPolicyNum(""); setNewPremium(""); setNewEndDate("");
    setAddOpen(false);
  };

  return (
    <FeaturePageShell title="Hardy Household" subtitle="Documents, insurance & shared records" icon={<Users className="w-5 h-5" />}>
      {/* Members */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-gradient-hero mb-5">
        <div className="flex flex-wrap gap-2 justify-center">
          {MEMBERS.map((m) => (
            <span key={m.name} className="text-xs bg-primary-foreground/15 text-primary-foreground px-2.5 py-1 rounded-full font-medium">
              {m.name} {m.role === "Admin" && "👑"}
            </span>
          ))}
        </div>
      </motion.div>

      <div className="mb-5 p-4 rounded-2xl border border-border/50 shadow-soft" style={{ background: "linear-gradient(145deg, hsl(190, 20%, 92%) 0%, hsl(195, 18%, 88%) 100%)" }}>
        <div className="flex items-center gap-3 px-1 mb-3">
          <div className="h-px w-12 bg-foreground/25" />
          <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wider">General</h3>
          <div className="h-px w-12 bg-foreground/25" />
          <div className="flex-1" />
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-1 text-xs text-primary font-medium">
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CATEGORY_TILES.map((tile, i) => {
            const matching = currentPolicies.filter(p => matchCategory(p.type) === tile.key);
            const renewal = matching.length > 0 ? Math.min(...matching.map(p => daysUntil(p.endDate))) : null;
            return (
              <motion.button
                key={tile.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => {
                  if (matching.length > 0) openDetail(matching[0]);
                }}
                className="p-4 rounded-xl border border-border/40 shadow-soft text-left relative overflow-hidden hover:shadow-card transition-all active:scale-[0.98]"
                style={{ borderLeftWidth: 3, borderLeftColor: tile.color, background: tile.gradient }}
              >
                <span className="text-2xl mb-2 block">{tile.emoji}</span>
                <p className="text-xs font-semibold text-card-foreground">{tile.label}</p>
                {matching.length > 0 ? (
                  <>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {matching[0].provider} · {renewal !== null && renewal > 0 ? `${renewal}d` : renewal !== null ? "Due" : ""}
                    </p>
                    <p className="text-sm font-bold text-card-foreground mt-1">£{matching[0].monthlyPremium}/mo</p>
                  </>
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-0.5">Not set</p>
                )}
                {matching.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openHistory(matching[0].type); }}
                    className="absolute top-2 right-2 p-1 rounded-md hover:bg-muted/50 text-muted-foreground"
                  >
                    <History className="w-3 h-3" />
                  </button>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Per-Member Section */}
      {MEMBERS.map((member, mi) => {
        const memberPolicies = currentPolicies.filter(p => p.notes?.toLowerCase().includes(member.name.toLowerCase()) || p.addedBy === member.name);
        if (memberPolicies.length === 0) return null;
        const memberBgs = [
          "linear-gradient(145deg, hsl(25, 22%, 91%) 0%, hsl(28, 20%, 86%) 100%)",
          "linear-gradient(145deg, hsl(210, 18%, 91%) 0%, hsl(215, 16%, 86%) 100%)",
          "linear-gradient(145deg, hsl(165, 18%, 91%) 0%, hsl(170, 16%, 86%) 100%)",
          "linear-gradient(145deg, hsl(30, 20%, 91%) 0%, hsl(35, 18%, 86%) 100%)",
        ];
        return (
          <div key={member.name} className="mb-5 p-4 rounded-2xl border border-border/50 shadow-soft" style={{ background: memberBgs[mi % memberBgs.length] }}>
            <div className="flex items-center gap-3 px-1 mb-3">
              <div className="h-px w-12 bg-foreground/25" />
              <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wider">{member.name}'s Items</h3>
              <div className="h-px w-12 bg-foreground/25" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {memberPolicies.map((policy, i) => {
                const renewal = daysUntil(policy.endDate);
                const style = getTileStyle(policy.type);
                return (
                  <motion.button
                    key={policy.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => openDetail(policy)}
                    className="p-4 rounded-xl border border-border/40 shadow-soft text-left relative overflow-hidden hover:shadow-card transition-all active:scale-[0.98]"
                    style={{ borderLeftWidth: 3, borderLeftColor: style.color, background: style.gradient }}
                  >
                    <span className="text-2xl mb-2 block">{style.emoji}</span>
                    <p className="text-xs font-semibold text-card-foreground">{policy.type}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {policy.provider} · {renewal > 0 ? `${renewal}d` : "Due"}
                    </p>
                    <p className="text-sm font-bold text-card-foreground mt-1">£{policy.monthlyPremium}/mo</p>
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Documents */}
      <div className="mb-5">
        <div className="flex items-center justify-between px-1 mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documents</h3>
          <button className="flex items-center gap-1 text-xs text-primary font-medium">
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
        </div>
        <div className="rounded-xl border border-border/40 shadow-soft divide-y divide-border/30 overflow-hidden" style={{ background: "linear-gradient(145deg, hsl(32, 22%, 96%) 0%, hsl(28, 18%, 90%) 100%)" }}>
          {allDocuments.map((doc, i) => (
            <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5" style={{ background: i % 2 === 0 ? "transparent" : "hsl(30, 20%, 93% / 0.5)" }}>
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground truncate">{doc.name}</p>
                <p className="text-[10px] text-muted-foreground">{doc.category} · {format(new Date(doc.date), "d MMM yyyy")}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">{detailPolicy?.type}</DialogTitle></DialogHeader>
          {detailPolicy && (
            <div className="space-y-3 pt-2">
              {[
                ["Provider", detailPolicy.provider],
                ["Policy Number", detailPolicy.policyNumber],
                ["Monthly", `£${detailPolicy.monthlyPremium}`],
                ["Annual", `£${detailPolicy.monthlyPremium * 12}`],
                ["Start", format(new Date(detailPolicy.startDate), "d MMM yyyy")],
                ["End", format(new Date(detailPolicy.endDate), "d MMM yyyy")],
                ["Added by", detailPolicy.addedBy],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-xs text-muted-foreground">{l}</span>
                  <span className="text-xs font-medium text-card-foreground">{v}</span>
                </div>
              ))}
              {detailPolicy.notes && (
                <p className="text-xs text-muted-foreground italic">{detailPolicy.notes}</p>
              )}
              {detailPolicy.documents.length > 0 && (
                <div className="pt-2 border-t border-border/30">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Documents</p>
                  {detailPolicy.documents.map(d => (
                    <div key={d.id} className="flex items-center gap-2 py-1">
                      <FileText className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-card-foreground">{d.name}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => { openHistory(detailPolicy.type); setDetailOpen(false); }} className="flex-1 text-xs">
                  <History className="w-3 h-3 mr-1" /> History
                </Button>
                <Button variant="outline" size="sm" onClick={() => { deletePolicy(detailPolicy.id); setDetailOpen(false); }} className="text-xs text-destructive hover:text-destructive">
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader><DialogTitle className="font-display">{historyType} History</DialogTitle></DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Period</TableHead>
                  <TableHead className="text-[10px]">Provider</TableHead>
                  <TableHead className="text-[10px]">Policy #</TableHead>
                  <TableHead className="text-[10px] text-right">£/mo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRecords.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-[10px]">{format(new Date(r.startDate), "MMM yy")} – {format(new Date(r.endDate), "MMM yy")}</TableCell>
                    <TableCell className="text-[10px]">{r.provider}</TableCell>
                    <TableCell className="text-[10px] font-mono">{r.policyNumber}</TableCell>
                    <TableCell className="text-[10px] text-right font-bold">£{r.monthlyPremium}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Add Item</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_TILES.map(c => <SelectItem key={c.key} value={c.label}>{c.label}</SelectItem>)}
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Provider</Label>
              <Input value={newProvider} onChange={e => setNewProvider(e.target.value)} className="h-10 rounded-xl text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Policy #</Label>
                <Input value={newPolicyNum} onChange={e => setNewPolicyNum(e.target.value)} className="h-10 rounded-xl text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">£/month</Label>
                <Input type="number" value={newPremium} onChange={e => setNewPremium(e.target.value)} className="h-10 rounded-xl text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End / Renewal Date</Label>
              <Input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} className="h-10 rounded-xl text-sm" />
            </div>
            <Button onClick={handleAdd} className="w-full h-10 rounded-xl bg-gradient-primary">Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
};

export default Households;
