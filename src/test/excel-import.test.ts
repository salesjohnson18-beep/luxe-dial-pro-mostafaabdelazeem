import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseDate, parseSheets, matchHeader, parseNumber } from "@/lib/excel-import";

describe("parseDate", () => {
  it.each([
    [46301, "2026-10-06"],
    ["46301", "2026-10-06"],
    ["2026-10-06", "2026-10-06"],
    ["2026/10/6", "2026-10-06"],
    ["2026-10-06 14:30:00", "2026-10-06"],
    ["06/10/2026", "2026-10-06"],
    ["6-10-26", "2026-10-06"],
    ["٠٦/١٠/٢٠٢٦", "2026-10-06"],
    ["20261006", "2026-10-06"],
    ["Oct 6, 2026", "2026-10-06"],
    ["6 أكتوبر 2026", "2026-10-06"],
    ["25/09/2026 10:00 AM", "2026-09-25"],
  ])("%s", (v, out) => expect(parseDate(v)).toBe(out));
  it("mdy when requested", () => expect(parseDate("10/06/2026", "mdy")).toBe("2026-10-06"));
  it("unambiguous mdy", () => expect(parseDate("09/25/2026")).toBe("2026-09-25"));
  it("garbage", () => expect(parseDate("hello")).toBeNull());
});

describe("headers & numbers", () => {
  it("maps", () => {
    expect(matchHeader("Amount spent (SAR)")).toBe("spend");
    expect(matchHeader("CPC (cost per link click)")).toBeNull();
    expect(matchHeader("مبيعات المتجر")).toBe("store_revenue");
    expect(matchHeader("Purchases conversion value")).toBe("revenue");
    expect(matchHeader("مرات الظهور")).toBe("impressions");
    expect(matchHeader("CTR (all)")).toBeNull();
    expect(matchHeader("Reporting starts")).toBe("date");
  });
  it("numbers", () => {
    expect(parseNumber("1,234.50 ر.س")).toBe(1234.5);
    expect(parseNumber("١٢٣٫٥")).toBe(123.5);
    expect(parseNumber("SAR 45")).toBe(45);
  });
});

describe("parseSheets via real xlsx", () => {
  it("handles title rows, merged dates, mixed formats, totals, bad rows", () => {
    const aoa = [
      ["تقرير حملات روجا روز"],
      [],
      ["التاريخ", "المنصة", "Campaign", "الصرف", "النقرات", "مرات الظهور", "المشتريات", "الإيراد", "CTR", "مبيعات المتجر"],
      [new Date(2026, 9, 1), "فيسبوك", "A", "100", 50, 2000, 2, 400, "2.5%", 900],
      ["", "Meta", "B", 50, 10, 500, 1, 100, "", ""],
      ["02/10/2026", "Snap", "A", "SAR 30", "5", "1,000", 0, 0, "", 300],
      ["2026-10-03", "Google", "A", 20, 4, 100, 0, 0, "", ""],
      ["لا تاريخ", "Google", "A", 20, 4, 100, 0, 0, "", ""],
      ["الإجمالي", "", "", 200, 69, 3600, 3, 500, "", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const read = XLSX.read(buf);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(read.Sheets["Sheet1"]!, { header: 1, defval: "", raw: true });
    const r = parseSheets([{ name: "Sheet1", rows }]);
    const meta = r.entries.find((e) => e.platform === "Meta")!;
    expect(meta).toMatchObject({ entry_date: "2026-10-01", spend: 150, clicks: 60, purchases: 3, revenue: 500 });
    expect(r.entries.find((e) => e.platform === "Snapchat")).toMatchObject({ entry_date: "2026-10-02", spend: 30, impressions: 1000 });
    expect(r.entries.find((e) => e.platform === "Google Ads")?.entry_date).toBe("2026-10-03");
    expect(r.store).toEqual(expect.arrayContaining([{ entry_date: "2026-10-01", revenue: 900, orders: 0 }]));
    expect(r.warnings.length).toBe(2);
  });
});
