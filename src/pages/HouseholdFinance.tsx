import { useState, useMemo, useEffect } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Home, Upload, Plus, Sparkles, CalendarRange, Users, Share2, Settings2, Eye, EyeOff } from "lucide-react";
import { useActiveHousehold } from "@/hooks/useActiveHousehold";
import { useMyHouseholds } from "@/hooks/useHouseholds";
import { useHouseholdFinance } from "@/hooks/useHouseholdFinance";
import { useAppUsers } from "@/hooks/useAppUsers";
import HouseholdManagerSheet from "@/components/household/HouseholdManagerSheet";
import HouseholdSetupCard from "@/components/household/HouseholdSetupCard";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceArea } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ACCOUNT_TYPES, resolveAccountType } from "@/lib/financeAccounts";
import { AccountTypeFields } from "@/components/finance/AccountTypeFields";
import { useNavigate } from "react-router-dom";

const COLORS = [
  "hsl(36, 85%, 54%)", "hsl(168, 55%, 36%)", "hsl(215, 75%, 50%)",
  "hsl(280, 45%, 55%)", "hsl(152, 60%, 38%)",
];

const TAX_YEARS = [
  { label: "22/23", start: "2022-04-06", end: "2023-04-05" },
  { label: "23/24", start: "2023-04-06", end: "2024-04-05" },
  { label: "24/25", start: "2024-04-06", end: "2025-04-05" },
  { label: "25/26", start: "2025-04-06", end: "2026-04-05" },
  { label: "26/27", start: "2026-04-06", end: "2027-04-05" },
];

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
  const { activeHouseholdId, availableHouseholds, setActiveHouseholdId, hasExplicitHouseholds, loading: householdLoading } = useActiveHousehold();
  const { households } = useMyHouseholds();
  const appUsers = useAppUsers();
  const { accounts, entries, loading, addAccount, updateAccount, addBalanceEntry } = useHouseholdFinance();
  const [householdsOpen, setHouseholdsOpen] = useState(false);
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("balances");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [addBalanceOpen, setAddBalanceOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [newBalanceAccountId, setNewBalanceAccountId] = useState("");
  const [newBalanceAmount, setNewBalanceAmount] = useState("");
  const [newBalanceDate, setNewBalanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState("Current");
  const [newAccountCustomType, setNewAccountCustomType] = useState("");
  const [manageAccountId, setManageAccountId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [manageType, setManageType] = useState("Current");
  const [manageCustomType, setManageCustomType] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [showTaxYears, setShowTaxYears] = useState(true);

  useEffect(() => {
    setSelectedAccounts((prev) => {
      const ids = accounts.map((a) => a.id);
      if (prev.length === 0) return ids;
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !prev.includes(id));
      return [...kept, ...added];
    });
  }, [accounts]);

  const activeHousehold = households.find((h) => h.id === activeHouseholdId);
  const householdName = availableHouseholds.find((h) => h.id === activeHouseholdId)?.name || "Household";
  const memberNames = (activeHousehold?.memberIds ?? []).map((uid) => {
    const u = appUsers.find((a) => a.id === uid);
    return u?.name || u?.email || "Member";
  });

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
      const row: any = { date: new Date(date).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), rawDate: date };
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

  const taxYearAreas = useMemo(() => {
    if (chartData.length < 2) return [];
    return TAX_YEARS.map((ty, i) => {
      const start = chartData.find((d) => d.rawDate >= ty.start);
      const end = chartData.filter((d) => d.rawDate <= ty.end).pop();
      if (start && end && start.date !== end.date) return { x1: start.date, x2: end.date, label: ty.label, shade: i % 2 === 1 };
      return null;
    }).filter(Boolean);
  }, [chartData]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAddBalance = async () => {
    const amount = parseFloat(newBalanceAmount);
    if (!newBalanceAccountId || isNaN(amount)) return;
    await addBalanceEntry(newBalanceAccountId, newBalanceDate, amount);
    setNewBalanceAmount("");
    setAddBalanceOpen(false);
  };

  const handleAddAccount = async () => {
    if (!newAccountName.trim()) return;
    await addAccount(newAccountName, resolveAccountType(newAccountType, newAccountCustomType));
    setNewAccountName("");
    setNewAccountType("Current");
    setNewAccountCustomType("");
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

  if (householdLoading) {
    return (
      <FeaturePageShell title="Household Finance" subtitle="Shared with your household" icon={<Home className="w-5 h-5" />}>
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </FeaturePageShell>
    );
  }

  if (!hasExplicitHouseholds) {
    return (
      <FeaturePageShell title="Household Finance" subtitle="Shared with your household" icon={<Home className="w-5 h-5" />}>
        <HouseholdSetupCard
          title="Set up household finance"
          description="Name this household (or you’ll see a random ID). Then you can add accounts and invite the people who share it."
        />
      </FeaturePageShell>
    );
  }

  if (loading) {
    return (
      <FeaturePageShell title="Household Finance" subtitle="Shared with your household" icon={<Home className="w-5 h-5" />}>
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell
      title="Household Finance"
      subtitle={`${householdName} · shared with everyone in this household`}
      icon={<Home className="w-5 h-5" />}
      action={
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setHouseholdsOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full bg-muted/70 hover:bg-muted transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
          <button
            onClick={() => setHouseholdsOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full bg-muted/70 hover:bg-muted transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            Households
          </button>
        </div>
      }
    >
      {availableHouseholds.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {availableHouseholds.map((h) => (
            <button
              key={h.id}
              onClick={() => setActiveHouseholdId(h.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                h.id === activeHouseholdId
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {h.name}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => navigate("/finance")}
        className="w-full text-left rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/50 px-3.5 py-2.5 mb-4 transition-colors"
      >
        <p className="text-xs font-semibold text-foreground">This page is joint household finances</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Your personal accounts live on My Finances →
        </p>
      </button>

      <div className="rounded-xl border border-border/50 bg-muted/30 px-3.5 py-2.5 mb-4 text-xs text-muted-foreground">
        {memberNames.length > 0 ? (
          <>Shared with <span className="font-semibold text-foreground">{memberNames.join(", ")}</span>. Anyone in this household can view and edit these accounts.</>
        ) : (
          <>These accounts belong to this household. Add a partner from Households so they can view and edit them too.</>
        )}
      </div>

      {/* Tabs */}
      <div className="relative flex p-0.5 bg-primary/10 rounded-full mb-5 border border-primary/15">
        <motion.div
          className="absolute top-0.5 bottom-0.5 rounded-full"
          style={{ width: "calc(50% - 2px)", background: "var(--gradient-primary)" }}
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
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-gradient-warm inline-block" />
              Accounts
            </h3>
            <div className="flex gap-2">
              <button onClick={() => setShowHidden(!showHidden)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                {showHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showHidden ? "Hide closed" : "Show all"}
              </button>
              <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Add</button>
                </DialogTrigger>
                <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
                  <DialogHeader><DialogTitle className="font-display">New Account</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Account Name</Label>
                      <Input placeholder="e.g. Joint Savings" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} className="h-11 rounded-xl" />
                    </div>
                    <AccountTypeFields
                      types={[...ACCOUNT_TYPES]}
                      value={newAccountType}
                      onChange={setNewAccountType}
                      customValue={newAccountCustomType}
                      onCustomChange={setNewAccountCustomType}
                    />
                    <Button onClick={handleAddAccount} disabled={!newAccountName.trim()} className="w-full h-11 rounded-xl bg-gradient-primary">Create Account</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {accounts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8 mb-4">
              No joint accounts yet. Add one to start tracking household balances — everyone in this household will see them.
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
            {latestBalances.filter((a) => showHidden || !a.hidden).map((acc, i) => {
              const color = COLORS[i % COLORS.length];
              const isSelected = selectedAccounts.includes(acc.id);
              return (
                <motion.div
                  key={acc.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.03 * i }}
                  className={`rounded-2xl border-2 bg-card text-left transition-all relative group overflow-hidden ${
                    isSelected ? "shadow-card" : "shadow-soft"
                  } ${!acc.active ? "opacity-40" : ""}`}
                  style={{ borderColor: isSelected ? color : "hsl(var(--border))" }}
                >
                  <div className="h-1 w-full" style={{ background: color }} />
                  <div className="p-3 relative">
                    <button onClick={() => toggleAccount(acc.id)} className="w-full text-left">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center shadow-sm" style={{ backgroundColor: color }}>
                          <span className="w-2 h-2 rounded-full bg-white/90" />
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                          {acc.type || "Account"}
                        </span>
                      </div>
                      <p className="text-base font-bold font-display text-card-foreground">
                        £{acc.latestBalance.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{acc.name}</p>
                    </button>
                    <button
                      onClick={() => {
                        setManageAccountId(acc.id);
                        setRenameValue(acc.name);
                        if ((ACCOUNT_TYPES as readonly string[]).includes(acc.type) || acc.type === "Other") {
                          setManageType(acc.type || "Current");
                          setManageCustomType("");
                        } else {
                          setManageType("Other");
                          setManageCustomType(acc.type || "");
                        }
                      }}
                      className="absolute top-2 right-2 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Manage account"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <Dialog open={!!manageAccountId} onOpenChange={(o) => { if (!o) setManageAccountId(null); }}>
            <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
              <DialogHeader><DialogTitle className="font-display">Manage account</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <AccountTypeFields
                  types={[...ACCOUNT_TYPES]}
                  value={manageType}
                  onChange={setManageType}
                  customValue={manageCustomType}
                  onCustomChange={setManageCustomType}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-10 rounded-xl"
                    onClick={async () => {
                      if (!manageAccountId) return;
                      const acc = accounts.find((a) => a.id === manageAccountId);
                      await updateAccount(manageAccountId, { hidden: !acc?.hidden });
                      setManageAccountId(null);
                    }}
                  >
                    {accounts.find((a) => a.id === manageAccountId)?.hidden ? "Reopen" : "Hide / close"}
                  </Button>
                  <Button
                    className="flex-1 h-10 rounded-xl bg-gradient-primary"
                    disabled={!renameValue.trim()}
                    onClick={async () => {
                      if (!manageAccountId) return;
                      await updateAccount(manageAccountId, {
                        name: renameValue.trim(),
                        type: resolveAccountType(manageType, manageCustomType),
                      });
                      setManageAccountId(null);
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Chart */}
          <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-gradient-primary inline-block" />
                Balance Over Time
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTaxYears(!showTaxYears)}
                  className={`h-7 px-2.5 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors ${showTaxYears ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  <CalendarRange className="w-3 h-3" />
                  Tax years
                </button>
                <Dialog open={addBalanceOpen} onOpenChange={setAddBalanceOpen}>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Log Balance</button>
                </DialogTrigger>
                <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
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
            </div>
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 18%, 86%)" />
                  {showTaxYears && (taxYearAreas as any[]).map((area, i) => (
                    <ReferenceArea key={i} x1={area.x1} x2={area.x2} fill="hsl(168, 55%, 36%)" fillOpacity={area.shade ? 0.09 : 0.03} label={{ value: area.label, position: "insideTopLeft", fontSize: 9, fill: "hsl(220, 10%, 44%)" }} />
                  ))}
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
            <div className="p-5 rounded-2xl text-white bg-gradient-primary">
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

      <HouseholdManagerSheet open={householdsOpen} onClose={() => setHouseholdsOpen(false)} />
    </FeaturePageShell>
  );
};

export default HouseholdFinance;