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
