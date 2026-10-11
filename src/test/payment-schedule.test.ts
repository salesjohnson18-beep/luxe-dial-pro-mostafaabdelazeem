import { describe, expect, it } from "vitest";
import { invoiceStatus, paymentSchedule } from "@/lib/crm";

describe("payment schedule", () => {
  it("weekly installments: first due 7 days after start (1/10 -> 8/10)", () => {
    const s = paymentSchedule(800, "weekly", 4, "2026-10-01");
    expect(s.map((x) => x.due)).toEqual(["2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29"]);
    expect(s[0]).toMatchObject({ number: 1, total_count: 4, amount: 200 });
  });
  it("monthly: first due 30 days after start", () => expect(paymentSchedule(900, "monthly", 3, "2026-10-01")[0]!.due).toBe("2026-10-31"));
  it("upfront: whole amount due on start", () => expect(paymentSchedule(800, "upfront", 4, "2026-10-01")).toEqual([{ number: 1, total_count: 1, amount: 800, due: "2026-10-01", advance: true }]));
  it("advance down payment due on start, rest split", () => {
    const s = paymentSchedule(1000, "weekly", 2, "2026-10-01", 200);
    expect(s.map((x) => [x.amount, x.due])).toEqual([[200, "2026-10-01"], [400, "2026-10-08"], [400, "2026-10-15"]]);
  });
  it("pending past due is overdue", () => expect(invoiceStatus("pending", "2026-10-01", "2026-10-02").label).toBe("متأخرة"));
});
