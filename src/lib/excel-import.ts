import { PLATFORMS, type Entry } from "./metrics";

export type Field =
  | "date" | "platform" | "spend" | "clicks" | "impressions" | "purchases" | "revenue" | "store_revenue" | "store_orders";

export type ImportWarning = { sheet: string; row: number; message: string };
export type StoreRow = { entry_date: string; revenue: number; orders: number };
export type ImportResult = {
  entries: Entry[];
  store: StoreRow[];
  warnings: ImportWarning[];
  mapping: { sheet: string; columns: Partial<Record<Field, string>> }[];
  rowsRead: number;
};

const AR_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};
const toLatin = (s: string) => s.replace(/[٠-٩۰-۹]/g, (d) => AR_DIGITS[d] ?? d).replace(/٫/g, ".").replace(/٬/g, ",");

export function normHeader(h: unknown) {
  return toLatin(String(h ?? ""))
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[_\-./()[\]:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Order matters: store_revenue before revenue.
const SYNONYMS: [Field, string[]][] = [
  ["date", ["date", "day", "reporting starts", "reporting date", "start date", "time", "التاريخ", "تاريخ", "اليوم", "يوم"]],
  ["platform", ["platform", "channel", "source", "network", "المنصه", "القناه", "المصدر", "منصه"]],
  ["store_orders", ["true purchases", "true orders", "store orders", "shop orders", "طلبات المتجر", "عدد الطلبات", "الطلبات", "orders"]],
  ["store_revenue", ["true revenue", "true sales", "store sales", "store revenue", "shop sales", "actual sales", "total sales", "مبيعات المتجر", "مبيعات فعليه", "المبيعات الفعليه", "مبيعات"]],
  ["spend", ["amount spent", "spend", "spent", "cost", "budget used", "الصرف", "المصروف", "المنفق", "الانفاق", "التكلفه", "تكلفه", "صرف"]],
  ["impressions", ["impressions", "impr", "views", "الظهور", "مرات الظهور", "ظهور", "المشاهدات"]],
  ["clicks", ["link clicks", "clicks", "click", "swipe ups", "swipes", "النقرات", "نقرات", "الضغطات", "كليك"]],
  ["purchases", ["purchases", "purchase", "conversions", "conv", "results", "sales count", "المشتريات", "مشتريات", "التحويلات", "النتائج", "عمليات الشراء"]],
  ["revenue", ["purchase conversion value", "conversion value", "conv value", "purchases value", "revenue", "value", "الايراد", "ايراد", "العائد الاعلاني", "قيمه التحويل", "قيمه المشتريات"]],
];
// Derived-metric columns we must never mistake for raw ones.
const EXCLUDE = ["per ", "cpc", "ctr", "cpm", "cpa", "roas", "rate", "%", "avg", "average", "معدل", "نسبه", "متوسط", "تكلفه النقره", "تكلفه الشراء", "تكلفه الالف", "تكلفه التحويل", "لكل", "offline", "profit", "overlap", "aov", "ratio", "order value", "ربح"];

export function matchHeader(raw: unknown): Field | null {
  const h = normHeader(raw);
  if (!h) return null;
  const isExcluded = EXCLUDE.some((x) => x.trim().length > 0 && h.includes(x.trim()));
  // Pick the longest matching synonym across all fields (e.g. "purchases conversion value" → revenue).
  let best: { field: Field; len: number } | null = null;
  for (const [field, syns] of SYNONYMS) {
    for (const s of syns) {
      const exact = h === s;
      const contains = s.length >= 4 && h.includes(s);
      if (!exact && (!contains || isExcluded)) continue;
      const len = exact ? 1000 : s.length;
      if (!best || len > best.len) best = { field, len };
    }
  }
  return best?.field ?? null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  يناير: 1, فبراير: 2, مارس: 3, ابريل: 4, مايو: 5, يونيو: 6, يوليو: 7, اغسطس: 8, سبتمبر: 9, اكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
  "كانون الثاني": 1, شباط: 2, اذار: 3, نيسان: 4, ايار: 5, حزيران: 6, تموز: 7, ايلول: 9, "تشرين الاول": 10, "تشرين الثاني": 11, "كانون الاول": 12,
};

const pad = (n: number) => String(n).padStart(2, "0");
function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function excelSerialToISO(n: number): string | null {
  if (!isFinite(n) || n < 20000 || n > 80000) return null;
  const ms = Math.round((Math.floor(n) - 25569) * 86400000);
  const d = new Date(ms);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Yearless dates ("1 October", "26-May"): current year, or last year if that would be >7 days in the future. */
function inferYear(m: number, d: number): string | null {
  const now = new Date();
  let y = now.getFullYear();
  const cand = new Date(Date.UTC(y, m - 1, d));
  if (cand.getTime() - now.getTime() > 7 * 86400000) y -= 1;
  return iso(y, m, d);
}

const isErrorCell = (v: unknown) => typeof v === "string" && /^#(ref|div\/0|value|n\/a|name|null|num|error)/i.test(v.trim());

/** order: preference for ambiguous a/b/yyyy strings */
export function parseDate(v: unknown, order: "dmy" | "mdy" = "dmy"): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (typeof v === "number") return excelSerialToISO(v);
  let s = normHeader(v).replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  // Range like "2026-10-01 - 2026-10-07" → first date
  s = s.replace(/\s+(to|الي|حتي)\s+.*$/, "");
  // Pure serial in text
  if (/^\d{5}(\.\d+)?$/.test(s)) return excelSerialToISO(Number(s));
  // yyyymmdd
  let m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return iso(+m[1]!, +m[2]!, +m[3]!);
  // yyyy-mm-dd (with optional time)
  m = s.match(/^(\d{4})\s*[ /]\s*(\d{1,2})\s*[ /]\s*(\d{1,2})/) ?? toLatin(String(v)).match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return iso(+m[1]!, +m[2]!, +m[3]!);
  // a/b/yyyy or a-b-yy (with optional time)
  m = toLatin(String(v)).trim().match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{2,4})(?!\d)/);
  if (m) {
    const a = +m[1]!, b = +m[2]!, y = +m[3]!;
    if (a > 12) return iso(y, b, a);
    if (b > 12) return iso(y, a, b);
    return order === "dmy" ? iso(y, b, a) : iso(y, a, b);
  }
  // Month names: "6 oct 2026", "oct 6 2026", "6 اكتوبر 2026"
  const monthKey = Object.keys(MONTHS).sort((x, y) => y.length - x.length).find((k) => s.includes(k));
  if (monthKey) {
    const nums = s.replace(monthKey, " ").match(/\d+/g)?.map(Number) ?? [];
    const year = nums.find((n) => n > 31);
    const day = nums.find((n) => n >= 1 && n <= 31);
    if (year && day) return iso(year, MONTHS[monthKey]!, day);
    if (!year && day && nums.length === 1) return inferYear(MONTHS[monthKey]!, day);
  }
  const t = Date.parse(toLatin(String(v)));
  if (!isNaN(t)) {
    const d = new Date(t);
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  return null;
}

export function parseNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (isErrorCell(v)) return null;
  let s = toLatin(String(v)).trim();
  if (!s || s === "-" || s === "—") return 0;
  const neg = /^\(.*\)$/.test(s);
  s = (s.replace(/[^\d.,-]+/g, " ").match(/-?[\d,]*\.?\d+/) ?? [""])[0];
  if (/,\d{1,2}$/.test(s) && !s.includes(".")) s = s.replace(",", "."); // 12,5 → 12.5
  s = s.replace(/,/g, "");
  const n = Number(s);
  if (!isFinite(n) || s === "") return null;
  return neg ? -Math.abs(n) : n;
}

