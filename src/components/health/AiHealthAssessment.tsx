import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Loader2, AlertCircle, Sparkles, Activity, Scale, Ruler,
  Heart, ChevronDown, ChevronUp, RefreshCw, CheckCircle2, Info,
  Pill, User, FlaskConical, ClipboardList, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAiConfig } from "@/hooks/useAiConfig";
import { differenceInDays, startOfDay, parseISO, format } from "date-fns";
import type { WeightEntry, HeightEntry, BPEntry, MeasurementEntry } from "@/hooks/useWeightTracker";
import type { Medication } from "@/hooks/useMeds";
import type { HealthProfile } from "@/hooks/useHealthProfile";
import { ACTIVITY_LABELS, resolvedAge } from "@/hooks/useHealthProfile";
import type { SubstanceLog } from "@/hooks/useSubstances";

// ── Extra optional fields ────────────────────────────────────────────────────
interface ExtraFields {
  cholesterolTotal?: string;
  cholesterolHDL?: string;
  cholesterolLDL?: string;
  sleepHoursPerNight?: string;
  stressLevel?: string;
  exerciseMinPerWeek?: string;
  exerciseType?: string;
  dietType?: string;
  familyHeartDisease?: boolean;
  familyDiabetes?: boolean;
  familyCancer?: boolean;
  pregnant?: boolean;
  recentIllness?: string;
}

interface Props {
  entries: WeightEntry[];
  heightEntries: HeightEntry[];
  bpEntries: BPEntry[];
  measurements: MeasurementEntry[];
  medications: Medication[];
  profile?: HealthProfile;
  substanceLogs?: SubstanceLog[];
}

function bmiLabel(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25)   return "Normal weight";
  if (bmi < 30)   return "Overweight";
  return "Obese";
}

function bpRiskLabel(sys: number, dia: number): string {
  if (sys < 90 || dia < 60)    return "Low";
  if (sys <= 120 && dia <= 80) return "Normal";
  if (sys <= 129 && dia <= 80) return "Elevated";
  if (sys <= 139 || dia <= 89) return "Stage 1 High";
  return "Stage 2 High";
}

function bpColour(sys: number, dia: number): string {
  if (sys < 90 || dia < 60)    return "text-blue-500";
  if (sys <= 120 && dia <= 80) return "text-green-600";
  if (sys <= 129 && dia <= 80) return "text-yellow-600";
  if (sys <= 139 || dia <= 89) return "text-orange-500";
  return "text-red-600";
}

function AssessmentRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-0.5 text-sm leading-relaxed text-card-foreground">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        const headerMatch = line.match(/^\*\*(.+)\*\*\s*$/);
        if (headerMatch) {
          return (
            <h4 key={i} className="font-bold text-[13px] text-foreground mt-5 mb-1.5 pb-1 border-b border-border/30">
              {headerMatch[1]}
            </h4>
          );
        }
        if (line.trim().startsWith("- ") || line.trim().startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2 ml-2 text-[13px]">
              <span className="text-violet-500 mt-0.5 flex-shrink-0">•</span>
              <span>{line.trim().replace(/^[-•]\s*/, "")}</span>
            </div>
          );
        }
        const numMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return (
            <div key={i} className="flex gap-2 ml-2 text-[13px]">
              <span className="text-violet-600 font-bold flex-shrink-0 text-xs mt-0.5 w-5">{numMatch[1]}.</span>
              <span>{numMatch[2]}</span>
            </div>
          );
        }
        if (line.trim().startsWith("*") && line.trim().endsWith("*") && !line.trim().startsWith("**")) {
          return <p key={i} className="text-[11px] text-muted-foreground italic mt-3">{line.replace(/\*/g, "")}</p>;
        }
        return <p key={i} className="text-[13px]">{line}</p>;
      })}
    </div>
  );
}

