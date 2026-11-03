import { describe, expect, it } from "vitest";
import { dueAlertStage, instLabel, quickRange } from "@/lib/crm";

describe("recurring cycles and collections", () => {
  it("alerts 2 days before", () => expect(dueAlertStage("2026-11-05", "2026-11-03")).toBe("soon"));
  it("no alert 3 days before", () => expect(dueAlertStage("2026-11-06", "2026-11-03")).toBeNull());
  it("alerts on the due day", () => expect(dueAlertStage("2026-11-03", "2026-11-03")).toBe("today"));
  it("alerts after due when late", () => expect(dueAlertStage("2026-10-30", "2026-11-03")).toBe("late"));
  it("recurring cycle label", () => expect(instLabel({ number: 3, total_count: 0 }, "monthly")).toBe("الدورة الشهرية 3"));
  it("this month range", () => expect(quickRange("this_month", "2026-11-03")).toEqual({ from: "2026-11-01", to: "2026-11-30" }));
  it("last month range", () => expect(quickRange("last_month", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" }));
  it("this week starts Saturday", () => expect(quickRange("this_week", "2026-11-03")).toEqual({ from: "2026-10-31", to: "2026-11-06" }));
});
