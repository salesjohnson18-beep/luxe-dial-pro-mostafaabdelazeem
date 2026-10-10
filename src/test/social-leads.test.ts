import { describe, expect, it } from "vitest";
import { byPlatform, computeTotals, supportsLeads, type Entry } from "@/lib/metrics";

const entry = (platform: string, spend: number, leads = 0): Entry => ({
  entry_date: "2026-10-10", platform, spend, leads, clicks: 100, impressions: 1000, purchases: 2, revenue: 500,
});

describe("social messages and leads", () => {
  it.each(["Meta", "Snapchat", "TikTok", "Twitter/X"])("supports messages for %s", (platform) => {
    expect(supportsLeads(platform)).toBe(true);
    expect(computeTotals([entry(platform, 200, 10)]).cpl).toBe(20);
  });
  it("excludes Google Ads messages and spend from cost per social message", () => {
    expect(supportsLeads("Google Ads")).toBe(false);
    const totals = computeTotals([entry("Google Ads", 900, 50), entry("Meta", 200, 10)]);
    expect(totals.spend).toBe(1100);
    expect(totals.leads).toBe(10);
    expect(totals.cpl).toBe(20);
  });
  it("returns zero cost when there are no messages", () => {
    expect(computeTotals([entry("Meta", 200)]).cpl).toBe(0);
    expect(computeTotals([]).cpl).toBe(0);
  });
  it("keeps each platform's messages and cost separate", () => {
    const totals = byPlatform([entry("Meta", 200, 10), entry("Meta", 100, 5), entry("TikTok", 120, 3)]);
    expect(totals.find((p) => p.platform === "Meta")?.leads).toBe(15);
    expect(totals.find((p) => p.platform === "Meta")?.cpl).toBe(20);
    expect(totals.find((p) => p.platform === "TikTok")?.cpl).toBe(40);
  });
});