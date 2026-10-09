import { describe, expect, it } from "vitest";
import { transferDue } from "@/lib/crm";

describe("transfer reminder", () => {
  it("weekly is due 7 days after start", () => expect(transferDue("2026-10-01", "weekly")).toBe("2026-10-08"));
  it("monthly is due one month after start", () => expect(transferDue("2026-10-01", "monthly")).toBe("2026-11-01"));
});
