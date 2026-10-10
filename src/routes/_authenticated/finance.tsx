import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCY_NAMES, cur, fmtArDate } from "@/lib/crm";
import { fmt, today } from "@/lib/metrics";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "الماليات والدفعات — لوحة التشغيل" },
      { name: "description", content: "الدفعات المستحقة والدخل والمصروفات وصافي الربح." },
      { property: "og:title", content: "الماليات والدفعات" },
      { property: "og:description", content: "الدفعات المستحقة والدخل والمصروفات." },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const [tab, setTab] = useState<"due" | "paid" | "ledger">("due");
  const { data: inst, refetch: r1 } = useQuery({
    queryKey: ["installments"],
    queryFn: async () => (await supabase.from("client_installments").select("*, clients(id,client_name,project_name,phone)").order("due_date")).data ?? [],
  });
  const { data: ledger, refetch: r2 } = useQuery({
    queryKey: ["finance"],
    queryFn: async () => (await supabase.from("finance_entries").select("*, clients(project_name)").order("entry_date", { ascending: false })).data ?? [],
  });
  const refetch = () => { r1(); r2(); };
  const t = today();

  async function setPaid(id: string, paid: boolean) {
    const { error } = await supabase.rpc("set_installment_paid", { _id: id, _paid: paid });
    if (error) return void toast.error(error.message);
    toast.success(paid ? "تم تسجيل السداد وإضافته للدخل" : "تم إلغاء السداد");
    refetch();
  }

  // Totals per currency
  const totals: Record<string, { income: number; expense: number; due: number }> = {};
  for (const e of ledger ?? []) { const x = (totals[e.currency] ??= { income: 0, expense: 0, due: 0 }); x[e.kind === "income" ? "income" : "expense"] += Number(e.amount); }
  for (const i of inst ?? []) if (!i.paid) (totals[i.currency] ??= { income: 0, expense: 0, due: 0 }).due += Number(i.amount);

  const list = (inst ?? []).filter((i) => (tab === "paid" ? i.paid : !i.paid));

  return (
    <div className="space-y-6">
      <h1 className="border-b border-border pb-6 text-3xl font-bold">الماليات والدفعات</h1>
      {Object.keys(totals).length === 0 && <p className="text-sm text-muted-foreground">لا توجد حركات مالية بعد. أضف إجمالي التعاقد في بيانات العميل لتظهر دفعاته هنا.</p>}
      {Object.entries(totals).map(([c, x]) => (
        <div key={c} className="grid gap-3 sm:grid-cols-4">
          {[["المقبوضات", x.income, "text-success"], ["المصروفات", x.expense, "text-destructive"], ["صافي الربح", x.income - x.expense, "text-gold"], ["مستحق لم يُحصّل", x.due, ""]].map(([l, v, cls]) => (
            <div key={l as string} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{l as string}</p>
              <p className={`num mt-1 text-2xl ${cls}`}>{fmt(v as number)} <span className="font-sans text-sm">{cur(c)}</span></p>
            </div>
          ))}
        </div>
      ))}
      <div className="flex gap-2">
        {([["due", "الدفعات المستحقة"], ["paid", "الدفعات المسددة"], ["ledger", "الدخل والمصروفات"]] as const).map(([k, l]) => (
          <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>{l}</Button>
        ))}
      </div>

      {tab !== "ledger" ? (
        <div className="space-y-2">
          {list.length === 0 && <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">لا توجد دفعات.</div>}
          {list.map((i) => {
            const c = i.clients as { id: string; client_name: string; project_name: string } | null;
            const late = !i.paid && i.due_date < t;
            const dueToday = !i.paid && i.due_date === t;
            return (
              <div key={i.id} className={`flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 ${late ? "border-destructive/50" : dueToday ? "border-gold/60" : "border-border"}`}>
                <div className="min-w-0 flex-1">
                  {c && <Link to="/clients/$id" params={{ id: c.id }} className="font-medium hover:text-gold">{c.project_name} — {c.client_name}</Link>}
                  <p className="mt-1 text-sm">
                    الدفعة المستحقة: <span className="num text-gold">{fmt(Number(i.amount), Number(i.amount) % 1 ? 2 : 0)}</span> {cur(i.currency)} — الدفعة <span className="num">{i.number}</span> من <span className="num">{i.total_count}</span>
                    <span className="text-muted-foreground"> · الاتفاق <span className="num">{fmt(Number(i.agreement_total))}</span> {cur(i.currency)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{i.paid ? `سُددت ${i.paid_at ? fmtArDate(i.paid_at) : ""}` : `تستحق ${fmtArDate(i.due_date)}${late ? " — متأخرة" : dueToday ? " — اليوم" : ""}`}</p>
                </div>
                {i.paid ? (
                  <Button size="sm" variant="ghost" onClick={() => setPaid(i.id, false)}>إلغاء السداد</Button>
                ) : (
                  <Button size="sm" className="bg-success text-primary-foreground hover:bg-success/90" onClick={() => setPaid(i.id, true)}>العميل دفع ✓</Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Ledger rows={ledger ?? []} onChange={refetch} />
      )}
    </div>
  );
}

type LRow = { id: string; kind: string; amount: number; currency: string; category: string | null; note: string | null; entry_date: string; installment_id: string | null; clients: unknown };

function Ledger({ rows, onChange }: { rows: LRow[]; onChange: () => void }) {
  const [f, setF] = useState({ kind: "expense", amount: "", currency: "SAR", category: "", note: "", entry_date: today() });
  return (
    <div className="space-y-4">
      <form
        className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-7"
        onSubmit={async (e) => {
          e.preventDefault();
          const amount = Number(f.amount);
          if (!amount) return void toast.error("اكتب المبلغ");
          const { error } = await supabase.from("finance_entries").insert({ kind: f.kind, amount, currency: f.currency, category: f.category.trim() || null, note: f.note.trim() || null, entry_date: f.entry_date });
          if (error) return void toast.error(error.message);
          setF({ ...f, amount: "", category: "", note: "" });
          onChange();
        }}
      >
        <Select value={f.kind} onValueChange={(x) => setF({ ...f, kind: x })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="expense">مصروف</SelectItem><SelectItem value="income">دخل</SelectItem></SelectContent>
        </Select>
        <Input inputMode="decimal" className="num" placeholder="المبلغ" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} />
        <Select value={f.currency} onValueChange={(x) => setF({ ...f, currency: x })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.keys(CURRENCY_NAMES).map((k) => <SelectItem key={k} value={k}>{cur(k)}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="البند (اشتراكات، أدوات...)" maxLength={100} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <Input placeholder="ملاحظة" maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <Input type="date" className="num" value={f.entry_date} onChange={(e) => setF({ ...f, entry_date: e.target.value })} />
        <Button type="submit">إضافة</Button>
      </form>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">لا توجد حركات.</p>}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 text-sm">
            <span className={`num w-28 ${r.kind === "income" ? "text-success" : "text-destructive"}`}>{r.kind === "income" ? "+" : "-"}{fmt(Number(r.amount))} {cur(r.currency)}</span>
            <span className="flex-1">{r.category ?? "—"}{r.note ? ` · ${r.note}` : ""}{(r.clients as { project_name: string } | null)?.project_name ? ` · ${(r.clients as { project_name: string }).project_name}` : ""}</span>
            <span className="text-xs text-muted-foreground">{fmtArDate(r.entry_date)}</span>
            {!r.installment_id && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => { await supabase.from("finance_entries").delete().eq("id", r.id); onChange(); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
          </div>
        ))}
      </div>
    </div>
  );
}
