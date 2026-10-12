import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CreativeItem = { kind: string; title: string; content: string };
export type TaskDraft = { title: string; due_at: string; kind: string; recurrence: string; note: string | null; client_id: string | null };

const LANG = "اكتب بالعربية الفصحى المبسطة مع لهجة خليجية خفيفة في النصوص الإعلانية. لا تخترع أرقاماً غير موجودة.";

export const generateCreative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    clientId: z.string().uuid(), platform: z.string().max(40), audience: z.string().max(500), offer: z.string().max(500),
    kinds: z.array(z.enum(["hook", "angle", "copy", "script"])).min(1).max(4),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { askAI, aiErrorMessage, parseJson } = await import("./ai.server");
    const { data: c } = await context.supabase.from("clients").select("project_name,industry,notes").eq("id", data.clientId).maybeSingle();
    if (!c) return { ok: false as const, error: "العميل غير موجود" };
    const labels = { hook: "هوكات أول 3 ثوانٍ (5)", angle: "زوايا تسويقية (4)", copy: "نصوص إعلانية كاملة (3)", script: "سيناريو فيديو قصير مقسم بالثواني (2)" };
    try {
      const text = await askAI(
        `أنت كاتب إعلانات وخبير ميديا باينج محترف في السوق السعودي والخليجي. ${LANG} أعد فقط JSON بالشكل: {"items":[{"kind":"hook|angle|copy|script","title":"عنوان قصير","content":"النص"}]}`,
        `المشروع: ${c.project_name}\nالمجال: ${c.industry ?? "غير محدد"}\nملاحظات: ${c.notes ?? "-"}\nالمنصة: ${data.platform}\nالجمهور المستهدف: ${data.audience || "غير محدد"}\nالعرض/المنتج: ${data.offer || "-"}\nالمطلوب: ${data.kinds.map((k) => labels[k]).join("، ")}. التزم بأسلوب وطول المنصة.`,
      );
      const parsed = parseJson<{ items: CreativeItem[] }>(text);
      const items = (parsed?.items ?? []).filter((i) => i && i.content).map((i) => ({ kind: String(i.kind || "hook"), title: String(i.title || "").slice(0, 200), content: String(i.content).slice(0, 4000) }));
      if (!items.length) return { ok: false as const, error: "لم يتمكن المساعد من صياغة نتائج، جرّب تفاصيل أوضح." };
      return { ok: true as const, items };
    } catch (e) { return { ok: false as const, error: aiErrorMessage(e) }; }
  });

export const analyzeCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { askAI, aiErrorMessage } = await import("./ai.server");
    const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const [{ data: c }, { data: rows }] = await Promise.all([
      context.supabase.from("clients").select("project_name,industry,currency").eq("id", data.clientId).maybeSingle(),
      context.supabase.from("campaign_entries").select("entry_date,platform,spend,clicks,impressions,purchases,revenue,leads").eq("client_id", data.clientId).gte("entry_date", since).order("entry_date"),
    ]);
    if (!c) return { ok: false as const, error: "العميل غير موجود" };
    if (!rows?.length) return { ok: false as const, error: "لا توجد بيانات حملات في آخر 30 يوماً لتحليلها." };
    const table = rows.map((r) => [r.entry_date, r.platform, r.spend, r.clicks, r.impressions, r.purchases, r.revenue, r.leads].join(",")).join("\n");
    try {
      const text = await askAI(
        `أنت ميديا باير خبير. حلل الأداء اليومي واكتب توصيات عملية مختصرة بصيغة Markdown بالعربية تحت العناوين: ## الخلاصة، ## تنبيهات (إجهاد الإعلانات Ad Fatigue، هبوط CTR، ارتفاع CPA، ضعف ROAS)، ## توصيات تنفيذية (إعادة توزيع الميزانية بين المنصات، اختبارات كرييتف)، ## مؤشرات للمراقبة. احسب CTR=clicks/impressions وCPA=spend/purchases وROAS=revenue/spend وقارن آخر 7 أيام بما قبلها. لا تخترع أرقاماً.`,
        `المشروع: ${c.project_name} (${c.industry ?? "-"}) العملة ${c.currency}\ndate,platform,spend,clicks,impressions,purchases,revenue,leads\n${table}`,
      );
      return { ok: true as const, text };
    } catch (e) { return { ok: false as const, error: aiErrorMessage(e) }; }
  });

export const draftTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ request: z.string().min(2).max(1000), now: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { askAI, aiErrorMessage, parseJson } = await import("./ai.server");
    const { data: clients } = await context.supabase.from("clients").select("id,project_name,client_name").eq("is_active", true).limit(200);
    const list = (clients ?? []).map((c) => `${c.id}: ${c.project_name} / ${c.client_name}`).join("\n");
    try {
      const text = await askAI(
        `حوّل طلب المستخدم إلى مهمة. أعد فقط JSON: {"title":"","due_at":"ISO 8601 بتوقيت UTC","kind":"task|haraj|personal_ad|limit|reminder","recurrence":"none|daily|weekly|monthly","note":null,"client_id":null}. client_id من القائمة فقط إن ذُكر العميل. الوقت الحالي للمستخدم: ${data.now}.`,
        `العملاء:\n${list || "لا يوجد"}\n\nالطلب: ${data.request}`,
      );
      const t = parseJson<TaskDraft>(text);
      if (!t?.title) return { ok: false as const, error: "لم أفهم الطلب، اكتبه بتفاصيل أكثر." };
      const ids = new Set((clients ?? []).map((c) => c.id));
      const due = new Date(t.due_at);
      return { ok: true as const, task: {
        title: String(t.title).slice(0, 200),
        due_at: isNaN(due.getTime()) ? new Date().toISOString() : due.toISOString(),
        kind: ["task", "haraj", "personal_ad", "limit", "reminder"].includes(t.kind) ? t.kind : "task",
        recurrence: ["none", "daily", "weekly", "monthly"].includes(t.recurrence) ? t.recurrence : "none",
        note: t.note ? String(t.note).slice(0, 1000) : null,
        client_id: t.client_id && ids.has(t.client_id) ? t.client_id : null,
      } satisfies TaskDraft };
    } catch (e) { return { ok: false as const, error: aiErrorMessage(e) }; }
  });
