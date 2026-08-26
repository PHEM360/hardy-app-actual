import { describe, expect, it } from "vitest";
import { CHROME_SCENES, resolveAutoScene, resolveChromeScene, seasonForDate } from "@/lib/chromeScenes";
import { LOADER_PRESETS } from "@/lib/appThemes";
import { mergeAppearance } from "@/hooks/useAppearance";
import { funFactCount, funFactForDate } from "@/lib/funFacts";
import { billsDueSoon, overdueByDueDate, upcomingBirthdays } from "@/lib/todayInsights";

describe("chrome display options", () => {
  it("offers live weather and seasons instead of separate snow/rain picks", () => {
    expect(CHROME_SCENES).toHaveLength(20);
    expect(CHROME_SCENES.map((s) => s.id)).toEqual(expect.arrayContaining(["weather", "seasons", "aurora", "harbour"]));
    expect(CHROME_SCENES.map((s) => s.id)).not.toEqual(expect.arrayContaining(["snow", "rain", "sun", "clouds"]));
  });

  it("offers 20 loading icon presets", () => {
    expect(LOADER_PRESETS).toHaveLength(20);
    expect(LOADER_PRESETS.map((p) => p.id)).toEqual(expect.arrayContaining([
      "dogs", "cats", "horses", "boats", "farm", "harvest", "paws", "chickens", "sheep",
    ]));
  });

  it("maps lifestyle themes to a default header scene", () => {
    expect(resolveAutoScene("stars", false)).toBe("stars");
    expect(resolveAutoScene("farm", false)).toBe("meadow");
    expect(resolveAutoScene("sea", false)).toBe("harbour");
    expect(resolveAutoScene("none", true)).toBe("stars");
  });

  it("treats auto as the theme default and keeps explicit picks", () => {
    expect(resolveChromeScene("auto", { atmosphere: "sea" })).toBe("harbour");
    expect(resolveChromeScene("pawprints")).toBe("pawprints");
    expect(resolveChromeScene("snow")).toBe("weather");
    expect(resolveChromeScene("leaves")).toBe("seasons");
    expect(resolveChromeScene(undefined, { fallback: "weather" })).toBe("weather");
  });

  it("picks the season from the calendar, not as a weather type", () => {
    expect(seasonForDate(new Date("2026-04-02"))).toBe("spring");
    expect(seasonForDate(new Date("2026-08-26"))).toBe("summer");
    expect(seasonForDate(new Date("2026-10-12"))).toBe("autumn");
    expect(seasonForDate(new Date("2026-01-08"))).toBe("winter");
  });

  it("keeps header settings when the theme changes", () => {
    const next = mergeAppearance(
      { themeId: "default", headerScene: "snow", headerShowWeather: true, loaderPreset: "dogs" },
      { themeId: "sailing", loaderPreset: "sea", customPrimary: "", customAccent: "" },
    );
    expect(next.themeId).toBe("sailing");
    expect(next.headerScene).toBe("snow");
    expect(next.headerShowWeather).toBe(true);
    expect(next.loaderPreset).toBe("sea");
  });
});

describe("today insights", () => {
  it("lists pet birthdays in the next two weeks", () => {
    const from = new Date("2026-08-26T12:00:00");
    const items = upcomingBirthdays({
      from,
      withinDays: 14,
      pets: [
        { id: "a", name: "Willow", birthday: "2018-09-02" },
        { id: "b", name: "Old", birthday: "2015-01-01" },
      ],
      events: [{ id: "e1", title: "Sam's birthday", startDate: "2026-09-01T00:00:00" }],
    });
    expect(items.map((i) => i.name)).toEqual(["Sam's birthday", "Willow"]);
  });

  it("finds household bills due in the next month", () => {
    const from = new Date("2026-08-26T12:00:00");
    const due = billsDueSoon([
      { id: "1", endDate: "2026-09-10" },
      { id: "2", endDate: "2026-11-01" },
      { id: "3" },
    ], from, 31);
    expect(due.map((i) => i.id)).toEqual(["1"]);
  });

  it("finds overdue tasks", () => {
    const from = new Date("2026-08-26T12:00:00");
    const overdue = overdueByDueDate([
      { title: "Late", dueDate: "2026-08-20", status: "todo" },
      { title: "Done", dueDate: "2026-08-20", status: "done" },
      { title: "Soon", dueDate: "2026-08-28", status: "todo" },
    ], from);
    expect(overdue.map((t) => t.title)).toEqual(["Late"]);
  });

  it("returns a stable fun fact for a given day", () => {
    expect(funFactCount()).toBeGreaterThan(20);
    const a = funFactForDate(new Date("2026-08-26"));
    const b = funFactForDate(new Date("2026-08-26"));
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });
});