export function normalizePlatform(v: unknown): string | null {
  const s = normHeader(v);
  if (!s) return null;
  if (/google|adwords|جوجل|قوقل|youtube|يوتيوب/.test(s)) return "Google Ads";
  if (/meta|facebook|instagram|fb|ig|فيس|فيسبوك|انستا|انستقرام|انستغرام|ميتا/.test(s)) return "Meta";
  if (/snap|سناب/.test(s)) return "Snapchat";
  if (/tik ?tok|تيك|تك توك/.test(s)) return "TikTok";
  if (/twitter|^x$|^x |تويتر|اكس/.test(s)) return "Twitter/X";
  return null;
}

const TOTAL_WORDS = ["total", "grand total", "الاجمالي", "اجمالي", "المجموع", "مجموع", "sum"];

export type Sheet = { name: string; rows: unknown[][] };

export function parseSheets(sheets: Sheet[], defaultPlatform: string = PLATFORMS[0]): ImportResult {
  const warnings: ImportWarning[] = [];
  const mapping: ImportResult["mapping"] = [];
  const agg = new Map<string, Entry>();
  const storeAgg = new Map<string, StoreRow>();
  let rowsRead = 0;

  for (const sheet of sheets) {
    const rows = sheet.rows;
    if (parseMatrix(sheet, defaultPlatform, agg, storeAgg, warnings, mapping)) { rowsRead += rows.length; continue; }
    // Find header row: the row in the first 20 with the most recognized columns (needs a date column).
    let headerIdx = -1, best = 0;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const fields = new Set((rows[i] ?? []).map(matchHeader).filter(Boolean));
      if (fields.has("date") && fields.size > best) { best = fields.size; headerIdx = i; }
    }
    if (headerIdx < 0) {
      if (rows.some((r) => r?.some((c) => c !== "" && c != null)))
        warnings.push({ sheet: sheet.name, row: 0, message: "لم نجد عمود التاريخ في هذه الورقة — تم تجاهلها" });
      continue;
    }
    const header = rows[headerIdx] ?? [];
    const col: Partial<Record<Field, number>> = {};
    const colNames: Partial<Record<Field, string>> = {};
    header.forEach((h, i) => {
      const f = matchHeader(h);
      if (f && col[f] === undefined) { col[f] = i; colNames[f] = String(h); }
    });
    mapping.push({ sheet: sheet.name, columns: colNames });
    const sheetPlatform = normalizePlatform(sheet.name) ?? defaultPlatform;

    // Detect DMY vs MDY across the column.
    let dmy = 0, mdy = 0;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const v = rows[i]?.[col.date!];
      if (typeof v !== "string") continue;
      const m = toLatin(v).trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
      if (m) { if (+m[1]! > 12) dmy++; else if (+m[2]! > 12) mdy++; }
    }
    const order = mdy > dmy ? "mdy" : "dmy";

    let lastDate: string | null = null;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const excelRow = i + 1;
      if (!r.some((c) => c !== "" && c != null)) continue;
      const get = (f: Field) => (col[f] === undefined ? undefined : r[col[f]!]);
      const firstText = normHeader(r.find((c) => typeof c === "string" && c.trim()) ?? "");
      if (TOTAL_WORDS.some((w) => firstText === w || firstText.startsWith(w + " "))) {
        warnings.push({ sheet: sheet.name, row: excelRow, message: "صف إجمالي — تم تجاهله لتجنب التكرار" });
        continue;
      }
      rowsRead++;
      const rawDate = get("date");
      let date = parseDate(rawDate, order);
      if (!date && (rawDate === "" || rawDate == null) && lastDate) date = lastDate; // merged cells
      if (!date) {
        warnings.push({ sheet: sheet.name, row: excelRow, message: `تاريخ غير مفهوم "${String(rawDate ?? "")}" — تم تجاهل الصف` });
        continue;
      }
      lastDate = date;

      const nums: Partial<Record<Field, number>> = {};
      for (const f of ["spend", "clicks", "impressions", "purchases", "revenue", "store_revenue", "store_orders"] as Field[]) {
        const raw = get(f);
        if (raw === undefined || (typeof raw === "string" && raw.trim() === "") || isErrorCell(raw)) continue;
        const n = parseNumber(raw);
        if (n === null) {
          warnings.push({ sheet: sheet.name, row: excelRow, message: `قيمة غير مفهومة في "${colNames[f]}": ${String(raw)} — اعتُبرت صفراً` });
          continue;
        }
        nums[f] = n;
      }
      const hasAd = ["spend", "clicks", "impressions", "purchases", "revenue"].some((f) => nums[f as Field] !== undefined && nums[f as Field] !== 0);
      if (hasAd) {
        const platform = normalizePlatform(get("platform")) ?? (String(get("platform") ?? "").trim() || sheetPlatform);
        const key = `${date}|${platform}`;
        const e = agg.get(key) ?? { entry_date: date, platform, spend: 0, clicks: 0, impressions: 0, purchases: 0, revenue: 0 };
        e.spend += nums.spend ?? 0;
        e.clicks += nums.clicks ?? 0;
        e.impressions += nums.impressions ?? 0;
        e.purchases += nums.purchases ?? 0;
        e.revenue += nums.revenue ?? 0;
        agg.set(key, e);
      }
      if (nums.store_revenue || nums.store_orders) {
        const s = storeAgg.get(date) ?? { entry_date: date, revenue: 0, orders: 0 };
        s.revenue += nums.store_revenue ?? 0;
        s.orders += nums.store_orders ?? 0;
        storeAgg.set(date, s);
      }
    }
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const entries = [...agg.values()]
    .map((e) => ({ ...e, spend: r2(e.spend), revenue: r2(e.revenue), clicks: Math.round(e.clicks), impressions: Math.round(e.impressions), purchases: Math.round(e.purchases) }))
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const store = [...storeAgg.values()].map((s) => ({ ...s, revenue: r2(s.revenue), orders: Math.round(s.orders) }));
  return { entries, store, warnings, mapping, rowsRead };
}

