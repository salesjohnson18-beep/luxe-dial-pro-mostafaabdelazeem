import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDUSTRIES, fmt } from "@/lib/metrics";
import { CURRENCY_NAMES, PAYMENT_METHODS, cur } from "@/lib/crm";

export type ClientValues = {
  client_name: string;
  project_name: string;
  industry: string | null;
  contract_type: string;
  transfer_cycle: string;
  phone: string | null;
  notes: string | null;
  assigned_to: string | null;
  enable_monthly_sheet: boolean;
  enable_pricing: boolean;
  enable_inventory: boolean;
  currency: string;
  contract_total: number | null;
  payment_method: string;
  installments_count: number;
  work_start_date: string | null;
};

export const emptyClient: ClientValues = {
  client_name: "",
  project_name: "",
  industry: null,
  contract_type: "freelance",
  transfer_cycle: "weekly",
  phone: null,
  notes: null,
  assigned_to: null,
  enable_monthly_sheet: false,
  enable_pricing: false,
  enable_inventory: false,
  currency: "SAR",
  contract_total: null,
  payment_method: "upfront",
  installments_count: 1,
  work_start_date: new Date().toISOString().slice(0, 10),
};

export function ClientForm({
  initial,
  onSubmit,
  submitLabel,
  buyers,
}: {
  initial: ClientValues;
  onSubmit: (v: ClientValues) => Promise<void>;
  submitLabel: string;
  buyers?: { id: string; label: string }[] | undefined;
}) {
  const [v, setV] = useState<ClientValues>(initial);
  const isOther = !!v.industry && !INDUSTRIES.includes(v.industry);
  const [other, setOther] = useState(isOther);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ClientValues>(k: K, val: ClientValues[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit({ ...v, client_name: v.client_name.trim(), project_name: v.project_name.trim() });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>اسم العميل</Label>
          <Input required maxLength={120} value={v.client_name} onChange={(e) => set("client_name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>اسم المشروع</Label>
          <Input required maxLength={120} value={v.project_name} onChange={(e) => set("project_name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>المجال</Label>
          <Select
            value={other ? "__other" : v.industry ?? ""}
            onValueChange={(val) => {
              if (val === "__other") { setOther(true); set("industry", ""); }
              else { setOther(false); set("industry", val); }
            }}
          >
            <SelectTrigger><SelectValue placeholder="اختر المجال" /></SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              <SelectItem value="__other">أخرى...</SelectItem>
            </SelectContent>
          </Select>
          {other && <Input placeholder="اكتب المجال" maxLength={80} value={v.industry ?? ""} onChange={(e) => set("industry", e.target.value)} />}
        </div>
        <div className="space-y-2">
          <Label>رقم الجوال</Label>
          <Input dir="ltr" maxLength={30} value={v.phone ?? ""} onChange={(e) => set("phone", e.target.value || null)} />
        </div>
        <div className="space-y-2">
          <Label>نوع التعاقد</Label>
          <Select value={v.contract_type} onValueChange={(x) => set("contract_type", x)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="freelance">فري لانس</SelectItem>
              <SelectItem value="fulltime">دوام كامل</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>دورة التحويل</Label>
          <Select value={v.transfer_cycle} onValueChange={(x) => set("transfer_cycle", x)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">أسبوعي</SelectItem>
              <SelectItem value="monthly">شهري</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {buyers && buyers.length > 0 && (
          <div className="space-y-2">
            <Label>الميديا باير المسؤول</Label>
            <Select value={v.assigned_to ?? "none"} onValueChange={(x) => set("assigned_to", x === "none" ? null : x)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون</SelectItem>
                {buyers.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <FinanceFields v={v} set={set} />
      <div className="space-y-2">
        <Label>ملاحظات</Label>
        <Textarea maxLength={2000} value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
      </div>
      <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3">
        {([
          ["enable_monthly_sheet", "ورقة الأداء الشهري"],
          ["enable_pricing", "حاسبة تسعير المنتجات"],
          ["enable_inventory", "المخزون"],
        ] as const).map(([k, l]) => (
          <label key={k} className="flex items-center justify-between gap-2 text-sm">
            {l}
            <Switch checked={v[k]} onCheckedChange={(c) => set(k, c)} />
          </label>
        ))}
      </div>
      <Button type="submit" disabled={busy}>{busy ? "..." : submitLabel}</Button>
    </form>
  );
}

function FinanceFields({ v, set }: { v: ClientValues; set: <K extends keyof ClientValues>(k: K, val: ClientValues[K]) => void }) {
  const n = v.payment_method === "upfront" ? 1 : Math.max(1, v.installments_count || 1);
  const per = v.contract_total ? Math.round((v.contract_total / n) * 100) / 100 : 0;
  return (
    <div className="space-y-4 rounded-lg border border-gold/30 p-4">
      <p className="text-sm font-semibold text-gold">التعاقد المالي</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>العملة</Label>
          <Select value={v.currency} onValueChange={(x) => set("currency", x)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(CURRENCY_NAMES).map(([k, l]) => <SelectItem key={k} value={k}>{l} ({cur(k)})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>إجمالي قيمة التعاقد</Label>
          <Input inputMode="decimal" className="num" value={v.contract_total ?? ""} onChange={(e) => { const x = e.target.value.replace(/[^\d.]/g, ""); set("contract_total", x ? Number(x) : null); }} />
        </div>
        <div className="space-y-2">
          <Label>طريقة ودورة السداد</Label>
          <Select value={v.payment_method} onValueChange={(x) => set("payment_method", x)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PAYMENT_METHODS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {v.payment_method !== "upfront" && (
          <div className="space-y-2">
            <Label>عدد الدفعات</Label>
            <Input type="number" min={1} max={60} className="num" value={v.installments_count} onChange={(e) => set("installments_count", Math.max(1, Number(e.target.value) || 1))} />
          </div>
        )}
        <div className="space-y-2">
          <Label>تاريخ بدء العمل</Label>
          <Input type="date" className="num" value={v.work_start_date ?? ""} onChange={(e) => set("work_start_date", e.target.value || null)} />
        </div>
      </div>
      {!!v.contract_total && (
        <p className="text-sm text-muted-foreground">
          قيمة كل دفعة مستحقة: <span className="num text-gold">{fmt(per, per % 1 ? 2 : 0)}</span> {cur(v.currency)} × <span className="num">{n}</span> {n > 1 ? (v.payment_method === "monthly" ? "شهرياً" : "أسبوعياً") : "(مقدم)"}
        </p>
      )}
    </div>
  );
}
