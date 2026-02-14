import { useState, useMemo } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Wallet, Plus, Eye, EyeOff, Edit2, Archive, RotateCcw, Table2, LineChart as LineChartIcon, Settings2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, Legend,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Account {
  id: string;
  name: string;
  type: string;
  active: boolean;
  hidden: boolean;
}

interface BalanceEntry {
  id: string;
  accountId: string;
  date: string;
  balance: number;
}

const COLORS = [
  "hsl(168, 55%, 36%)", "hsl(36, 85%, 54%)", "hsl(215, 75%, 50%)",
  "hsl(280, 45%, 55%)", "hsl(152, 60%, 38%)", "hsl(0, 72%, 51%)",
  "hsl(30, 80%, 50%)", "hsl(190, 70%, 45%)",
];

const INITIAL_ACCOUNTS: Account[] = [
  { id: "a1", name: "LISA", type: "LISA", active: true, hidden: false },
  { id: "a2", name: "Cash ISA", type: "ISA", active: true, hidden: false },
  { id: "a3", name: "Savings", type: "Savings", active: true, hidden: false },
  { id: "a4", name: "Current Account", type: "Current", active: true, hidden: false },
  { id: "a5", name: "Cash", type: "Cash", active: true, hidden: false },
];

const INITIAL_ENTRIES: BalanceEntry[] = [
  { id: "e1", accountId: "a1", date: "2023-04-10", balance: 6200 },
  { id: "e1b", accountId: "a1", date: "2023-07-01", balance: 6800 },
  { id: "e1c", accountId: "a1", date: "2023-10-01", balance: 7400 },
  { id: "e1d", accountId: "a1", date: "2024-01-01", balance: 7900 },
  { id: "e2", accountId: "a1", date: "2024-04-06", balance: 8200 },
  { id: "e3", accountId: "a1", date: "2024-07-01", balance: 8900 },
  { id: "e4", accountId: "a1", date: "2024-10-01", balance: 9600 },
  { id: "e5", accountId: "a1", date: "2025-01-01", balance: 10200 },
  { id: "e5b", accountId: "a1", date: "2025-02-01", balance: 10500 },
  { id: "e6", accountId: "a2", date: "2023-04-10", balance: 12000 },
  { id: "e6b", accountId: "a2", date: "2023-10-01", balance: 13200 },
  { id: "e7", accountId: "a2", date: "2024-04-06", balance: 15000 },
  { id: "e8", accountId: "a2", date: "2024-07-01", balance: 15400 },
  { id: "e9", accountId: "a2", date: "2024-10-01", balance: 15800 },
  { id: "e10", accountId: "a2", date: "2025-01-01", balance: 16100 },
  { id: "e10b", accountId: "a2", date: "2025-02-01", balance: 16300 },
  { id: "e11", accountId: "a3", date: "2023-04-10", balance: 4000 },
  { id: "e11b", accountId: "a3", date: "2023-10-01", balance: 4600 },
  { id: "e12", accountId: "a3", date: "2024-04-06", balance: 5000 },
  { id: "e13", accountId: "a3", date: "2024-07-01", balance: 5200 },
  { id: "e14", accountId: "a3", date: "2024-10-01", balance: 4800 },
  { id: "e15", accountId: "a3", date: "2025-01-01", balance: 5100 },
  { id: "e15b", accountId: "a3", date: "2025-02-01", balance: 5300 },
  { id: "e16", accountId: "a4", date: "2024-04-06", balance: 2100 },
  { id: "e17", accountId: "a4", date: "2024-07-01", balance: 2400 },
  { id: "e18", accountId: "a4", date: "2024-10-01", balance: 1900 },
  { id: "e19", accountId: "a4", date: "2025-01-01", balance: 2800 },
  { id: "e20", accountId: "a4", date: "2025-02-01", balance: 3200 },
  { id: "e21", accountId: "a5", date: "2024-04-06", balance: 200 },
  { id: "e22", accountId: "a5", date: "2024-07-01", balance: 150 },
  { id: "e23", accountId: "a5", date: "2024-10-01", balance: 100 },
  { id: "e24", accountId: "a5", date: "2025-01-01", balance: 250 },
  { id: "e25", accountId: "a5", date: "2025-02-01", balance: 145 },
];

