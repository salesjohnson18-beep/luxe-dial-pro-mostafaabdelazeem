export const LEAD_STATUS: Record<string, { label: string; cls: string }> = {
  following: { label: "جاري المتابعة", cls: "bg-gold-soft text-gold border-gold/40" },
  done: { label: "تم التنفيذ", cls: "bg-success/15 text-success border-success/40" },
  cancelled: { label: "غير مهتم / ملغي", cls: "bg-destructive/15 text-destructive border-destructive/40" },
};

export const OUTCOMES = ["تم الاتصال", "لا يرد", "مهتم", "موعد لاحق", "مغلق / خارج الخدمة"];

export const QUOTE_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "border-border text-muted-foreground" },
  sent: { label: "مُرسل", cls: "bg-gold-soft text-gold border-gold/40" },
  changes_requested: { label: "طلب تعديل", cls: "bg-chart-3/15 text-chart-3 border-chart-3/40" },
  accepted: { label: "مقبول", cls: "bg-success/15 text-success border-success/40" },
  done: { label: "تم التنفيذ", cls: "bg-success/25 text-success border-success/60" },
  cancelled: { label: "ملغي", cls: "bg-destructive/15 text-destructive border-destructive/40" },
};

export const PAYMENT_TYPES: Record<string, string> = {
  upfront: "مقدم كامل",
  weekly: "أسبوعي (دفعات)",
  monthly: "شهري",
};

export function waLink(phone: string | null | undefined, text?: string) {
  let p = (phone ?? "").replace(/[^\d]/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("05") && p.length === 10) p = "966" + p.slice(1);
  else if (p.startsWith("5") && p.length === 9) p = "966" + p;
  return `https://wa.me/${p}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function telLink(phone: string | null | undefined) {
  return `tel:${(phone ?? "").replace(/[^\d+]/g, "")}`;
}

const arDT = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit",
});
const arD = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric" });
export const fmtArDateTime = (d: string | Date) => arDT.format(new Date(d));
export const fmtArDate = (d: string | Date) => arD.format(new Date(d));

export type QItem = { service_id: string | null; name: string; description: string | null; price: number; qty: number };

export function quoteMath(items: QItem[], discount: number, paymentType: string, installments: number) {
  const subtotal = items.reduce((a, i) => a + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
  const total = Math.max(subtotal - (Number(discount) || 0), 0);
  const n = paymentType === "upfront" ? 1 : Math.max(1, Math.round(installments) || 1);
  return { subtotal, total, n, per: Math.round((total / n) * 100) / 100 };
}

export const CURRENCIES: Record<string, string> = {
  SAR: "ر.س", EGP: "ج.م", KWD: "د.ك", AED: "د.إ", QAR: "ر.ق", BHD: "د.ب", OMR: "ر.ع", USD: "$",
};
export const CURRENCY_NAMES: Record<string, string> = {
  SAR: "ريال سعودي", EGP: "جنيه مصري", KWD: "دينار كويتي", AED: "درهم إماراتي", QAR: "ريال قطري", BHD: "دينار بحريني", OMR: "ريال عماني", USD: "دولار أمريكي",
};
export const cur = (c: string | null | undefined) => CURRENCIES[c ?? "SAR"] ?? c ?? "ر.س";

export const PAYMENT_TERMS = [
  "مقدم كامل (للخدمات المصغرة)",
  "دفعات مجدولة (أسبوعي/شهري - فري لانس أو دوام كامل)",
  "مؤخر عند التسليم",
];

export const PAYMENT_METHODS: Record<string, string> = { upfront: "مقدم كامل", weekly: "أسبوعي (دفعات)", monthly: "شهري" };

function addDays(d: string, n: number) { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
function addMonths(d: string, n: number) { const x = new Date(d + "T00:00:00Z"); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); }
/** Transfer reminder date: one cycle (7 days weekly / 1 month monthly) after the last transfer or work start. */
export function transferDue(base: string, cycle: string) { return cycle === "monthly" ? addMonths(base, 1) : addDays(base, 7); }

/** Installment schedule (mirrors SQL generate_client_installments).
 * upfront: whole amount due on start. weekly: first due start+7, every 7 days. monthly: first due start+30, every 30 days.
 * Optional advance (down payment) is due on the start date and the rest is split. */
export function paymentSchedule(total: number, method: string, count: number, start: string, advance = 0) {
  if (!total || total <= 0) return [] as { number: number; total_count: number; amount: number; due: string; advance: boolean }[];
  if (method === "upfront") return [{ number: 1, total_count: 1, amount: total, due: start, advance: true }];
  const adv = Math.min(Math.max(advance || 0, 0), total);
  const n = Math.max(1, Math.round(count) || 1);
  const step = method === "monthly" ? 30 : 7;
  const made = adv > 0 ? 1 : 0;
  const rest = total - adv;
  const out = adv > 0 ? [{ number: 1, total_count: n + made, amount: adv, due: start, advance: true }] : [];
  if (rest > 0) {
    const amt = Math.round((rest / n) * 100) / 100;
    for (let i = 1; i <= n; i++) out.push({ number: i + made, total_count: n + made, amount: i === n ? Math.round((rest - amt * (n - 1)) * 100) / 100 : amt, due: addDays(start, step * i), advance: false });
  }
  return out;
}

export const PAY_CHANNELS = ["تحويل بنكي", "STC Pay", "نقدي", "PayPal", "Instapay", "فودافون كاش", "أخرى"];
export const EXPENSE_CATEGORIES = ["اشتراكات الأدوات", "برامج وتطبيقات", "عمولات ومكافآت", "مصاريف إدارية", "أخرى"];
export const ACCOUNTS: Record<string, string> = { fees: "أتعاب الإدارة والتسويق", ad_budget: "ميزانية الإعلانات" };
export function invoiceStatus(status: string, due: string, todayStr: string) {
  if (status === "paid") return { label: "مدفوعة", cls: "bg-success/15 text-success border-success/40" };
  if (status === "cancelled") return { label: "ملغاة", cls: "border-border text-muted-foreground" };
  if (due < todayStr) return { label: "متأخرة", cls: "bg-destructive/15 text-destructive border-destructive/40" };
  return { label: "معلقة", cls: "bg-gold-soft text-gold border-gold/40" };
}
