import { describe, expect, it } from "vitest";
import { parseAppleHealthExport, parseRingConnCsv, summarizeWearableDays } from "@/lib/wearableImport";

const today = new Date();
const iso = today.toISOString().slice(0, 10);
const appleDate = `${iso} 08:00:00 +0000`;
const appleEnd = `${iso} 15:00:00 +0000`;

describe("wearable import", () => {
  it("aggregates Apple Health heart rate, sleep and steps", () => {
    const xml = `
      <HealthData>
        <Record type="HKQuantityTypeIdentifierRestingHeartRate" startDate="${appleDate}" value="54" unit="count/min"/>
        <Record type="HKQuantityTypeIdentifierHeartRate" startDate="${appleDate}" value="72" unit="count/min"/>
        <Record type="HKQuantityTypeIdentifierStepCount" startDate="${appleDate}" value="4200" unit="count"/>
        <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="${appleDate}" endDate="${appleEnd}" value="HKCategoryValueSleepAnalysisAsleepCore"/>
      </HealthData>
    `;
    const days = parseAppleHealthExport(xml);
    expect(days).toHaveLength(1);
    expect(days[0].restingHr).toBe(54);
    expect(days[0].steps).toBe(4200);
    expect(days[0].sleepMinutes).toBe(420);
    expect(days[0].source).toBe("apple_health");
  });

  it("parses a RingConn-style CSV", () => {
    const csv = [
      "Date,Resting HR,HRV,Sleep Hours,Steps,SpO2",
      `${iso},58,41,7.5,8123,97`,
    ].join("\n");
    const days = parseRingConnCsv(csv);
    expect(days[0]).toMatchObject({
      source: "ringconn",
      restingHr: 58,
      hrvMs: 41,
      steps: 8123,
      spo2: 97,
    });
    expect(days[0].sleepMinutes).toBe(450);
  });

  it("summarises wearable days for the AI prompt", () => {
    const text = summarizeWearableDays([
      { date: iso, source: "ringconn", restingHr: 56, sleepMinutes: 420, steps: 9000 },
    ]);
    expect(text).toContain("RingConn");
    expect(text).toContain("RHR 56");
    expect(text).toContain("sleep 7.0 h");
  });
});
