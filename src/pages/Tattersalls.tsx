import { useState } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Building, Plus, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// Mock data removed. Real Tattersalls data should be added via the app and stored in Firestore.
const BALANCE_HISTORY = [];

const EXPENSES = [];

const DOCUMENTS = [];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-lg bg-card border border-border shadow-elevated p-2.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold font-display text-card-foreground">£{payload[0].value.toLocaleString("en-GB")}</p>
      </div>
    );
  }
  return null;
};

const Tattersalls = () => {
  const currentBalance = BALANCE_HISTORY[BALANCE_HISTORY.length - 1].balance;

  return (
    <FeaturePageShell title="Tattersalls" subtitle="Flat management & expenses" icon={<Building className="w-5 h-5" />}>
      {/* Balance Summary */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl bg-gradient-warm mb-5">
        <p className="text-xs text-secondary-foreground/70 uppercase tracking-wider font-medium">Joint Balance</p>
        <p className="text-2xl font-bold font-display text-secondary-foreground mt-1">
          £{currentBalance.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-secondary-foreground/60 mt-1">Shared between Hardy & Sarah</p>
      </motion.div>

      {/* Balance Chart */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Balance Over Time</h3>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={BALANCE_HISTORY}>
              <defs>
                <linearGradient id="tatGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(36, 80%, 56%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(36, 80%, 56%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 88%)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v}`} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="balance" stroke="hsl(36, 80%, 56%)" strokeWidth={2} fill="url(#tatGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Expenses */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Expenses</h3>
        <div className="rounded-xl bg-card border border-border/50 shadow-soft divide-y divide-border/30 overflow-hidden">
          {EXPENSES.map((exp, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground">{exp.desc}</p>
                <p className="text-[10px] text-muted-foreground">{exp.date} · {exp.type}</p>
              </div>
              <span className="text-sm font-bold font-display text-card-foreground">£{exp.amount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Documents */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Documents</h3>
        <div className="rounded-xl bg-card border border-border/50 shadow-soft divide-y divide-border/30 overflow-hidden">
          {DOCUMENTS.map((doc, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground truncate">{doc.name}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(doc.date).toLocaleDateString("en-GB")}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </FeaturePageShell>
  );
};

export default Tattersalls;