const TAX_YEARS = [
  { label: "2022/23", start: "2022-04-06", end: "2023-04-05" },
  { label: "2023/24", start: "2023-04-06", end: "2024-04-05" },
  { label: "2024/25", start: "2024-04-06", end: "2025-04-05" },
  { label: "2025/26", start: "2025-04-06", end: "2026-04-05" },
];

const TIME_PERIODS = [
  { label: "6 months", months: 6 },
  { label: "1 year", months: 12 },
  { label: "2 years", months: 24 },
  { label: "All time", months: 0 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg bg-card border border-border shadow-elevated p-3 max-w-[220px]">
        <p className="text-xs text-muted-foreground font-medium mb-1.5">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.stroke }} />
            <span className="text-xs text-muted-foreground">{p.name}</span>
            <span className="text-xs font-bold text-card-foreground ml-auto">
              £{p.value?.toLocaleString("en-GB")}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

type ViewMode = "chart" | "table";

const Finance = () => {
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [entries, setEntries] = useState(INITIAL_ENTRIES);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(accounts.map((a) => a.id));
  const [timePeriod, setTimePeriod] = useState(0); // all time by default
  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  const [showHidden, setShowHidden] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addBalanceOpen, setAddBalanceOpen] = useState(false);
  const [manageAccountId, setManageAccountId] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState("Savings");
  const [newBalanceAccountId, setNewBalanceAccountId] = useState("");
  const [newBalanceAmount, setNewBalanceAmount] = useState("");
  const [newBalanceDate, setNewBalanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [renameValue, setRenameValue] = useState("");
  const [historyAccountFilter, setHistoryAccountFilter] = useState("all");

  const visibleAccounts = accounts.filter((a) => showHidden || !a.hidden);

  const chartData = useMemo(() => {
    const cutoff = timePeriod > 0
      ? new Date(Date.now() - timePeriod * 30 * 24 * 60 * 60 * 1000)
      : new Date(0);

    const relevantEntries = entries.filter((e) => new Date(e.date) >= cutoff);
    const dates = [...new Set(relevantEntries.map((e) => e.date))].sort();

    return dates.map((date) => {
      const row: any = { date: new Date(date).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), rawDate: date };
      let total = 0;
      accounts.forEach((acc) => {
        const entry = relevantEntries.find((e) => e.accountId === acc.id && e.date === date);
        if (entry) {
          row[acc.id] = entry.balance;
          if (selectedAccounts.includes(acc.id)) total += entry.balance;
        }
      });
      row.total = total;
      return row;
    });
  }, [entries, accounts, timePeriod, selectedAccounts]);

  const taxYearAreas = useMemo(() => {
    if (chartData.length < 2) return [];
    return TAX_YEARS.filter((_, i) => i % 2 === 1).map((ty) => {
      const start = chartData.find((d) => d.rawDate >= ty.start);
      const end = chartData.filter((d) => d.rawDate <= ty.end).pop();
      if (start && end) return { x1: start.date, x2: end.date, label: ty.label };
      return null;
    }).filter(Boolean);
  }, [chartData]);

  const latestBalances = useMemo(() => {
    return accounts.map((acc) => {
      const accEntries = entries.filter((e) => e.accountId === acc.id).sort((a, b) => b.date.localeCompare(a.date));
      return { ...acc, latestBalance: accEntries[0]?.balance ?? 0, latestDate: accEntries[0]?.date ?? "" };
    });
  }, [accounts, entries]);

  const totalBalance = latestBalances.filter((a) => a.active && !a.hidden).reduce((s, a) => s + a.latestBalance, 0);

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAddAccount = () => {
    if (!newAccountName.trim()) return;
    const id = `a${Date.now()}`;
    setAccounts((prev) => [...prev, { id, name: newAccountName, type: newAccountType, active: true, hidden: false }]);
    setSelectedAccounts((prev) => [...prev, id]);
    setNewAccountName("");
    setAddAccountOpen(false);
  };

  const handleAddBalance = () => {
    const amount = parseFloat(newBalanceAmount);
    if (!newBalanceAccountId || isNaN(amount)) return;
    setEntries((prev) => [...prev, { id: `e${Date.now()}`, accountId: newBalanceAccountId, date: newBalanceDate, balance: amount }]);
    setNewBalanceAmount("");
    setAddBalanceOpen(false);
  };

  const toggleHide = (id: string) => setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, hidden: !a.hidden } : a));
  const toggleActive = (id: string) => setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, active: !a.active } : a));
  const renameAccount = (id: string) => {
    if (!renameValue.trim()) return;
    setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, name: renameValue } : a));
    setManageAccountId(null);
    setRenameValue("");
  };

  const tableEntries = useMemo(() => {
    return entries
      .map((e) => ({ ...e, accountName: accounts.find((a) => a.id === e.accountId)?.name ?? "?" }))
      .filter((e) => historyAccountFilter === "all" || e.accountId === historyAccountFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, accounts, historyAccountFilter]);

  const managingAccount = manageAccountId ? accounts.find(a => a.id === manageAccountId) : null;
  const managingEntries = manageAccountId ? entries.filter(e => e.accountId === manageAccountId).sort((a, b) => b.date.localeCompare(a.date)) : [];

  return (
    <FeaturePageShell title="My Finances" subtitle="Account balances over time" icon={<Wallet className="w-5 h-5" />}>
      {/* Total Balance */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl border border-primary/15 shadow-card mb-5" style={{ background: "linear-gradient(135deg, hsl(190, 29%, 35%) 0%, hsl(191, 33%, 50%) 100%)" }}>
        <p className="text-xs text-white/70 uppercase tracking-wider font-medium">Total Balance</p>
        <p className="text-2xl font-bold font-display text-white mt-1">
          £{totalBalance.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-white/60 mt-1">
          Across {latestBalances.filter((a) => a.active && !a.hidden).length} active accounts
        </p>
      </motion.div>

      {/* Account Summary Cards — click to select in graph, long press to manage */}
      <div className="flex items-center justify-between px-1 mb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accounts</h3>
        <div className="flex gap-1.5">
          <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Add Account</button>
            </DialogTrigger>
            <DialogContent className="max-w-sm mx-4">
              <DialogHeader><DialogTitle className="font-display">New Account</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input placeholder="e.g. Stocks & Shares ISA" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newAccountType} onValueChange={setNewAccountType}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Current", "Savings", "ISA", "LISA", "Cash", "Investment", "Pension", "Other"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddAccount} className="w-full h-11 rounded-xl bg-gradient-primary">Create Account</Button>
              </div>
            </DialogContent>
          </Dialog>
          <button onClick={() => setShowHidden(!showHidden)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            {showHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showHidden ? "Hide closed" : "Show all"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-5">
        {latestBalances.filter((a) => showHidden || !a.hidden).map((acc, i) => {
          const color = COLORS[accounts.indexOf(acc) % COLORS.length];
          const isSelected = selectedAccounts.includes(acc.id);
          return (
            <motion.div
              key={acc.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.03 * i }}
              className={`p-3 rounded-xl border text-left transition-all relative group overflow-hidden ${
                isSelected
                  ? "bg-card shadow-card"
                  : "bg-muted/20 border-border/30 opacity-60"
              } ${!acc.active ? "opacity-40" : ""}`}
              style={{
                borderLeftWidth: 4,
                borderLeftColor: isSelected ? color : "transparent",
                borderColor: isSelected ? `${color}33` : undefined,
              }}
            >
              {/* Subtle color tint */}
              {isSelected && (
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none rounded-xl" style={{ background: color }} />
              )}
              <button onClick={() => toggleAccount(acc.id)} className="w-full text-left relative">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{acc.type}</span>
                </div>
                <p className="text-sm font-bold font-display text-card-foreground">
                  £{acc.latestBalance.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground truncate">{acc.name}</p>
              </button>
              <button
                onClick={() => { setManageAccountId(acc.id); setRenameValue(acc.name); }}
                className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-all text-muted-foreground"
              >
                <Settings2 className="w-3 h-3" />
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Controls Row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Select value={String(timePeriod)} onValueChange={(v) => setTimePeriod(Number(v))}>
          <SelectTrigger className="h-8 rounded-lg text-xs w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_PERIODS.map((tp) => (
              <SelectItem key={tp.months} value={String(tp.months)}>{tp.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button onClick={() => setViewMode(viewMode === "chart" ? "table" : "chart")} className="h-8 px-3 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
          {viewMode === "chart" ? <Table2 className="w-3.5 h-3.5" /> : <LineChartIcon className="w-3.5 h-3.5" />}
          {viewMode === "chart" ? "Table" : "Chart"}
        </button>

        <div className="flex-1" />

        <Dialog open={addBalanceOpen} onOpenChange={setAddBalanceOpen}>
          <DialogTrigger asChild>
            <button className="h-8 px-3 rounded-lg text-xs font-semibold bg-primary text-primary-foreground flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Log Balance
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-sm mx-4">
            <DialogHeader><DialogTitle className="font-display">Log Balance</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Account</Label>
                <Select value={newBalanceAccountId} onValueChange={setNewBalanceAccountId}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter((a) => a.active).map((a) => (
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
                <Input type="number" step="0.01" placeholder="e.g. 12500.00" value={newBalanceAmount} onChange={(e) => setNewBalanceAmount(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <Button onClick={handleAddBalance} className="w-full h-11 rounded-xl bg-gradient-primary">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Chart View */}
      {viewMode === "chart" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Balance Over Time</h3>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 18%, 86%)" />
                {taxYearAreas.map((area: any, i: number) => (
                  <ReferenceArea key={i} x1={area.x1} x2={area.x2} fill="hsl(168, 55%, 36%)" fillOpacity={0.06} label={{ value: area.label, position: "insideTopLeft", fontSize: 9, fill: "hsl(220, 10%, 44%)" }} />
                ))}
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(220, 10%, 44%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(220, 10%, 44%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} width={42} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {accounts.filter((a) => selectedAccounts.includes(a.id)).map((acc, i) => (
                  <Line key={acc.id} type="monotone" dataKey={acc.id} name={acc.name} stroke={COLORS[accounts.indexOf(acc) % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
                <Line type="monotone" dataKey="total" name="Total" stroke="hsl(220, 20%, 14%)" strokeWidth={2.5} strokeDasharray="6 3" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card border border-border/50 shadow-soft mb-5 overflow-hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-2">
            <Select value={historyAccountFilter} onValueChange={setHistoryAccountFilter}>
              <SelectTrigger className="h-7 rounded-lg text-[10px] w-32"><SelectValue placeholder="Filter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50 sticky top-0">
                  <th className="text-left p-3 font-semibold text-muted-foreground">Date</th>
                  <th className="text-left p-3 font-semibold text-muted-foreground">Account</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground">Balance</th>
                </tr>
              </thead>
              <tbody>
                {tableEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground">{new Date(entry.date).toLocaleDateString("en-GB")}</td>
                    <td className="p-3 font-medium text-card-foreground">{entry.accountName}</td>
                    <td className="p-3 text-right font-bold font-display text-card-foreground">
                      £{entry.balance.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Account Management Dialog — click on account card gear icon */}
      <Dialog open={!!manageAccountId} onOpenChange={(o) => !o && setManageAccountId(null)}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {managingAccount && (
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[accounts.indexOf(managingAccount!) % COLORS.length] }} />
              )}
              {managingAccount?.name}
            </DialogTitle>
          </DialogHeader>
          {managingAccount && (
            <div className="space-y-4 pt-2">
              {/* Rename */}
              <div className="space-y-2">
                <Label className="text-xs">Account Name</Label>
                <div className="flex gap-2">
                  <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="h-10 rounded-xl flex-1" />
                  <Button onClick={() => manageAccountId && renameAccount(manageAccountId)} size="sm" className="h-10 rounded-xl bg-gradient-primary">Rename</Button>
                </div>
              </div>
              {/* Status actions */}
              <div className="flex gap-2">
                <Button onClick={() => { toggleActive(manageAccountId!); }} variant="outline" size="sm" className="flex-1 h-9 rounded-lg gap-1.5 text-xs">
                  {managingAccount.active ? <Archive className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  {managingAccount.active ? "Close Account" : "Reopen Account"}
                </Button>
                <Button onClick={() => { toggleHide(manageAccountId!); }} variant="outline" size="sm" className="flex-1 h-9 rounded-lg gap-1.5 text-xs">
                  {managingAccount.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {managingAccount.hidden ? "Show" : "Hide"}
                </Button>
              </div>
              {/* History for this account */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Balance History</p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border/50">
                  <table className="w-full text-xs">
                    <tbody>
                      {managingEntries.map((entry) => (
                        <tr key={entry.id} className="border-b border-border/30 last:border-0">
                          <td className="p-2 text-muted-foreground">{new Date(entry.date).toLocaleDateString("en-GB")}</td>
                          <td className="p-2 text-right font-bold font-display text-card-foreground">£{entry.balance.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
};

export default Finance;