import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, MessageCircle, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAYMENT_TYPES, QUOTE_STATUS, cur, quoteMath, waLink } from "@/lib/crm";
import { fmt } from "@/lib/metrics";

export const Route = createFileRoute("/_authenticated/quotes/$id")({
  head: () => ({
    meta: [
      { title: "عرض سعر — لوحة التشغيل" },
      { name: "description", content: "تعديل ومشاركة عرض السعر." },
      { property: "og:title", content: "عرض سعر" },
      { property: "og:description", content: "تعديل ومشاركة عرض السعر." },
    ],
  }),
  component: QuotePage,
});

function QuotePage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { data, refetch } = useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      const [q, i] = await Promise.all([
        supabase.from("quotes").select("*").eq("id", id).maybeSingle(),
        supabase.from("quote_items").select("*").eq("quote_id", id).order("position"),
      ]);
      return { q: q.data, items: i.data ?? [] };
    },
  });
  const { data: services } = useQuery({
    queryKey: ["services-full"],
    queryFn: async () => (await supabase.from("services").select("*").eq("is_active", true).order("name")).data ?? [],
  });
  const q = data?.q;
  if (!data) return <p className="text-muted-foreground">جارِ التحميل...</p>;
  if (!q) return <p>العرض غير موجود.</p>;
  const m = quoteMath(data.items.map((i) => ({ ...i, price: Number(i.price) })), Number(q.discount), q.payment_type, q.installments);
  const st = QUOTE_STATUS[q.status] ?? QUOTE_STATUS["draft"]!;
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/q/${q.share_token}`;

  async function upd(p: Record<string, unknown>) {
    const { error } = await supabase.from("quotes").update({ ...p, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else refetch();
  }
  async function updItem(itemId: string, p: { price?: number; qty?: number }) {
    await supabase.from("quote_items").update(p).eq("id", itemId);
    refetch();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <p className="num text-xs text-gold">QUOTE #{q.seq}</p>
          <h1 className="text-3xl font-bold">{q.customer_name}</h1>
          <p className="text-muted-foreground">{q.project_name}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs ${st.cls}`}>{st.label}</span>
      </div>
      <div className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2" key={q.updated_at}>
        <div className="space-y-1"><p className="text-xs text-muted-foreground">اسم العميل</p><Input defaultValue={q.customer_name} maxLength={120} onBlur={(e) => e.target.value.trim() && e.target.value !== q.customer_name && upd({ customer_name: e.target.value.trim() })} /></div>
        <div className="space-y-1"><p className="text-xs text-muted-foreground">المشروع</p><Input defaultValue={q.project_name ?? ""} maxLength={120} onBlur={(e) => e.target.value !== (q.project_name ?? "") && upd({ project_name: e.target.value.trim() || null })} /></div>
        <div className="space-y-1"><p className="text-xs text-muted-foreground">الجوال</p><Input dir="ltr" defaultValue={q.phone ?? ""} maxLength={30} onBlur={(e) => e.target.value !== (q.phone ?? "") && upd({ phone: e.target.value.trim() || null })} /></div>
        <div className="space-y-1"><p className="text-xs text-muted-foreground">صالح حتى</p><Input type="date" className="num" defaultValue={q.valid_until ?? ""} onBlur={(e) => upd({ valid_until: e.target.value || null })} /></div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">نوع الدفع</p>
          <Select value={q.payment_type} onValueChange={(x) => upd({ payment_type: x, installments: x === "upfront" ? 1 : Math.max(q.installments, 2) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PAYMENT_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {q.payment_type !== "upfront" && <div className="space-y-1"><p className="text-xs text-muted-foreground">عدد الدفعات</p><Input type="number" min={1} max={60} className="num" defaultValue={q.installments} onBlur={(e) => upd({ installments: Math.max(1, Number(e.target.value) || 1) })} /></div>}
        <div className="space-y-1 sm:col-span-2"><p className="text-xs text-muted-foreground">ملاحظات تظهر للعميل</p><Textarea defaultValue={q.notes ?? ""} maxLength={2000} onBlur={(e) => e.target.value !== (q.notes ?? "") && upd({ notes: e.target.value || null })} /></div>
      </div>
      {q.client_response && <div className="rounded-lg border border-chart-3/40 p-4 text-sm">رد العميل: {q.client_response}</div>}
      <div className="space-y-2 rounded-xl border border-border bg-card p-5">
        {data.items.length === 0 && <p className="text-sm text-muted-foreground">لا توجد بنود.</p>}
        {data.items.map((i) => (
          <div key={i.id} className="flex items-center gap-2">
            <span className="flex-1">{i.name}</span>
            <Input className="num w-28" defaultValue={String(i.price)} onBlur={(e) => updItem(i.id, { price: Number(e.target.value) || 0 })} />
            <Input className="num w-16" type="number" min={1} defaultValue={i.qty} onBlur={(e) => updItem(i.id, { qty: Math.max(1, Number(e.target.value) || 1) })} />
            <Button size="icon" variant="ghost" onClick={async () => { await supabase.from("quote_items").delete().eq("id", i.id); refetch(); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Select value="" onValueChange={async (sid) => {
          const sv = services?.find((x) => x.id === sid); if (!sv) return;
          await supabase.from("quote_items").insert({ quote_id: id, service_id: sv.id, name: sv.name, description: sv.description, price: sv.price, qty: 1, position: data.items.length });
          refetch();
        }}>
          <SelectTrigger className="w-64"><SelectValue placeholder="+ إضافة خدمة من الدليل" /></SelectTrigger>
          <SelectContent>{services?.map((sv) => <SelectItem key={sv.id} value={sv.id}>{sv.name}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-2 pt-2 text-sm">
          <span className="flex-1 text-muted-foreground">خصم</span>
          <Input className="num w-28" defaultValue={String(q.discount)} onBlur={(e) => upd({ discount: Number(e.target.value) || 0 })} />
        </div>
        <p className="pt-3 text-lg">الإجمالي: <span className="num text-gold">{fmt(m.total)}</span> {cur(q.currency)}</p>
        <p className="text-sm text-muted-foreground">{PAYMENT_TYPES[q.payment_type]} {m.n > 1 && <>— <span className="num">{m.n}</span> دفعات × <span className="num">{fmt(m.per, 2)}</span> {cur(q.currency)}</>}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success("تم نسخ رابط العرض"); if (q.status === "draft") upd({ status: "sent" }); }}><Link2 className="h-4 w-4" /> نسخ رابط الموافقة</Button>
        {q.phone && <a href={waLink(q.phone, `عرض السعر الخاص بكم: ${link}`)} target="_blank" rel="noreferrer"><Button variant="outline" className="text-success"><MessageCircle className="h-4 w-4" /> إرسال واتساب</Button></a>}
        <Button className="bg-success text-primary-foreground hover:bg-success/90" onClick={async () => {
          const { data: cid, error } = await supabase.rpc("convert_quote_to_client", { _quote: id });
          if (error) return void toast.error(error.message);
          toast.success("تم التنفيذ — أُنشئ بروفايل العميل والدفعات");
          nav({ to: "/clients/$id", params: { id: cid as string } });
        }}>تم التنفيذ</Button>
        <Button variant="ghost" className="text-destructive" onClick={() => upd({ status: "cancelled" })}>إلغاء العرض</Button>
      </div>
    </div>
  );
}
