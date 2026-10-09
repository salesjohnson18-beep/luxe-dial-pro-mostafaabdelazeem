import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_TYPES, QUOTE_STATUS, cur, fmtArDate, quoteMath } from "@/lib/crm";
import { fmt } from "@/lib/metrics";

export const Route = createFileRoute("/q/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "عرض سعر — Mostafa Abdelazeem" },
      { name: "description", content: "تفاصيل عرض السعر والموافقة عليه." },
      { property: "og:title", content: "عرض سعر" },
      { property: "og:description", content: "تفاصيل عرض السعر والموافقة عليه أو طلب تعديل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedQuote,
});

type SQ = {
  seq: number; customer_name: string; project_name: string | null; currency: string; payment_type: string; installments: number;
  discount: number; status: string; client_response: string | null; notes: string | null; valid_until: string | null; created_at: string;
  items: { name: string; description: string | null; price: number; qty: number }[];
};

function SharedQuote() {
  const { token } = Route.useParams();
  const [mode, setMode] = useState<"none" | "changes" | "edit">("none");
  const [note, setNote] = useState("");
  const [cust, setCust] = useState({ name: "", project: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const { data: q, isLoading, refetch } = useQuery({
    queryKey: ["sq", token],
    queryFn: async () => (await supabase.rpc("get_shared_quote", { _token: token })).data as SQ | null,
  });
  if (isLoading) return <p className="p-10 text-center text-muted-foreground">جارِ التحميل...</p>;
  if (!q) return <p className="p-10 text-center">الرابط غير صالح أو العرض ملغي.</p>;
  const m = quoteMath(q.items.map((i) => ({ ...i, service_id: null, price: Number(i.price) })), Number(q.discount), q.payment_type, q.installments);
  const c = cur(q.currency);
  const st = QUOTE_STATUS[q.status] ?? QUOTE_STATUS["draft"]!;
  const open = ["draft", "sent", "changes_requested"].includes(q.status);

  async function respond(action: "accepted" | "changes_requested") {
    if (action === "changes_requested" && !note.trim()) return void toast.error("اكتب التعديل المطلوب");
    setBusy(true);
    const { data, error } = await supabase.rpc("respond_quote", { _token: token, _action: action, _note: note.trim() });
    setBusy(false);
    if (error || data !== "ok") return void toast.error("تعذر إرسال الرد");
    toast.success(action === "accepted" ? "تم اعتماد العرض، شكراً لك" : "تم إرسال طلب التعديل");
    setMode("none"); setNote(""); refetch();
  }
  async function saveCustomer() {
    if (!cust.name.trim()) return void toast.error("اكتب الاسم");
    setBusy(true);
    const { data, error } = await supabase.rpc("update_shared_quote_customer", { _token: token, _name: cust.name, _project: cust.project, _phone: cust.phone });
    setBusy(false);
    if (error || data !== "ok") return void toast.error("تعذر حفظ البيانات");
    toast.success("تم تحديث بياناتك");
    setMode("none"); refetch();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 py-10" dir="rtl">
      <div className="luxe-card overflow-hidden">
        <div className="space-y-2 p-8">
          <div className="flex items-center justify-between">
            <p className="num text-xs tracking-[0.3em] text-gold">QUOTATION #{q.seq}</p>
            <span className={`rounded-full border px-3 py-1 text-xs ${st.cls}`}>{st.label}</span>
          </div>
          <h1 className="text-3xl font-bold">{q.customer_name}</h1>
          {q.project_name && <p className="text-muted-foreground">{q.project_name}</p>}
          <p className="text-xs text-muted-foreground">{fmtArDate(q.created_at)}{q.valid_until ? ` · صالح حتى ${fmtArDate(q.valid_until)}` : ""}</p>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {q.items.map((i, k) => (
            <div key={k} className="flex gap-4 px-8 py-4">
              <div className="flex-1">
                <p className="font-medium">{i.name}{i.qty > 1 && <span className="num text-muted-foreground"> × {i.qty}</span>}</p>
                {i.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{i.description}</p>}
              </div>
              <p className="num">{fmt(Number(i.price) * i.qty)} <span className="font-sans text-xs">{c}</span></p>
            </div>
          ))}
        </div>
        <div className="space-y-2 px-8 py-6">
          {Number(q.discount) > 0 && <p className="flex justify-between text-sm text-muted-foreground"><span>خصم</span><span className="num">-{fmt(Number(q.discount))} {c}</span></p>}
          <p className="flex justify-between text-xl"><span>الإجمالي</span><span className="num text-gold">{fmt(m.total)} <span className="font-sans text-sm">{c}</span></span></p>
          <p className="text-sm text-muted-foreground">طريقة الدفع: {PAYMENT_TYPES[q.payment_type]}</p>
          {m.n > 1 && (
            <ul className="space-y-1 pt-2 text-sm">
              {Array.from({ length: m.n }, (_, i) => (
                <li key={i} className="flex justify-between rounded border border-border px-3 py-1.5">
                  <span>الدفعة <span className="num">{i + 1}</span> من <span className="num">{m.n}</span></span>
                  <span className="num">{fmt(i === m.n - 1 ? m.total - m.per * (m.n - 1) : m.per, 2)} {c}</span>
                </li>
              ))}
            </ul>
          )}
          {q.notes && <p className="whitespace-pre-line pt-2 text-sm text-muted-foreground">{q.notes}</p>}
        </div>
        <div className="border-t border-border py-4 text-center">
          <p className="num text-[11px] tracking-[0.25em] text-muted-foreground">MOSTAFA ABDELAZEEM</p>
        </div>
      </div>

      {q.client_response && <div className="rounded-lg border border-border p-4 text-sm">ردك السابق: {q.client_response}</div>}

      {open && mode === "none" && (
        <div className="flex flex-wrap gap-2">
          <Button className="flex-1 bg-success text-primary-foreground hover:bg-success/90" disabled={busy} onClick={() => respond("accepted")}>موافقة واعتماد العرض</Button>
          <Button variant="outline" className="flex-1" onClick={() => setMode("changes")}>طلب تعديل</Button>
          <Button variant="ghost" onClick={() => { setCust({ name: q.customer_name, project: q.project_name ?? "", phone: "" }); setMode("edit"); }}>تصحيح بياناتي</Button>
        </div>
      )}
      {mode === "changes" && (
        <div className="space-y-2">
          <Textarea placeholder="اكتب التعديلات المطلوبة على العرض" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2"><Button disabled={busy} onClick={() => respond("changes_requested")}>إرسال طلب التعديل</Button><Button variant="ghost" onClick={() => setMode("none")}>إلغاء</Button></div>
        </div>
      )}
      {mode === "edit" && (
        <div className="space-y-2 rounded-xl border border-border p-4">
          <Input placeholder="الاسم" maxLength={120} value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} />
          <Input placeholder="اسم المشروع / المتجر" maxLength={120} value={cust.project} onChange={(e) => setCust({ ...cust, project: e.target.value })} />
          <Input dir="ltr" placeholder="رقم الجوال" maxLength={30} value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} />
          <div className="flex gap-2"><Button disabled={busy} onClick={saveCustomer}>حفظ البيانات</Button><Button variant="ghost" onClick={() => setMode("none")}>إلغاء</Button></div>
        </div>
      )}
      {q.status === "accepted" && <p className="text-center text-success">تم اعتماد العرض. سنتواصل معك لبدء العمل.</p>}
    </div>
  );
}