const AD_FIELDS = ["spend", "clicks", "impressions", "purchases", "revenue"] as const;

/**
 * Horizontal sheets: one header row with dates across columns, column A holds platform section
 * labels (PAID CHANNELS, GOOGLE, Meta…) followed by metric rows (Cost, Clicks, TRUE Revenue…).
 * Returns false if the sheet doesn't look like a matrix.
 */
function parseMatrix(
  sheet: Sheet,
  defaultPlatform: string,
  agg: Map<string, Entry>,
  storeAgg: Map<string, StoreRow>,
  warnings: ImportWarning[],
  mapping: ImportResult["mapping"],
): boolean {
  const rows = sheet.rows;
  let headerIdx = -1;
  let dateCols: { col: number; date: string }[] = [];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i] ?? [];
    if (matchHeader(r[0]) === "date" && r.slice(1).filter((c) => matchHeader(c)).length >= 2) return false; // vertical header
    const found: { col: number; date: string }[] = [];
    for (let c = 1; c < r.length; c++) {
      const d = parseDate(r[c]);
      if (d) found.push({ col: c, date: d });
    }
    if (found.length >= 3 && found.length > dateCols.length) { headerIdx = i; dateCols = found; }
  }
  if (headerIdx < 0) return false;
  const labelCols = Math.max(1, Math.min(dateCols[0]!.col, 3));

  type Bucket = Record<string, Partial<Record<Field, number>>>; // date -> field -> value
  const sections = new Map<string, Bucket>(); // "paid" or platform name
  const storeVals: Record<string, Partial<Record<Field, number>>> = {};
  let section = "paid";
  const seenFields = new Set<string>();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const labels = r.slice(0, labelCols).filter((c) => typeof c === "string" && c.trim()) as string[];
    if (!labels.length) continue;
    for (const label of labels) {
      const n = normHeader(label);
      if (/paid channels|paid|القنوات المدفوعه|اجمالي القنوات/.test(n)) section = "paid";
      else if (!matchHeader(label)) { const p = normalizePlatform(label); if (p) section = p; }
    }
    const field = labels.map(matchHeader).find((f) => f && f !== "date" && f !== "platform") as Field | undefined;
    if (!field) continue;
    seenFields.add(`${field}=${labels[labels.length - 1]}`);
    const isStore = field === "store_revenue" || field === "store_orders";
    for (const { col, date } of dateCols) {
      const raw = r[col];
      if (raw === "" || raw == null || isErrorCell(raw)) continue;
      const v = parseNumber(raw);
      if (v === null) {
        warnings.push({ sheet: sheet.name, row: i + 1, message: `قيمة غير مفهومة "${String(raw)}" بتاريخ ${date} — تم تجاهلها` });
        continue;
      }
      if (isStore) {
        const b = (storeVals[date] ??= {});
        if (b[field] === undefined) b[field] = v;
      } else {
        const bucket = sections.get(section) ?? {};
        const b = (bucket[date] ??= {});
        if (b[field] === undefined) b[field] = v;
        sections.set(section, bucket);
      }
    }
  }

  const platforms = [...sections.keys()].filter((k) => k !== "paid");
  const use: [string, Bucket][] = platforms.length
    ? platforms.map((p) => [p, sections.get(p)!])
    : sections.has("paid") ? [[defaultPlatform, sections.get("paid")!]] : [];
  for (const [platform, bucket] of use) {
    for (const [date, vals] of Object.entries(bucket)) {
      if (!AD_FIELDS.some((f) => vals[f])) continue;
      const key = `${date}|${platform}`;
      const e = agg.get(key) ?? { entry_date: date, platform, spend: 0, clicks: 0, impressions: 0, purchases: 0, revenue: 0 };
      for (const f of AD_FIELDS) e[f] += vals[f] ?? 0;
      agg.set(key, e);
    }
  }
  for (const [date, vals] of Object.entries(storeVals)) {
    if (!vals.store_revenue && !vals.store_orders) continue;
    const s = storeAgg.get(date) ?? { entry_date: date, revenue: 0, orders: 0 };
    s.revenue += vals.store_revenue ?? 0;
    s.orders += vals.store_orders ?? 0;
    storeAgg.set(date, s);
  }
  const cols: Partial<Record<Field, string>> = { date: `أفقي: ${dateCols.length} تاريخ (${dateCols[0]!.date} → ${dateCols[dateCols.length - 1]!.date})` };
  cols.platform = platforms.length ? platforms.join("، ") : `PAID CHANNELS → ${defaultPlatform}`;
  for (const s of seenFields) { const [f, l] = s.split("="); if (f && !cols[f as Field]) cols[f as Field] = l; }
  mapping.push({ sheet: sheet.name, columns: cols });
  return true;
}
