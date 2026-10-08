import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCY_NAMES, PAYMENT_TYPES, cur } from "@/lib/crm";

export type ServiceLite = { id: string; name: string; description: string | null; price: number; payment_terms?: string | null };

/** Creates a quote (optionally prefilled with a service) for an existing client or a new customer, then opens the editor. */
export function QuoteCreateDialog({ open, onOpenChange, service }: { open: boolean; onOpenChange: (o: boolean) => void; service?: ServiceLite | null }) {
  const nav = useNavigate();
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [clientId, setClientId] = useState("");
  const [f, setF] = useState({ customer_name: "", project_name: "", phone: "", currency: "SAR", payment_type: "upfront", installments: 1 });
  const [busy, setBusy] = useState(false);
  const { data: clients } = useQuery({
    queryKey: ["clients-lite"],
    enabled: open,
    queryFn: async () => (await supabase.from("clients").select("id,client_name,project_name,phone,currency").order("client_name")).data ?? [],
  });

  async function create() {
    const c = clients?.find((x) => x.id === clientId);
    if (mode === "existing" && !c) return void toast.error("اختر العميل");
    if (mode === "new" && !f.customer_name.trim()) return void toast.error("اكتب اسم العميل");
    setBusy(true);
    const { data: q, error } = await supabase.from("quotes").insert({
      client_id: c?.id ?? null,
      customer_name: c?.client_name ?? f.customer_name.trim(),
      project_name: c?.project_name ?? (f.project_name.trim() || null),
      phone: c?.phone ?? (f.phone.trim() || null),
      currency: c?.currency ?? f.currency,
      payment_type: f.payment_type,
      installments: f.payment_type === "upfront" ? 1 : f.installments,
    }).select("id").single();
    if (error) { setBusy(false); return void toast.error(error.message); }
    if (service) await supabase.from("quote_items").insert({ quote_id: q.id, service_id: service.id, name: service.name, description: service.description, price: service.price, qty: 1 });
    // New customer → also add to CRM as a lead
    if (!c) {
      const { data: lead } = await supabase.from("leads").insert({ client_name: f.customer_name.trim(), project_name: f.project_name.trim() || null, phone: f.phone.trim() || null, service: service?.name ?? null, currency: f.currency }).select("id").single();
      if (lead) await supabase.from("quotes").update({ lead_id: lead.id }).eq("id", q.id);
    }
    setBusy(false);
    onOpenChange(false);
    nav({ to: "/quotes/$id", params: { id: q.id } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>عرض سعر جديد{service ? ` — ${service.name}` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>عميل جديد</Button>
            <Button type="button" size="sm" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>عميل مسجل</Button>
          </div>
          {mode === "existing" ? (
            <div className="space-y-1">
              <Label>العميل</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="اختر عميلاً" /></SelectTrigger>
                <SelectContent>{clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_name} — {c.project_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>اسم العميل</Label><Input maxLength={120} value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} /></div>
              <div className="space-y-1"><Label>المشروع / المتجر</Label><Input maxLength={120} value={f.project_name} onChange={(e) => setF({ ...f, project_name: e.target.value })} /></div>
              <div className="space-y-1"><Label>الجوال</Label><Input dir="ltr" maxLength={30} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>العملة</Label>
                <Select value={f.currency} onValueChange={(x) => setF({ ...f, currency: x })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CURRENCY_NAMES).map(([k, l]) => <SelectItem key={k} value={k}>{l} ({cur(k)})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>نوع الدفع</Label>
              <Select value={f.payment_type} onValueChange={(x) => setF({ ...f, payment_type: x })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PAYMENT_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {f.payment_type !== "upfront" && (
              <div className="space-y-1"><Label>عدد الدفعات</Label><Input type="number" min={1} max={60} className="num" value={f.installments} onChange={(e) => setF({ ...f, installments: Math.max(1, Number(e.target.value) || 1) })} /></div>
            )}
          </div>
          <Button onClick={create} disabled={busy}>{busy ? "..." : "إنشاء العرض"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
