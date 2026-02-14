import { useState, useMemo } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Home, Upload, Plus, Sparkles, Eye, EyeOff, Edit2, Archive, RotateCcw, Settings2 } from "lucide-react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface HHAccount {
  id: string;
  name: string;
  active: boolean;
  hidden: boolean;
}

interface HHEntry {
  id: string;
  accountId: string;
  date: string;
  balance: number;
}

const COLORS = [
  "hsl(36, 85%, 54%)", "hsl(168, 55%, 36%)", "hsl(215, 75%, 50%)",
  "hsl(280, 45%, 55%)", "hsl(152, 60%, 38%)",
];

// Mock data removed. Real household finance data should be added via the app and stored in Firestore.
const INITIAL_ACCOUNTS: HHAccount[] = [];

const INITIAL_ENTRIES: HHEntry[] = [];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-lg bg-card border border-border shadow-elevated p-3 max-w-[200px]">
        <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.stroke }} />
            <span className="text-xs text-muted-foreground">{p.name}</span>
            <span className="text-xs font-bold text-card-foreground ml-auto">£{p.value?.toLocaleString("en-GB")}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

type Tab = "balances" | "analysis";

const HouseholdFinance = () => {
  const [tab, setTab] = useState<Tab>("balances");
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [entries, setEntries] = useState(INITIAL_ENTRIES);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(accounts.map(a => a.id));
  const [addBalanceOpen, setAddBalanceOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [newBalanceAccountId, setNewBalanceAccountId] = useState("");
  const [newBalanceAmount, setNewBalanceAmount] = useState("");
  const [newBalanceDate, setNewBalanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [newAccountName, setNewAccountName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);

  const latestBalances = useMemo(() => {
    return accounts.map(acc => {
      const accEntries = entries.filter(e => e.accountId === acc.id).sort((a, b) => b.date.localeCompare(a.date));
      return { ...acc, latestBalance: accEntries[0]?.balance ?? 0 };
    });
  }, [accounts, entries]);

  const totalBalance = latestBalances.filter(a => a.active && !a.hidden).reduce((s, a) => s + a.latestBalance, 0);

  const chartData = useMemo(() => {
    const dates = [...new Set(entries.map(e => e.date))].sort();
    return dates.map(date => {
      const row: any = { date: new Date(date).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) };
      let total = 0;
      accounts.forEach(acc => {
        const entry = entries.find(e => e.accountId === acc.id && e.date === date);
        if (entry) {
          row[acc.id] = entry.balance;
          if (selectedAccounts.includes(acc.id)) total += entry.balance;
        }
      });
      row.total = total;
      return row;
    });
  }, [entries, accounts, selectedAccounts]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAddBalance = () => {
    const amount = parseFloat(newBalanceAmount);
    if (!newBalanceAccountId || isNaN(amount)) return;
    setEntries(prev => [...prev, { id: `he${Date.now()}`, accountId: newBalanceAccountId, date: newBalanceDate, balance: amount }]);
    setNewBalanceAmount("");
    setAddBalanceOpen(false);
  };

  const handleAddAccount = () => {
    if (!newAccountName.trim()) return;
    const id = `h${Date.now()}`;
    setAccounts(prev => [...prev, { id, name: newAccountName, active: true, hidden: false }]);
    setSelectedAccounts(prev => [...prev, id]);
    setNewAccountName("");
    setAddAccountOpen(false);
  };

  const handleAnalyse = () => {
    if (!csvText.trim()) return;
    setAnalysing(true);
    // Simulate AI analysis — in production, this would call your chosen AI model
    setTimeout(() => {
      setAnalysisResult(
        `## Statement Analysis\n\n` +
        `**Total transactions:** 47\n` +
        `**Period:** 01 Jan 2025 – 31 Jan 2025\n\n` +
        `### Spending Breakdown\n` +
        `- 🛒 **Groceries:** £482.30 (31%)\n` +
        `- 🏠 **Bills & Utilities:** £310.00 (20%)\n` +
        `- 🚗 **Transport:** £185.50 (12%)\n` +
        `- 🍽️ **Dining Out:** £142.00 (9%)\n` +
        `- 🎬 **Entertainment:** £98.00 (6%)\n` +
        `- 📦 **Subscriptions:** £67.97 (4%)\n` +
        `- 💰 **Other:** £268.23 (18%)\n\n` +
        `### Key Insights\n` +
        `- Groceries spending is **12% higher** than last month\n` +
        `- Possible duplicate: Tesco £67.42 on 10th & 11th Jan\n` +
        `- Electricity £92 is **35% above** 3-month average\n\n` +
        `*Connect an AI model to get real analysis of your statements.*`
      );
      setAnalysing(false);
    }, 2000);
  };

  return (
    <FeaturePageShell title="Household Finance" subtitle="Joint accounts & spending analysis" icon={<Home className="w-5 h-5" />}>
      {/* Tabs */}
      <div className="relative flex p-0.5 bg-primary/10 rounded-full mb-5 border border-primary/15">
        <motion.div
          className="absolute top-0.5 bottom-0.5 rounded-full"
          style={{ width: "calc(50% - 2px)", background: "linear-gradient(135deg, hsl(190, 29%, 35%) 0%, hsl(191, 33%, 50%) 100%)" }}
          animate={{ x: tab === "balances" ? 0 : "calc(100% + 2px)" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
        <button onClick={() => setTab("balances")} className={`relative flex-1 text-xs font-semibold py-2.5 rounded-full z-10 transition-colors ${tab === "balances" ? "text-white" : "text-muted-foreground"}`}>
          Account Balances
        </button>
        <button onClick={() => setTab("analysis")} className={`relative flex-1 text-xs font-semibold py-2.5 rounded-full z-10 transition-colors ${tab === "analysis" ? "text-white" : "text-muted-foreground"}`}>
          AI Analysis
        </button>
      </div>

      {tab === "balances" && (
        <>
          {/* Total */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl bg-gradient-warm mb-5">
            <p className="text-xs text-secondary-foreground/70 uppercase tracking-wider font-medium">Total Household</p>
            <p className="text-2xl font-bold font-display text-secondary-foreground mt-1">
              £{totalBalance.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </p>
          </motion.div>

          {/* Account Cards */}
          <div className="flex items-center justify-between px-1 mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accounts</h3>
            <div className="flex gap-2">
              <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Add</button>
                </DialogTrigger>
                <DialogContent className="max-w-sm mx-4">
                  <DialogHeader><DialogTitle className="font-display">New Account</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Account Name</Label>
                      <Input placeholder="e.g. Joint Savings" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} className="h-11 rounded-xl" />
                    </div>
                    <Button onClick={handleAddAccount} className="w-full h-11 rounded-xl bg-gradient-primary">Create</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
            {latestBalances.filter(a => !a.hidden).map((acc, i) => (
              <motion.button
                key={acc.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.03 * i }}
                onClick={() => toggleAccount(acc.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedAccounts.includes(acc.id)
                    ? "bg-card border-primary/30 shadow-soft"
                    : "bg-muted/30 border-border/30 opacity-60"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-[10px] text-muted-foreground uppercase truncate">{acc.name}</span>
                </div>
                <p className="text-sm font-bold font-display text-card-foreground">
                  £{acc.latestBalance.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                </p>
              </motion.button>
            ))}
          </div>

          {/* Chart */}
          <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Balance Over Time</h3>
              <Dialog open={addBalanceOpen} onOpenChange={setAddBalanceOpen}>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Log Balance</button>
                </DialogTrigger>
                <DialogContent className="max-w-sm mx-4">
                  <DialogHeader><DialogTitle className="font-display">Log Balance</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Account</Label>
                      <Select value={newBalanceAccountId} onValueChange={setNewBalanceAccountId}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>
                          {accounts.filter(a => a.active).map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={newBalanceDate} onChange={(e) => setNewBalanceDate(e.target.value)} className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>Balance (£)</Label>
                      <Input type="number" step="0.01" value={newBalanceAmount} onChange={(e) => setNewBalanceAmount(e.target.value)} className="h-11 rounded-xl" />
                    </div>
                    <Button onClick={handleAddBalance} className="w-full h-11 rounded-xl bg-gradient-primary">Save</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 18%, 86%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(220, 10%, 44%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(220, 10%, 44%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} width={42} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {accounts.filter(a => selectedAccounts.includes(a.id)).map((acc, i) => (
                    <Line key={acc.id} type="monotone" dataKey={acc.id} name={acc.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  ))}
                  <Line type="monotone" dataKey="total" name="Total" stroke="hsl(220, 20%, 14%)" strokeWidth={2.5} strokeDasharray="6 3" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {tab === "analysis" && (
        <>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="p-5 rounded-2xl text-white" style={{ background: "linear-gradient(135deg, hsl(190, 29%, 35%) 0%, hsl(191, 33%, 50%) 100%)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4" />
                <p className="text-sm font-semibold font-display">AI Statement Analysis</p>
              </div>
              <p className="text-xs opacity-80">Upload a CSV or paste bank statement data, then click analyse to get an AI-powered breakdown.</p>
            </div>

            <div className="space-y-3">
              <Textarea
                placeholder="Paste CSV or bank statement data here..."
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="rounded-xl min-h-[120px] text-xs"
              />

              <div className="flex gap-2">
                <button className="flex-1 p-3 rounded-xl border-2 border-dashed border-border hover:border-primary/30 transition-colors flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                  <Upload className="w-4 h-4" />
                  Upload CSV
                </button>
                <Button
                  onClick={handleAnalyse}
                  disabled={!csvText.trim() || analysing}
                  className="flex-1 h-auto rounded-xl bg-gradient-accent gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {analysing ? "Analysing..." : "Analyse"}
                </Button>
              </div>
            </div>

            {analysisResult && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft"
              >
                <div className="prose prose-sm max-w-none">
                  {analysisResult.split("\n").map((line, i) => {
                    if (line.startsWith("## ")) return <h2 key={i} className="text-sm font-bold font-display text-card-foreground mb-2">{line.replace("## ", "")}</h2>;
                    if (line.startsWith("### ")) return <h3 key={i} className="text-xs font-semibold text-card-foreground mt-3 mb-1">{line.replace("### ", "")}</h3>;
                    if (line.startsWith("- ")) return <p key={i} className="text-xs text-muted-foreground ml-2">{line}</p>;
                    if (line.startsWith("**")) return <p key={i} className="text-xs font-medium text-card-foreground">{line.replace(/\*\*/g, "")}</p>;
                    if (line.startsWith("*")) return <p key={i} className="text-[10px] text-muted-foreground italic mt-3">{line.replace(/\*/g, "")}</p>;
                    if (line.trim()) return <p key={i} className="text-xs text-muted-foreground">{line}</p>;
                    return null;
                  })}
                </div>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </FeaturePageShell>
  );
};

export default HouseholdFinance;