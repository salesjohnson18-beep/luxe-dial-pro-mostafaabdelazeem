import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Phone, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMe } from "@/lib/auth";
import { LEAD_STATUS, fmtArDate, telLink, waLink } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/leads/")({
  head: () => ({
    meta: [
      { title: "العملاء المحتملون والمتابعة — لوحة التشغيل" },
      { name: "description", content: "كروت المتابعة والعملاء المحتملين." },
      { property: "og:title", content: "العملاء المحتملون" },
      { property: "og:description", content: "كروت المتابعة والعملاء المحتملين." },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const { data: me } = useMe();
  const canEdit = !!(me?.is("admin") || me?.is("sales"));
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("following");
  const [q, setQ] = useState("");
  const { data: leads } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => (await supabase.from("leads").select("*, lead_followups(count)").order("created_at", { ascending: false })).data ?? [],
  });
  const shown = (leads ?? []).filter((l) => (filter === "all" || l.status === filter) && (!q || `${l.client_name} ${l.project_name ?? ""} ${l.phone ?? ""}`.includes(q)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-6">
        <h1 className="text-3xl font-bold">العملاء المحتملون</h1>
        {canEdit && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> كارت متابعة جديد</Button>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {[["following", "جاري المتابعة"], ["done", "تم التنفيذ"], ["cancelled", "ملغي"], ["all", "الكل"]].map(([k, l]) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k!)}>{l}</Button>
        ))}
        <div className="relative ms-auto">
          <Search className="absolute end-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="w-56 pe-9" placeholder="بحث بالاسم أو الجوال" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {shown.length === 0 && <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">لا توجد كروت هنا.</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((l) => {
          const st = LEAD_STATUS[l.status] ?? LEAD_STATUS["following"]!;
          const count = (l.lead_followups as unknown as { count: number }[])?.[0]?.count ?? 0;
          return (
            <div key={l.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="num">#{l.seq}</span>
                <span className={`rounded-full border px-2 py-0.5 ${st.cls}`}>{st.label}</span>
              </div>
              <Link to="/leads/$id" params={{ id: l.id }} className="mt-3 block">
                <h3 className="text-lg font-bold hover:text-gold">{l.client_name}</h3>
                <p className="text-sm text-muted-foreground">{[l.project_name, l.service].filter(Boolean).join(" · ") || "—"}</p>
              </Link>
              <p className="mt-2 text-xs text-muted-foreground">{fmtArDate(l.created_at)} · <span className="num">{count}</span> متابعة</p>
              {l.phone && (
                <div className="mt-4 flex gap-2">
                  <a href={telLink(l.phone)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-call px-3 py-2 text-sm text-call-foreground"><Phone className="h-4 w-4" /> اتصال</a>
                  <a href={waLink(l.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-md border border-success/40 px-3 py-2 text-sm text-success"><MessageCircle className="h-4 w-4" /> واتساب</a>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>كارت متابعة جديد</DialogTitle></DialogHeader>
          <NewLeadForm
            repName={me?.user.user_metadata?.["full_name"] ?? me?.user.email ?? ""}
            onCreated={(id) => { setOpen(false); nav({ to: "/leads/$id", params: { id } }); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewLeadForm({ repName, onCreated }: { repName: string; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ client_name: "", project_name: "", phone: "", service: "", notes: "", rep_name: repName });
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const { data, error } = await supabase.from("leads").insert({
          client_name: f.client_name.trim(), project_name: f.project_name.trim() || null, phone: f.phone.trim() || null,
          service: f.service.trim() || null, notes: f.notes.trim() || null, rep_name: f.rep_name.trim() || null,
        }).select("id").single();
        if (error) return void toast.error(error.message);
        onCreated(data.id);
      }}
    >
      <div className="space-y-1"><Label>اسم العميل</Label><Input required maxLength={120} value={f.client_name} onChange={(e) => setF({ ...f, client_name: e.target.value })} /></div>
      <div className="space-y-1"><Label>اسم المتجر / المشروع</Label><Input maxLength={120} value={f.project_name} onChange={(e) => setF({ ...f, project_name: e.target.value })} /></div>
      <div className="space-y-1"><Label>رقم الجوال</Label><Input dir="ltr" maxLength={30} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      <div className="space-y-1"><Label>الخدمة / المنتج</Label><Input maxLength={200} value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })} /></div>
      <div className="space-y-1"><Label>المندوب</Label><Input maxLength={100} value={f.rep_name} onChange={(e) => setF({ ...f, rep_name: e.target.value })} /></div>
      <div className="space-y-1"><Label>ملاحظات</Label><Textarea maxLength={2000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      <Button type="submit">إنشاء الكارت</Button>
    </form>
  );
}