function DataBadge({ label, value, icon }: { label: string; value: boolean; icon: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border ${
      value
        ? "bg-green-50 border-green-200 text-green-700"
        : "bg-muted/40 border-border/40 text-muted-foreground"
    }`}>
      {value ? <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" /> : <div className="w-3 h-3 rounded-full border border-border/50 flex-shrink-0" />}
      {icon}
      {label}
    </div>
  );
}

export default function AiHealthAssessment({
  entries, heightEntries, bpEntries, measurements, medications, profile, substanceLogs,
}: Props) {
  const { callGemini, loading: keyLoading, apiKey } = useAiConfig();
  const [assessment, setAssessment] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExtra, setShowExtra] = useState(false);
  const [extra, setExtra] = useState<ExtraFields>({});
  const resultRef = useRef<HTMLDivElement>(null);

  const latestWeight = entries[entries.length - 1];
  const latestHeight = heightEntries[heightEntries.length - 1];
  const latestBP     = bpEntries[bpEntries.length - 1];
  const latestMeas   = measurements[measurements.length - 1];
  const activeMeds   = medications.filter((m) => m.active);
  const age          = profile ? resolvedAge(profile) : undefined;

  const bmi = latestWeight && latestHeight
    ? latestWeight.weight / Math.pow(latestHeight.height / 100, 2)
    : null;

  const dataAvailable = {
    weight:      !!latestWeight,
    height:      !!latestHeight,
    bp:          bpEntries.length > 0,
    measurements:measurements.length > 0,
    demographics:!!(age || profile?.sex),
    meds:        medications.length > 0,
    history:     !!(profile?.pastConditions?.length || profile?.familyHistory?.length),
    substances:  !!(substanceLogs && substanceLogs.length > 0),
  };
  const dataCount = Object.values(dataAvailable).filter(Boolean).length;

  const buildPrompt = useCallback((): string => {
    const lines: string[] = [];

    if (latestWeight) lines.push(`Weight: ${latestWeight.weight} kg (logged ${format(parseISO(latestWeight.date), "d MMM yyyy")})`);
    if (latestHeight) lines.push(`Height: ${latestHeight.height} cm`);
    if (bmi)          lines.push(`BMI: ${bmi.toFixed(1)} (${bmiLabel(bmi)})`);

    if (latestBP) {
      lines.push(`Latest Blood Pressure: ${latestBP.systolic}/${latestBP.diastolic} mmHg — ${bpRiskLabel(latestBP.systolic, latestBP.diastolic)}`);
      if (latestBP.heartRate) lines.push(`Resting Heart Rate: ${latestBP.heartRate} bpm`);
    }
    if (bpEntries.length >= 3) {
      const recent = bpEntries.slice(-6);
      const avgSys = Math.round(recent.reduce((s, e) => s + e.systolic, 0) / recent.length);
      const avgDia = Math.round(recent.reduce((s, e) => s + e.diastolic, 0) / recent.length);
      lines.push(`Average BP (last ${recent.length} readings): ${avgSys}/${avgDia} mmHg`);
      lines.push(`Highest systolic in recent readings: ${Math.max(...recent.map((e) => e.systolic))} mmHg`);
    }

    if (latestMeas) {
      if (latestMeas.chestCm) lines.push(`Chest: ${latestMeas.chestCm} cm`);
      if (latestMeas.waistCm) lines.push(`Waist: ${latestMeas.waistCm} cm`);
      if (latestMeas.hipCm)   lines.push(`Hip: ${latestMeas.hipCm} cm`);
      if (latestMeas.waistCm && latestHeight)
        lines.push(`Waist-to-Height ratio: ${(latestMeas.waistCm / latestHeight.height).toFixed(2)} (healthy < 0.5)`);
      if (latestMeas.waistCm && latestMeas.hipCm)
        lines.push(`Waist-to-Hip ratio: ${(latestMeas.waistCm / latestMeas.hipCm).toFixed(2)}`);
    }

    if (entries.length >= 2) {
      const diff = entries[entries.length - 1].weight - entries[0].weight;
      const daySpan = differenceInDays(parseISO(entries[entries.length - 1].date), parseISO(entries[0].date));
      lines.push(`Weight change over ${daySpan} days: ${diff > 0 ? "+" : ""}${diff.toFixed(1)} kg`);
    }
    if (entries.length >= 4) {
      const r = entries.slice(-3);
      const t = r[r.length - 1].weight - r[0].weight;
      lines.push(`Recent weight trend (last 3 entries): ${t > 0 ? "+" : ""}${t.toFixed(1)} kg`);
    }

    if (profile) {
      if (age !== undefined)     lines.push(`Age: ${age} years old`);
      if (profile.sex)           lines.push(`Sex: ${profile.sex}`);
      if (profile.activityLevel) lines.push(`Activity level: ${ACTIVITY_LABELS[profile.activityLevel]}`);
      if (profile.smokingStatus) lines.push(`Smoking: ${profile.smokingStatus === "never" ? "Never smoked" : profile.smokingStatus === "ex" ? "Ex-smoker" : "Current smoker"}`);
      if (profile.alcoholUnitsPerWeek !== undefined)
        lines.push(`Alcohol: ${profile.alcoholUnitsPerWeek} units/week`);
      if (profile.diabetic) lines.push(`Diabetic: Yes`);
    }

    if (activeMeds.length > 0)
      lines.push(`Active medications: ${activeMeds.map((m) => `${m.name} ${m.dose}${m.unit}`).join(", ")}`);
    const inactiveMeds = medications.filter((m) => !m.active);
    if (inactiveMeds.length > 0)
      lines.push(`Past medications: ${inactiveMeds.map((m) => m.name).join(", ")}`);

    if (profile) {
      if (profile.pastConditions?.length)  lines.push(`Past/current conditions: ${profile.pastConditions.join(", ")}`);
      if (profile.familyHistory?.length)   lines.push(`Family history: ${profile.familyHistory.join("; ")}`);
      if (profile.allergies?.length)       lines.push(`Allergies: ${profile.allergies.join(", ")}`);
      if (profile.surgeries?.length)       lines.push(`Surgeries: ${profile.surgeries.join(", ")}`);
      if (profile.otherNotes)              lines.push(`Other notes: ${profile.otherNotes}`);
    }

    if (substanceLogs && substanceLogs.length > 0) {
      const now = startOfDay(new Date());
      const bySubstance = new Map<string, SubstanceLog[]>();
      substanceLogs.forEach((l) => {
        if (!bySubstance.has(l.name)) bySubstance.set(l.name, []);
        bySubstance.get(l.name)!.push(l);
      });
      const sLines: string[] = [];
      bySubstance.forEach((subLogs, name) => {
        const sorted = [...subLogs].sort((a, b) => b.date.localeCompare(a.date));
        const daysSince = differenceInDays(now, startOfDay(parseISO(sorted[0].date)));
        sLines.push(`${name}: last used ${daysSince} day(s) ago (${sorted[0].dose} ${sorted[0].unit}), ${sorted.length} recorded dose(s)`);
      });
      lines.push(`Tracked substance use: ${sLines.join("; ")}`);
    }

    if (extra.cholesterolTotal) lines.push(`Total cholesterol: ${extra.cholesterolTotal} mmol/L`);
    if (extra.cholesterolHDL)   lines.push(`HDL cholesterol: ${extra.cholesterolHDL} mmol/L`);
    if (extra.cholesterolLDL)   lines.push(`LDL cholesterol: ${extra.cholesterolLDL} mmol/L`);
    if (extra.sleepHoursPerNight) lines.push(`Average sleep: ${extra.sleepHoursPerNight} hours/night`);
    if (extra.stressLevel)      lines.push(`Self-reported stress level: ${extra.stressLevel}`);
    if (extra.exerciseMinPerWeek) lines.push(`Exercise: ~${extra.exerciseMinPerWeek} min/week${extra.exerciseType ? ` (${extra.exerciseType})` : ""}`);
    if (extra.dietType)         lines.push(`Diet type: ${extra.dietType}`);
    if (extra.familyHeartDisease) lines.push(`Family history: Heart disease in first-degree relative`);
    if (extra.familyDiabetes)    lines.push(`Family history: Type 2 diabetes in first-degree relative`);
    if (extra.familyCancer)      lines.push(`Family history: Cancer in first-degree relative`);
    if (extra.pregnant)          lines.push(`Currently pregnant: Yes`);
    if (extra.recentIllness)     lines.push(`Recent illness/surgery: ${extra.recentIllness}`);

    return lines.join("\n");
  }, [latestWeight, latestHeight, bmi, latestBP, latestMeas, medications, bpEntries, entries, profile, substanceLogs, extra, age, activeMeds]);

  const run = async () => {
    setRunning(true);
    setError(null);
    setAssessment("");
    try {
      const data = buildPrompt();
      if (!data.trim()) {
        setError("No health data recorded yet — add some measurements first.");
        return;
      }

      const systemPrompt = `You are an expert preventive medicine physician and health data analyst. You have been given comprehensive health data for a patient. Provide a thorough, evidence-based, personalised health assessment written in plain UK English. Be clinically honest but compassionate and empowering. Where data is missing for a calculation, note it but still provide the best estimate you can using available data.

Structure your response using EXACTLY these bold markdown headers (include the number):

**1. Overall Health Summary**
A clear 2–4 sentence snapshot of overall health status, noting the most important findings.

**2. Weight & Body Composition**
Detailed BMI analysis, healthy weight range for this height, body fat distribution insights from waist/hip measurements if available, visceral fat risk, target weight context.

**3. Cardiovascular Health**
Full BP analysis including trend over multiple readings if available, heart rate analysis, estimated cardiovascular fitness, pulse pressure if calculable. Note any patterns of concern.

**4. 10-Year Heart Attack Risk**
Use a Framingham-style risk framework. Incorporate age, sex, systolic BP, cholesterol (if provided — note if unknown), smoking status, diabetes, BMI. Give a specific percentage estimate range (e.g. "approximately 8–12%") with clear reasoning. Compare to the average risk for their age/sex group. Clearly state this is an estimate, not a clinical diagnosis.

**5. 10-Year Stroke Risk**
Estimate using available risk factors (hypertension, age, sex, smoking, diabetes, AF risk). Give a percentage estimate range. Flag any factors that elevate risk above baseline.

**6. Cancer Risk Assessment**
Based on available data (BMI, smoking, alcohol, family history if provided), note any elevated cancer risks. Be specific about cancer types and why risk is elevated. Note average population risk for context.

**7. Metabolic Health**
Assess insulin resistance risk, pre-diabetes/T2DM risk (using BMI, activity level, diet, family history), liver health, metabolic syndrome criteria met if applicable.

**8. Estimated Life Expectancy Impact**
Based on modifiable risk factors, estimate impact on life expectancy vs population average for this age and sex. Be specific about which factors are adding or subtracting years. Give a net estimate (e.g. "+2 to +4 years" or "-3 to -5 years from current trajectory").

**9. Medication & Substance Analysis**
Review all medications for relevance to health data. If substances are recorded, assess cardiovascular, neurological and dependency risk. Flag any drug interactions or concerns. If none, say so.

**10. Mental & Lifestyle Health**
Comment on sleep, stress, exercise and diet if data is available. Note the bidirectional relationship with physical health markers.

**11. Key Risk Factors (Ranked by Severity)**
Number each risk factor 1–N, ranked most to least serious. One sentence explanation each including what to do about it.

**12. Protective Factors & Wins**
What is already good — celebrate positive results and note protective lifestyle factors.

**13. Priority Action Plan**
Top 5 specific, concrete, measurable actions. Include target values where relevant (e.g. "Reduce resting BP below 130/85 mmHg via DASH diet, <2g sodium/day, 150 min moderate cardio/week").

**14. When to See a Doctor**
List any findings that warrant: (a) urgent review this week, (b) GP appointment within 1 month, (c) routine check at next annual review. Be specific about what to ask for.

---
*This assessment is AI-generated for informational purposes only and does not constitute medical advice, diagnosis or treatment. Always consult a qualified healthcare professional.*`;

      const result = await callGemini(
        systemPrompt,
        `Here is my health data:\n\n${data}\n\nPlease provide a comprehensive 14-section health assessment.`,
      );
      setAssessment(result);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (e: any) {
      setError(
        e?.message === "NO_KEY"
          ? "Gemini API key not configured. Go to Settings → AI Configuration to add your key."
          : (e?.message ?? "Assessment failed. Please try again."),
      );
    } finally {
      setRunning(false);
    }
  };

  const hasData = !!(latestWeight || latestBP || latestHeight);

  return (
    <div className="space-y-5 pb-6">

      {/* ── Header card ── */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-600/15 via-blue-500/8 to-indigo-500/8 border border-violet-200/50">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-violet-500/20 flex-shrink-0">
            <Brain className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-card-foreground">AI Health Assessment</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Powered by Gemini 2.0 Flash · 14-section analysis · UK clinical standards
            </p>
          </div>
        </div>

        {/* Data availability grid */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Data in assessment</p>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
              dataCount >= 6 ? "bg-green-100 text-green-700"
              : dataCount >= 3 ? "bg-yellow-100 text-yellow-700"
              : "bg-red-100 text-red-600"
            }`}>
              {dataCount}/8 categories
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <DataBadge label="Weight"       value={dataAvailable.weight}       icon={<Scale className="w-3 h-3 mr-0.5" />} />
            <DataBadge label="Height"       value={dataAvailable.height}       icon={<Ruler className="w-3 h-3 mr-0.5" />} />
            <DataBadge label="Blood Pressure" value={dataAvailable.bp}         icon={<Activity className="w-3 h-3 mr-0.5" />} />
            <DataBadge label="Measurements" value={dataAvailable.measurements} icon={<Ruler className="w-3 h-3 mr-0.5" />} />
            <DataBadge label="Demographics" value={dataAvailable.demographics} icon={<User className="w-3 h-3 mr-0.5" />} />
            <DataBadge label="Medications"  value={dataAvailable.meds}         icon={<Pill className="w-3 h-3 mr-0.5" />} />
            <DataBadge label="Med History"  value={dataAvailable.history}      icon={<ClipboardList className="w-3 h-3 mr-0.5" />} />
            <DataBadge label="Substances"   value={dataAvailable.substances}   icon={<FlaskConical className="w-3 h-3 mr-0.5" />} />
          </div>
        </div>

        {/* Quick stats strip */}
        {hasData && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="p-2.5 rounded-xl bg-white/60 border border-white/80 text-center">
              <Scale className="w-3.5 h-3.5 mx-auto mb-1 text-blue-500" />
              <p className="text-[10px] text-muted-foreground">BMI</p>
              <p className="text-sm font-bold">{bmi ? bmi.toFixed(1) : "—"}</p>
              {bmi && <p className="text-[9px] text-muted-foreground">{bmiLabel(bmi)}</p>}
            </div>
            <div className="p-2.5 rounded-xl bg-white/60 border border-white/80 text-center">
              <Heart className="w-3.5 h-3.5 mx-auto mb-1 text-red-500" />
              <p className="text-[10px] text-muted-foreground">Latest BP</p>
              <p className={`text-sm font-bold ${latestBP ? bpColour(latestBP.systolic, latestBP.diastolic) : ""}`}>
                {latestBP ? `${latestBP.systolic}/${latestBP.diastolic}` : "—"}
              </p>
              {latestBP && <p className="text-[9px] text-muted-foreground">{bpRiskLabel(latestBP.systolic, latestBP.diastolic)}</p>}
            </div>
            <div className="p-2.5 rounded-xl bg-white/60 border border-white/80 text-center">
              <Ruler className="w-3.5 h-3.5 mx-auto mb-1 text-green-500" />
              <p className="text-[10px] text-muted-foreground">Waist</p>
              <p className="text-sm font-bold">{latestMeas?.waistCm ? `${latestMeas.waistCm}cm` : "—"}</p>
              {latestMeas?.waistCm && latestHeight && (
                <p className={`text-[9px] font-semibold ${(latestMeas.waistCm / latestHeight.height) < 0.5 ? "text-green-600" : "text-orange-500"}`}>
                  W:H {(latestMeas.waistCm / latestHeight.height).toFixed(2)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Notices */}
        {!apiKey && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 mb-3 text-xs text-amber-700">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>Gemini API key not set. Go to <strong>Settings → AI Configuration</strong> to add your free key from <strong>aistudio.google.com</strong>.</span>
          </div>
        )}
        {!hasData && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border/40 mb-3 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>Log some health data first (weight, blood pressure, or height) to get a personalised assessment.</span>
          </div>
        )}

        {/* Optional extra fields */}
        <div className="border border-border/30 rounded-xl overflow-hidden mb-3">
          <button
            onClick={() => setShowExtra((x) => !x)}
            className="w-full flex items-center justify-between p-3 text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-3.5 h-3.5" />
              Add optional details for a more accurate assessment
              <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full font-semibold">
                improves accuracy
              </span>
            </div>
            {showExtra ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <AnimatePresence>
            {showExtra && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 border-t border-border/30 bg-muted/10 space-y-4">
                  <p className="text-[11px] text-muted-foreground">These are not saved — only used for this assessment run.</p>

                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cholesterol (mmol/L)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: "cholesterolTotal", label: "Total", placeholder: "5.0" },
                        { key: "cholesterolHDL",   label: "HDL",   placeholder: "1.4" },
                        { key: "cholesterolLDL",   label: "LDL",   placeholder: "3.0" },
                      ].map(({ key, label, placeholder }) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-[11px]">{label}</Label>
                          <Input type="number" step="0.1" placeholder={placeholder}
                            value={(extra as any)[key] ?? ""}
                            onChange={(e) => setExtra((x) => ({ ...x, [key]: e.target.value }))}
                            className="h-9 rounded-lg text-xs" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Lifestyle</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Sleep (hrs/night)</Label>
                        <Input type="number" step="0.5" min="0" max="24" placeholder="7.5"
                          value={extra.sleepHoursPerNight ?? ""}
                          onChange={(e) => setExtra((x) => ({ ...x, sleepHoursPerNight: e.target.value }))}
                          className="h-9 rounded-lg text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Exercise (min/week)</Label>
                        <Input type="number" step="10" min="0" placeholder="150"
                          value={extra.exerciseMinPerWeek ?? ""}
                          onChange={(e) => setExtra((x) => ({ ...x, exerciseMinPerWeek: e.target.value }))}
                          className="h-9 rounded-lg text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Exercise type</Label>
                        <Input placeholder="e.g. cycling, gym, walking"
                          value={extra.exerciseType ?? ""}
                          onChange={(e) => setExtra((x) => ({ ...x, exerciseType: e.target.value }))}
                          className="h-9 rounded-lg text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Stress level</Label>
                        <Select value={extra.stressLevel ?? ""} onValueChange={(v) => setExtra((x) => ({ ...x, stressLevel: v }))}>
                          <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="moderate">Moderate</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="very_high">Very high</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label className="text-[11px]">Diet type</Label>
                        <Select value={extra.dietType ?? ""} onValueChange={(v) => setExtra((x) => ({ ...x, dietType: v }))}>
                          <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="balanced">Balanced / mixed</SelectItem>
                            <SelectItem value="mediterranean">Mediterranean</SelectItem>
                            <SelectItem value="vegetarian">Vegetarian</SelectItem>
                            <SelectItem value="vegan">Vegan</SelectItem>
                            <SelectItem value="keto">Keto / low carb</SelectItem>
                            <SelectItem value="high_processed">High processed food</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Additional Family History</p>
                    <div className="space-y-2">
                      {[
                        { key: "familyHeartDisease", label: "Heart disease (parent / sibling)" },
                        { key: "familyDiabetes",     label: "Type 2 diabetes (parent / sibling)" },
                        { key: "familyCancer",       label: "Cancer (parent / sibling)" },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between">
                          <Label className="text-xs font-normal">{label}</Label>
                          <Switch checked={!!(extra as any)[key]} onCheckedChange={(v) => setExtra((x) => ({ ...x, [key]: v }))} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Other</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-normal">Currently pregnant</Label>
                        <Switch checked={!!extra.pregnant} onCheckedChange={(v) => setExtra((x) => ({ ...x, pregnant: v }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Recent illness / surgery</Label>
                        <Input placeholder="e.g. COVID March 2025, knee surgery 2024"
                          value={extra.recentIllness ?? ""}
                          onChange={(e) => setExtra((x) => ({ ...x, recentIllness: e.target.value }))}
                          className="h-9 rounded-lg text-xs" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 mb-3 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          onClick={run}
          disabled={running || keyLoading || !hasData || !apiKey}
          className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold gap-2 text-sm"
        >
          {running
            ? <><Loader2 className="w-4 h-4 animate-spin" />Analysing — this may take 20–30 seconds…</>
            : assessment
              ? <><RefreshCw className="w-4 h-4" />Re-run Full Assessment</>
              : <><Sparkles className="w-4 h-4" />Run Full AI Health Assessment</>
          }
        </Button>
      </div>

      {/* ── Result ── */}
      <AnimatePresence>
        {(running || assessment) && (
          <motion.div
            ref={resultRef}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl bg-card border border-border/50 shadow-soft"
          >
            {running ? (
              <div className="py-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto" />
                <p className="text-sm font-semibold text-card-foreground">Analysing your health data…</p>
                <p className="text-xs text-muted-foreground">Generating 14-section assessment with Gemini 2.0 Flash</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
                  <div className="p-1.5 rounded-lg bg-violet-500/15">
                    <Brain className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-card-foreground">Your Health Assessment</h3>
                    <p className="text-[11px] text-muted-foreground">Gemini 2.0 Flash · For informational purposes only</p>
                  </div>
                </div>
                <AssessmentRenderer text={assessment} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
