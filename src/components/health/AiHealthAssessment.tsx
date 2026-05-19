import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Loader2, AlertCircle, ChevronDown, ChevronUp, Sparkles, Heart, Activity, Scale, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAiConfig } from "@/hooks/useAiConfig";
import type { WeightEntry, HeightEntry, BPEntry, MeasurementEntry } from "@/hooks/useWeightTracker";
import type { Medication } from "@/hooks/useMeds";

interface Props {
  entries: WeightEntry[];
  heightEntries: HeightEntry[];
  bpEntries: BPEntry[];
  measurements: MeasurementEntry[];
  medications: Medication[];
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

export default function AiHealthAssessment({ entries, heightEntries, bpEntries, measurements, medications }: Props) {
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
    if (medications.filter(m => m.active).length > 0) {
      lines.push(`Active medications: ${medications.filter(m => m.active).map(m => `${m.name} ${m.dose}${m.unit}`).join(", ")}`);
    }

    // Include BP trend if enough data
    if (bpEntries.length >= 3) {
      const recent = bpEntries.slice(-5);
      const avgSys = Math.round(recent.reduce((s, e) => s + e.systolic, 0) / recent.length);
      const avgDia = Math.round(recent.reduce((s, e) => s + e.diastolic, 0) / recent.length);
      lines.push(`Average BP over last ${recent.length} readings: ${avgSys}/${avgDia} mmHg`);
    }

    if (entries.length >= 2) {
      const first = entries[0];
      const last  = entries[entries.length - 1];
      const diff  = last.weight - first.weight;
      lines.push(`Weight change since first record: ${diff > 0 ? "+" : ""}${diff.toFixed(1)} kg`);
    }

    return lines.join("\n");
  }, [latestWeight, latestHeight, bmi, latestBP, latestMeas, medications, bpEntries, entries]);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const data = buildPrompt();
      if (!data.trim()) { setError("No health data recorded yet — add some measurements first."); return; }

      const systemPrompt = `You are a knowledgeable health advisor. Based on the user's biometric data, provide a comprehensive, clear, personalised health assessment. Use plain language. Structure your response with clear sections:

1. **Overall Health Summary** — brief snapshot
2. **Weight & Body Composition** — BMI, weight risk, body composition insights from measurements
3. **Cardiovascular Assessment** — BP analysis, heart rate, estimated cardiovascular risk level
4. **10-Year Risk Estimate** — rough estimate of heart attack and stroke risk based on available data (be clear this is a general estimate, not medical diagnosis). Use established risk factor frameworks.
5. **Key Risk Factors** — list any concerning markers with brief explanations
6. **Medication Interactions** — if medications listed, note any relevant cardiovascular/metabolic considerations
7. **Positive Indicators** — what is going well
8. **Recommended Actions** — specific, actionable steps (lifestyle, monitoring frequency, when to see a GP urgently)

Be honest but compassionate. Flag anything that genuinely warrants prompt medical attention. Always end with: "This assessment is for informational purposes only and does not replace professional medical advice."`;

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
