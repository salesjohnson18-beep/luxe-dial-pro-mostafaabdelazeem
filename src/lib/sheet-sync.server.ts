import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Tables mirrored to Google Sheets, each into its own Arabic-named tab. Vault/passwords are never synced. */
const TABLES: { table: keyof Database["public"]["Tables"]; tab: string; order: string }[] = [
  { table: "clients", tab: "العملاء", order: "created_at" },
  { table: "campaign_entries", tab: "الحملات اليومية", order: "entry_date" },
  { table: "store_sales", tab: "مبيعات المتجر", order: "created_at" },
  { table: "client_installments", tab: "الدفعات والاستحقاقات", order: "created_at" },
  { table: "invoices", tab: "الفواتير", order: "created_at" },
  { table: "finance_entries", tab: "المالية (دخل ومصروفات)", order: "created_at" },
  { table: "quotes", tab: "عروض الأسعار", order: "created_at" },
  { table: "quote_items", tab: "بنود العروض", order: "created_at" },
  { table: "leads", tab: "العملاء المحتملون", order: "created_at" },
  { table: "lead_followups", tab: "سجل المتابعات", order: "created_at" },
  { table: "reminders", tab: "المهام", order: "created_at" },
  { table: "services", tab: "دليل الخدمات", order: "created_at" },
];
const HIDDEN = new Set(["share_token", "password", "secret", "token"]);

export function isValidWebhook(url: string) {
  return /^https:\/\/script\.google(usercontent)?\.com\/macros\/s\/[\w-]+\/exec/.test(url);
}

function cell(v: unknown): string | number | boolean {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export async function runSheetSync(sb: SupabaseClient<Database>) {
  const { data: settings } = await sb.from("sheet_sync_settings").select("*").eq("id", true).maybeSingle();
  const url = settings?.webhook_url;
  if (!url || !settings.enabled) return { ok: false as const, error: "لم يتم ضبط رابط المزامنة" };
  if (!isValidWebhook(url)) return { ok: false as const, error: "الرابط ليس رابط Apps Script صالح" };

  const sheets: { name: string; rows: (string | number | boolean)[][] }[] = [];
  for (const t of TABLES) {
    let res = await sb.from(t.table).select("*").order(t.order as never, { ascending: true }).limit(20000);
    if (res.error) res = await sb.from(t.table).select("*").limit(20000);
    const data = (res.data ?? []) as Record<string, unknown>[];
    const cols = data.length ? Object.keys(data[0]!).filter((c) => !HIDDEN.has(c)) : [];
    sheets.push({ name: t.tab, rows: cols.length ? [cols, ...data.map((r) => cols.map((c) => cell(r[c])))] : [["لا توجد بيانات"]] });
  }
  sheets.push({ name: "آخر مزامنة", rows: [["الوقت"], [new Date().toISOString()]] });

  let status: string;
  let ok = false;
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ sheets }), redirect: "follow" });
    const text = await r.text();
    ok = r.ok && text.includes("ok");
    status = ok ? "تمت المزامنة" : `فشل [${r.status}]: ${text.slice(0, 200)}`;
  } catch (e) {
    status = `فشل الاتصال: ${(e as Error).message}`;
  }
  await sb.from("sheet_sync_settings").update({ last_sync_at: new Date().toISOString(), last_status: status }).eq("id", true);
  return ok ? { ok: true as const } : { ok: false as const, error: status };
}
