import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Phone, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/lib/auth";
import { CURRENCY_NAMES, LEAD_STATUS, OUTCOMES, cur, fmtArDate, fmtArDateTime, telLink, waLink } from "@/lib/crm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStaff } from "@/lib/staff";
import { ServiceField } from "@/components/ServiceField";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/leads/$id")({
  head: () => ({
    meta: [
      { title: "كارت المتابعة — لوحة التشغيل" },
      { name: "description", content: "سجل متابعة العميل المحتمل." },
      { property: "og:title", content: "كارت المتابعة" },
      { property: "og:description", content: "سجل متابعة العميل." },
    ],
  }),
  component: LeadCard,
});

function LeadCard() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { data: me } = useMe();
  const { data: staff } = useStaff();
  const canEdit = !!(me?.is("admin") || me?.is("sales"));
  const [outcome, setOutcome] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const [l, f] = await Promise.all([
        supabase.from("leads").select("*").eq("id", id).maybeSingle(),
        supabase.from("lead_followups").select("*").eq("lead_id", id).order("attempt_no", { ascending: false }),
      ]);
      return { lead: l.data, followups: f.data ?? [] };
    },
  });
  const lead = data?.lead;
  if (data && !lead) return <p>الكارت غير موجود.</p>;
  if (!lead) return <p className="text-muted-foreground">جارِ التحميل...</p>;
  const st = LEAD_STATUS[lead.status] ?? LEAD_STATUS["following"]!;
  const nextNo = (data?.followups[0]?.attempt_no ?? 0) + 1;
  const caller = me?.user.user_metadata?.["full_name"] ?? me?.user.email ?? "";

  async function addFollowup() {
    const finalOutcome = outcome === "other" ? other.trim() : outcome;
    if (!finalOutcome) return void toast.error("اختر نتيجة المتابعة");
    setBusy(true);
    const { error } = await supabase.from("lead_followups").insert({ lead_id: id, attempt_no: nextNo, outcome: finalOutcome, note: note.trim() || null, caller_name: caller });
    setBusy(false);
    if (error) return void toast.error(error.message);
    setOutcome(null); setOther(""); setNote("");
    toast.success(`تم حفظ المتابعة ${nextNo}`);
    refetch();
  }

  async function patch(p: { rep_id?: string; rep_name?: string | null; currency?: string; service?: string | null; next_followup_at?: string | null; client_name?: string; project_name?: string | null; phone?: string | null }) {
    const { error } = await supabase.from("leads").update(p).eq("id", id);
    if (error) return void toast.error(error.message);
    toast.success("تم التحديث");
    refetch();
  }

  async function setStatus(s: string) {
    if (s === "done") {
      const { data: cid, error } = await supabase.rpc("convert_lead_to_client", { _lead: id });
      if (error) return void toast.error(error.message);
      toast.success("تم التنفيذ — أُنشئ بروفايل عميل نشط");
      nav({ to: "/clients/$id", params: { id: cid as string } });
      return;
    }
    const { error } = await supabase.from("leads").update({ status: s }).eq("id", id);
    if (error) return void toast.error(error.message);
    refetch();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="luxe-card overflow-hidden">
        <div className="space-y-3 p-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>متابعة <span className="num text-gold">#{lead.seq}</span> · {fmtArDate(lead.created_at)}</span>
            <span className={`rounded-full border px-3 py-1 ${st.cls}`}>{st.label}</span>
          </div>
          <p className="text-sm text-muted-foreground">{lead.project_name || "—"}{lead.rep_name ? ` · مسؤول خدمة العملاء: ${lead.rep_name}` : ""} · العملة: {cur(lead.currency)}</p>
          <h1 className="text-3xl font-bold">{lead.client_name}</h1>
          {lead.service && <p className="text-gold">{lead.service}</p>}
          {lead.phone && (
            <div className="flex gap-2 pt-2">
              <a href={telLink(lead.phone)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-call px-4 py-3 font-medium text-call-foreground"><Phone className="h-5 w-5" /> اتصال <span className="num text-sm">{lead.phone}</span></a>
              <a href={waLink(lead.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-success/40 px-4 py-3 text-success"><MessageCircle className="h-5 w-5" /> واتساب</a>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="grid gap-3 border-t border-border p-6 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">مسؤول خدمة العملاء</p>
              <Select value={lead.rep_id ?? ""} onValueChange={(x) => patch({ rep_id: x, rep_name: staff?.find((u) => u.id === x)?.name ?? null })}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{staff?.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">الخدمة</p>
              <ServiceField value={lead.service ?? ""} onChange={(v) => { if (v) patch({ service: v }); }} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">موعد المتابعة القادمة (تنبيه)</p>
              <Input type="datetime-local" className="num" defaultValue={lead.next_followup_at ? new Date(new Date(lead.next_followup_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} onBlur={(e) => patch({ next_followup_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">اسم العميل</p>
              <Input defaultValue={lead.client_name} maxLength={120} onBlur={(e) => e.target.value.trim() && e.target.value !== lead.client_name && patch({ client_name: e.target.value.trim() })} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">الجوال</p>
              <Input dir="ltr" defaultValue={lead.phone ?? ""} maxLength={30} onBlur={(e) => e.target.value !== (lead.phone ?? "") && patch({ phone: e.target.value.trim() || null })} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">عملة العميل</p>
              <Select value={lead.currency} onValueChange={(x) => patch({ currency: x })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CURRENCY_NAMES).map(([k, l]) => <SelectItem key={k} value={k}>{l} ({cur(k)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="border-t border-border p-6">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">سجل المتابعات</h2>
          {data.followups.length === 0 && <p className="text-sm text-muted-foreground">لا توجد متابعات سابقة.</p>}
          <ol className="space-y-3">
            {data.followups.map((f) => (
              <li key={f.id} className="flex gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold">{f.attempt_no}</span>
                <div className="flex-1">
                  <p className="font-medium">{f.outcome}</p>
                  {f.note && <p className="text-muted-foreground">{f.note}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{f.caller_name} · {fmtArDateTime(f.created_at)}</p>
                </div>
                {canEdit && <button onClick={async () => { await supabase.from("lead_followups").delete().eq("id", f.id); refetch(); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
              </li>
            ))}
          </ol>
        </div>

        {canEdit && lead.status === "following" && (
          <div className="space-y-3 border-t border-border p-6">
            <h2 className="text-sm font-semibold">المتابعة <span className="num text-gold">{nextNo}</span> — النتيجة</h2>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((o) => <Button key={o} size="sm" variant={outcome === o ? "default" : "outline"} onClick={() => setOutcome(o)}>{o}</Button>)}
              <Button size="sm" variant={outcome === "other" ? "default" : "outline"} onClick={() => setOutcome("other")}>أخرى...</Button>
            </div>
            {outcome === "other" && <Textarea placeholder="اكتب نتيجة المتابعة" maxLength={500} value={other} onChange={(e) => setOther(e.target.value)} />}
            <Textarea placeholder="ملاحظات (اختياري)" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button onClick={addFollowup} disabled={busy}>حفظ المتابعة</Button>
          </div>
        )}

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border p-6">
            <Button className="bg-success text-primary-foreground hover:bg-success/90" onClick={() => setStatus("done")}>تم التنفيذ</Button>
            <Button variant="outline" onClick={() => setStatus("following")}>جاري المتابعة</Button>
            <Button variant="outline" className="text-destructive" onClick={() => setStatus("cancelled")}>غير مهتم / ملغي</Button>
            <Button variant="ghost" className="ms-auto text-destructive" onClick={async () => { if (!confirm("حذف كارت المتابعة نهائياً؟")) return; await supabase.from("leads").delete().eq("id", id); nav({ to: "/leads" }); }}>
              <Trash2 className="h-4 w-4" /> حذف
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
