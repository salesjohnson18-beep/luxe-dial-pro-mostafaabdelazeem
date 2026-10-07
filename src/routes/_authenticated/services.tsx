import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMe } from "@/lib/auth";
import { fmt } from "@/lib/metrics";

export const Route = createFileRoute("/_authenticated/services")({
  head: () => ({
    meta: [
      { title: "دليل الخدمات — لوحة التشغيل" },
      { name: "description", content: "باقات الخدمات وأسعارها وشروط السداد." },
      { property: "og:title", content: "دليل الخدمات" },
      { property: "og:description", content: "باقات الخدمات وأسعارها." },
    ],
  }),
  component: ServicesPage,
});

type Svc = { id?: string; name: string; description: string | null; price: number; payment_terms: string | null; is_active: boolean };
const empty: Svc = { name: "", description: null, price: 0, payment_terms: null, is_active: true };

function ServicesPage() {
  const { data: me } = useMe();
  const canEdit = !!(me?.is("admin") || me?.is("sales"));
  const [edit, setEdit] = useState<Svc | null>(null);
  const { data, refetch } = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await supabase.from("services").select("*").order("created_at")).data ?? [],
  });

  async function save(s: Svc) {
    const payload = { name: s.name.trim(), description: s.description, price: Number(s.price) || 0, payment_terms: s.payment_terms, is_active: s.is_active };
    const { error } = s.id ? await supabase.from("services").update(payload).eq("id", s.id) : await supabase.from("services").insert(payload);
    if (error) return void toast.error(error.message);
    toast.success("تم الحفظ");
    setEdit(null);
    refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <h1 className="text-3xl font-bold">دليل الخدمات</h1>
        {canEdit && <Button onClick={() => setEdit(empty)}><Plus className="h-4 w-4" /> خدمة جديدة</Button>}
      </div>
      {data?.length === 0 && <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">لا توجد خدمات بعد. أضف أول باقة.</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((s) => (
          <div key={s.id} className={`rounded-xl border border-border bg-card p-5 ${s.is_active ? "" : "opacity-50"}`}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold">{s.name}</h3>
              {canEdit && (
                <div className="flex">
                  <Button size="icon" variant="ghost" onClick={() => setEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={async () => { if (!confirm("حذف الخدمة؟")) return; await supabase.from("services").delete().eq("id", s.id); refetch(); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
            {s.description && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{s.description}</p>}
            <p className="num mt-4 text-2xl text-gold">{fmt(Number(s.price))} <span className="font-sans text-sm">ر.س</span></p>
            {s.payment_terms && <p className="mt-1 text-xs text-muted-foreground">شروط السداد: {s.payment_terms}</p>}
          </div>
        ))}
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{edit?.id ? "تعديل خدمة" : "خدمة جديدة"}</DialogTitle></DialogHeader>
          {edit && <SvcForm initial={edit} onSave={save} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SvcForm({ initial, onSave }: { initial: Svc; onSave: (s: Svc) => void }) {
  const [s, setS] = useState(initial);
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave(s); }}>
      <div className="space-y-2"><Label>اسم الخدمة / الباقة</Label><Input required maxLength={120} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></div>
      <div className="space-y-2"><Label>الوصف</Label><Textarea maxLength={2000} value={s.description ?? ""} onChange={(e) => setS({ ...s, description: e.target.value || null })} /></div>
      <div className="space-y-2"><Label>السعر (ر.س)</Label><Input inputMode="decimal" className="num" value={String(s.price)} onChange={(e) => setS({ ...s, price: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} /></div>
      <div className="space-y-2"><Label>شروط السداد</Label><Input maxLength={300} placeholder="مثال: مقدم كامل / 4 دفعات أسبوعية" value={s.payment_terms ?? ""} onChange={(e) => setS({ ...s, payment_terms: e.target.value || null })} /></div>
      <label className="flex items-center justify-between text-sm">مفعّلة <Switch checked={s.is_active} onCheckedChange={(c) => setS({ ...s, is_active: c })} /></label>
      <Button type="submit">حفظ</Button>
    </form>
  );
}
