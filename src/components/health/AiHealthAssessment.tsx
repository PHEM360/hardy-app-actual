import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Loader2, AlertCircle, ChevronDown, ChevronUp, Sparkles, Activity, Scale, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAiConfig } from "@/hooks/useAiConfig";
import { differenceInDays, startOfDay, parseISO } from "date-fns";
import type { WeightEntry, HeightEntry, BPEntry, MeasurementEntry } from "@/hooks/useWeightTracker";
import type { Medication } from "@/hooks/useMeds";
import type { HealthProfile } from "@/hooks/useHealthProfile";
import { ACTIVITY_LABELS } from "@/hooks/useHealthProfile";
import type { SubstanceLog } from "@/hooks/useSubstances";

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
  if (sys < 90 || dia < 60)    return "Low (hypotension)";
  if (sys <= 120 && dia <= 80) return "Normal";
  if (sys <= 129 && dia <= 80) return "Elevated";
  if (sys <= 139 || dia <= 89) return "High Stage 1";
  return "High Stage 2 — medical attention advised";
}

export default function AiHealthAssessment({ entries, heightEntries, bpEntries, measurements, medications, profile, substanceLogs }: Props) {
  const { callGemini, loading: keyLoading, apiKey } = useAiConfig();
  const [assessment, setAssessment] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const latestWeight  = entries[entries.length - 1];
  const latestHeight  = heightEntries[heightEntries.length - 1];
  const latestBP      = bpEntries[bpEntries.length - 1];
  const latestMeas    = measurements[measurements.length - 1];

  const bmi = latestWeight && latestHeight
    ? (latestWeight.weight / Math.pow(latestHeight.height / 100, 2))
    : null;

  const buildPrompt = useCallback((): string => {
    const lines: string[] = [];

    // --- Biometrics ---
    if (latestWeight)  lines.push(`Weight: ${latestWeight.weight} kg`);
    if (latestHeight)  lines.push(`Height: ${latestHeight.height} cm`);
    if (bmi)           lines.push(`BMI: ${bmi.toFixed(1)} (${bmiLabel(bmi)})`);
    if (latestBP) {
      lines.push(`Latest Blood Pressure: ${latestBP.systolic}/${latestBP.diastolic} mmHg — ${bpRiskLabel(latestBP.systolic, latestBP.diastolic)}`);
      if (latestBP.heartRate) lines.push(`Resting Heart Rate: ${latestBP.heartRate} bpm`);
    }
    if (latestMeas) {
      if (latestMeas.chestCm)  lines.push(`Chest circumference: ${latestMeas.chestCm} cm`);
      if (latestMeas.waistCm)  lines.push(`Waist circumference: ${latestMeas.waistCm} cm`);
      if (latestMeas.hipCm)    lines.push(`Hip circumference: ${latestMeas.hipCm} cm`);
      if (latestMeas.waistCm && latestHeight)
        lines.push(`Waist-to-Height ratio: ${(latestMeas.waistCm / latestHeight.height).toFixed(2)} (healthy < 0.5)`);
      if (latestMeas.waistCm && latestMeas.hipCm)
        lines.push(`Waist-to-Hip ratio: ${(latestMeas.waistCm / latestMeas.hipCm).toFixed(2)}`);
    }

    // --- Trends ---
    if (bpEntries.length >= 3) {
      const recent = bpEntries.slice(-5);
      const avgSys = Math.round(recent.reduce((s, e) => s + e.systolic, 0) / recent.length);
      const avgDia = Math.round(recent.reduce((s, e) => s + e.diastolic, 0) / recent.length);
      lines.push(`Average BP over last ${recent.length} readings: ${avgSys}/${avgDia} mmHg`);
    }
    if (entries.length >= 2) {
      const diff = entries[entries.length - 1].weight - entries[0].weight;
      lines.push(`Weight change since first record: ${diff > 0 ? "+" : ""}${diff.toFixed(1)} kg`);
    }
    if (entries.length >= 4) {
      const recent3 = entries.slice(-3);
      const trend = recent3[recent3.length - 1].weight - recent3[0].weight;
      lines.push(`Recent weight trend (last 3 entries): ${trend > 0 ? "+" : ""}${trend.toFixed(1)} kg`);
    }

    // --- Demographics ---
    if (profile) {
      if (profile.age)           lines.push(`Age: ${profile.age}`);
      if (profile.sex)           lines.push(`Sex: ${profile.sex}`);
      if (profile.activityLevel) lines.push(`Activity level: ${ACTIVITY_LABELS[profile.activityLevel]}`);
      if (profile.smokingStatus) lines.push(`Smoking status: ${profile.smokingStatus === "never" ? "Never smoked" : profile.smokingStatus === "ex" ? "Ex-smoker" : "Current smoker"}`);
      if (profile.alcoholUnitsPerWeek !== undefined)
        lines.push(`Alcohol: ${profile.alcoholUnitsPerWeek} units/week`);
      if (profile.diabetic) lines.push(`Diabetic: Yes`);
    }

    // --- Medications ---
    const activeMeds = medications.filter(m => m.active);
    if (activeMeds.length > 0) {
      lines.push(`Active medications: ${activeMeds.map(m => `${m.name} ${m.dose}${m.unit}`).join(", ")}`);
    }
    const inactiveMeds = medications.filter(m => !m.active);
    if (inactiveMeds.length > 0) {
      lines.push(`Past medications: ${inactiveMeds.map(m => m.name).join(", ")}`);
    }

    // --- Medical history ---
    if (profile) {
      if (profile.pastConditions.length)  lines.push(`Past/current conditions: ${profile.pastConditions.join(", ")}`);
      if (profile.familyHistory.length)   lines.push(`Family history: ${profile.familyHistory.join("; ")}`);
      if (profile.allergies.length)       lines.push(`Allergies: ${profile.allergies.join(", ")}`);
      if (profile.surgeries.length)       lines.push(`Surgeries/procedures: ${profile.surgeries.join(", ")}`);
      if (profile.otherNotes)             lines.push(`Other notes: ${profile.otherNotes}`);
    }

    // --- Substances ---
    if (substanceLogs && substanceLogs.length > 0) {
      const now = startOfDay(new Date());
      const bySubstance = new Map<string, SubstanceLog[]>();
      substanceLogs.forEach((l) => {
        if (!bySubstance.has(l.name)) bySubstance.set(l.name, []);
        bySubstance.get(l.name)!.push(l);
      });
      const substanceLines: string[] = [];
      bySubstance.forEach((subLogs, name) => {
        const sorted = [...subLogs].sort((a, b) => b.date.localeCompare(a.date));
        const daysSince = differenceInDays(now, startOfDay(parseISO(sorted[0].date)));
        substanceLines.push(`${name}: last used ${daysSince} day(s) ago (${sorted[0].dose} ${sorted[0].unit}), ${sorted.length} total recorded dose(s)`);
      });
      lines.push(`Tracked substance use: ${substanceLines.join("; ")}`);
    }

    return lines.join("\n");
  }, [latestWeight, latestHeight, bmi, latestBP, latestMeas, medications, bpEntries, entries, profile, substanceLogs]);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const data = buildPrompt();
      if (!data.trim()) { setError("No health data recorded yet — add some measurements first."); return; }

      const systemPrompt = `You are a highly knowledgeable health advisor with expertise in preventive medicine, cardiovascular health, and metabolic health. Based on the user's comprehensive health data, provide a detailed, personalised health assessment. Use plain UK English. Be honest but compassionate. Structure your response with these clearly labelled sections using bold markdown headers:

**1. Overall Health Summary**
A concise 2–3 sentence snapshot of the person's overall health status.

**2. Weight & Body Composition**
BMI interpretation, weight risk, body composition insights (waist-to-height, waist-to-hip ratios if available), target weight context.

**3. Cardiovascular Assessment**
Detailed BP analysis, trends, heart rate, estimated cardiovascular fitness level.

**4. 10-Year Heart Attack Risk Estimate**
Using a Framingham-style framework incorporating age, sex, BP, cholesterol (note if unknown), smoking, diabetes, BMI. Give a percentage range with brief explanation. Clearly state this is a general estimate, not a clinical diagnosis.

**5. 10-Year Stroke Risk Estimate**
Estimate using available risk factors. Flag atrial fibrillation risk if heart rate is irregular. Note limitations.

**6. Estimated Life Expectancy Impact**
Based on the modifiable risk factors present, estimate whether current lifestyle/health markers suggest reduced or increased life expectancy vs average. Be specific about which factors are impacting this.

**7. Key Risk Factors Ranked**
Number each risk factor, ranked from most to least serious. Brief explanation for each.

**8. Medication & Substance Analysis**
Review current medications in context of health data. If substance use data is provided, include relevant health considerations (e.g. cardiovascular impact, interaction with medications, frequency patterns). Note any concerns. If no medications or substances, say so.

**9. Positive Indicators**
What is already good — celebrate wins, note protective factors.

**10. Priority Improvement Areas**
Top 3–5 specific, actionable steps the person can take. Be concrete (e.g. "Reduce sodium intake to under 2g/day" not just "eat better").

**11. When to Seek Medical Attention**
Any findings that warrant prompt GP review or urgent attention. Be specific.

---
*This assessment is for informational purposes only and does not replace professional medical advice. Always consult your GP or healthcare provider for diagnosis and treatment.*`;

      const result = await callGemini(systemPrompt, `Here is my current health data:\n${data}\n\nPlease give me a full health assessment.`);
      setAssessment(result);
      setExpanded(true);
    } catch (e: any) {
      setError(e?.message === "NO_KEY" ? "Gemini API key not configured." : (e?.message ?? "Assessment failed."));
    } finally {
      setRunning(false);
    }
  };

  const hasData = !!(latestWeight || latestBP || latestHeight);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-200/40 p-4 mb-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="p-2 rounded-xl bg-violet-500/15">
          <Brain className="w-4 h-4 text-violet-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-card-foreground">AI Health Assessment</h3>
          <p className="text-[11px] text-muted-foreground">Comprehensive risk analysis powered by Gemini</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="p-2.5 rounded-xl bg-white/60 border border-white/80 text-center">
          <Scale className="w-3.5 h-3.5 mx-auto mb-1 text-blue-500" />
          <p className="text-[10px] text-muted-foreground">BMI</p>
          <p className="text-sm font-bold text-card-foreground">{bmi ? bmi.toFixed(1) : "—"}</p>
          {bmi && <p className="text-[9px] text-muted-foreground leading-tight">{bmiLabel(bmi)}</p>}
        </div>
        <div className="p-2.5 rounded-xl bg-white/60 border border-white/80 text-center">
          <Activity className="w-3.5 h-3.5 mx-auto mb-1 text-red-500" />
          <p className="text-[10px] text-muted-foreground">Latest BP</p>
          <p className="text-sm font-bold text-card-foreground">{latestBP ? `${latestBP.systolic}/${latestBP.diastolic}` : "—"}</p>
        </div>
        <div className="p-2.5 rounded-xl bg-white/60 border border-white/80 text-center">
          <Ruler className="w-3.5 h-3.5 mx-auto mb-1 text-green-500" />
          <p className="text-[10px] text-muted-foreground">Waist</p>
          <p className="text-sm font-bold text-card-foreground">{latestMeas?.waistCm ? `${latestMeas.waistCm}cm` : "—"}</p>
        </div>
      </div>

      {!hasData && (
        <p className="text-xs text-muted-foreground text-center py-2 mb-3">
          Log some health data first to get a personalised assessment.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 mb-3 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {assessment && (
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden"
            >
              <div className="p-3.5 rounded-xl bg-white/70 border border-white/90 text-xs text-card-foreground leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                {assessment}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <div className="flex gap-2">
        <Button
          onClick={run}
          disabled={running || keyLoading || !hasData}
          className="flex-1 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold gap-1.5"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {running ? "Analysing…" : assessment ? "Re-assess" : "Run Full Assessment"}
        </Button>
        {assessment && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded((x) => !x)}
            className="h-10 rounded-xl px-3"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
