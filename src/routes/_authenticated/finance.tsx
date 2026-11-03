import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Printer, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCOUNTS, CURRENCY_NAMES, EXPENSE_CATEGORIES, PAY_CHANNELS, cur, fmtArDate, invoiceStatus } from "@/lib/crm";
import { fmt, today } from "@/lib/metrics";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "المالية والمحاسبة — لوحة التشغيل" },
      { name: "description", content: "الدفعات والفواتير وكشوف الحساب والمصروفات وصافي الأرباح." },
      { property: "og:title", content: "المالية والمحاسبة" },
      { property: "og:description", content: "الدفعات والفواتير وكشوف الحساب وصافي الأرباح." },
    ],
  }),
  component: FinancePage,
});

type Client = { id: string; client_name: string; project_name: string; currency: string; contract_total: number | null; ad_budget: number | null };
type Inst = { id: string; client_id: string; amount: number; currency: string; number: number; total_count: number; agreement_total: number; due_date: string; paid: boolean; paid_at: string | null; payment_method: string | null; is_advance: boolean; postponed_count: number; clients: unknown };
type LRow = { id: string; kind: string; account: string; amount: number; currency: string; category: string | null; note: string | null; entry_date: string; installment_id: string | null; client_id: string | null; payment_method: string | null; clients: unknown };
type Inv = { id: string; seq: number; client_id: string; account: string; description: string; amount: number; currency: string; issue_date: string; due_date: string; status: string; share_token: string; clients: unknown };

const TABS = [["summary", "الملخص التنفيذي"], ["due", "المستحقات"], ["paid", "المسددة"], ["invoices", "الفواتير"], ["ledger", "المصروفات والدخل"], ["statement", "كشف حساب عميل"]] as const;

function FinancePage() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("summary");
  const inst = useQuery({ queryKey: ["installments"], queryFn: async () => ((await supabase.from("client_installments").select("*, clients(id,client_name,project_name,phone)").order("due_date")).data ?? []) as Inst[] });
  const ledger = useQuery({ queryKey: ["finance"], queryFn: async () => ((await supabase.from("finance_entries").select("*, clients(project_name)").order("entry_date", { ascending: false })).data ?? []) as LRow[] });
  const invoices = useQuery({ queryKey: ["invoices"], queryFn: async () => ((await supabase.from("invoices").select("*, clients(client_name,project_name)").order("seq", { ascending: false })).data ?? []) as Inv[] });
  const clients = useQuery({ queryKey: ["fin-clients"], queryFn: async () => ((await supabase.from("clients").select("id,client_name,project_name,currency,contract_total,ad_budget").order("project_name")).data ?? []) as Client[] });
  const refetch = () => { inst.refetch(); ledger.refetch(); invoices.refetch(); };
  const [confirmFor, setConfirmFor] = useState<Inst | null>(null);
  const t = today();
  const list = (inst.data ?? []).filter((i) => (tab === "paid" ? i.paid : !i.paid));

  return (
    <div className="space-y-6">
      <h1 className="border-b border-border pb-6 text-3xl font-bold">المالية والمحاسبة</h1>
      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, l]) => <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>{l}</Button>)}
      </div>

      {tab === "summary" && <Summary inst={inst.data ?? []} ledger={ledger.data ?? []} />}
      {(tab === "due" || tab === "paid") && (
        <div className="space-y-2">
          {list.length === 0 && <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">لا توجد دفعات. أضف إجمالي التعاقد في بيانات العميل لتظهر دفعاته هنا.</div>}
          {list.map((i) => {
            const c = i.clients as { id: string; client_name: string; project_name: string } | null;
            const late = !i.paid && i.due_date < t;
            const dueNow = !i.paid && i.due_date <= t;
            return (
              <div key={i.id} className={`flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 ${late ? "border-destructive/50" : dueNow ? "border-gold/60" : "border-border"}`}>
                <div className="min-w-0 flex-1">
                  {c && <Link to="/clients/$id" params={{ id: c.id }} className="font-medium hover:text-gold">{c.project_name} — {c.client_name}</Link>}
                  <p className="mt-1 text-sm">
                    {i.is_advance && i.total_count > 1 ? "دفعة مقدمة" : i.total_count === 0 ? "مستحق الدورة" : "الدفعة المستحقة"}: <span className="num text-gold">{fmt(Number(i.amount), Number(i.amount) % 1 ? 2 : 0)}</span> من إجمالي <span className="num">{fmt(Number(i.agreement_total))}</span> {cur(i.currency)} — {i.total_count === 0 ? `دورة متجددة رقم ${i.number}` : <>دفعة <span className="num">{i.number}</span> من <span className="num">{i.total_count}</span></>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {i.paid ? `سُددت ${i.paid_at ? fmtArDate(i.paid_at) : ""}${i.payment_method ? ` · ${i.payment_method}` : ""}` : `تستحق ${fmtArDate(i.due_date)}${late ? " — متأخرة" : i.due_date === t ? " — اليوم" : ""}${i.postponed_count ? ` · أُجّلت ${i.postponed_count}×` : ""}`}
                  </p>
                </div>
                {i.paid ? (
                  <Button size="sm" variant="ghost" onClick={async () => { const { error } = await supabase.rpc("set_installment_paid", { _id: i.id, _paid: false }); if (error) toast.error(error.message); refetch(); }}>إلغاء السداد</Button>
                ) : (
                  <Button size="sm" className={dueNow ? "bg-success text-primary-foreground hover:bg-success/90" : ""} variant={dueNow ? "default" : "outline"} onClick={() => setConfirmFor(i)}>{dueNow ? "هل تم تحويل الدفعة؟" : "تسجيل / تأجيل"}</Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {tab === "invoices" && <Invoices rows={invoices.data ?? []} clients={clients.data ?? []} onChange={refetch} />}
      {tab === "ledger" && <Ledger rows={ledger.data ?? []} clients={clients.data ?? []} onChange={refetch} />}
      {tab === "statement" && <Statement clients={clients.data ?? []} inst={inst.data ?? []} ledger={ledger.data ?? []} />}
      <ConfirmDialog inst={confirmFor} onClose={() => setConfirmFor(null)} onDone={refetch} />
    </div>
  );
}

export function ConfirmDialog({ inst, onClose, onDone }: { inst: { id: string; amount: number; currency: string; number: number; total_count: number; agreement_total: number; due_date: string } | null; onClose: () => void; onDone: () => void }) {
  const [method, setMethod] = useState(PAY_CHANNELS[0]!);
  const [date, setDate] = useState("");
  return (
    <Dialog open={!!inst} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>هل تم تحويل الدفعة؟</DialogTitle></DialogHeader>
        {inst && (
          <div className="space-y-4">
            <p className="text-sm">الدفعة المستحقة: <span className="num text-gold">{fmt(Number(inst.amount))}</span> من إجمالي <span className="num">{fmt(Number(inst.agreement_total))}</span> {cur(inst.currency)} — {inst.total_count === 0 ? `دورة متجددة رقم ${inst.number}` : <>دفعة <span className="num">{inst.number}</span> من <span className="num">{inst.total_count}</span></>}</p>
            <div className="space-y-2">
              <Label>وسيلة الدفع</Label>
              <Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAY_CHANNELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button className="w-full bg-success text-primary-foreground hover:bg-success/90" onClick={async () => {
              const { error } = await supabase.rpc("confirm_installment", { _id: inst.id, _method: method });
              if (error) return void toast.error(error.message);
              toast.success("تم تأكيد الاستلام وإضافته للمقبوضات"); onDone(); onClose();
            }}>نعم، تم الاستلام ✓</Button>
            <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
              <div className="min-w-0 flex-1 space-y-2"><Label>تأجيل الموعد إلى</Label><Input type="date" className="num" value={date} min={today()} onChange={(e) => setDate(e.target.value)} /></div>
              <Button variant="outline" disabled={!date} onClick={async () => {
                const { error } = await supabase.rpc("postpone_installment", { _id: inst.id, _date: date });
                if (error) return void toast.error(error.message);
                toast.success("تم تأجيل الموعد"); setDate(""); onDone(); onClose();
              }}>تأجيل</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Summary({ inst, ledger }: { inst: Inst[]; ledger: LRow[] }) {
  const tot: Record<string, { collected: number; pending: number; expense: number; otherIncome: number; adIn: number; adOut: number }> = {};
  const g = (c: string) => (tot[c] ??= { collected: 0, pending: 0, expense: 0, otherIncome: 0, adIn: 0, adOut: 0 });
  for (const e of ledger) {
    const x = g(e.currency); const a = Number(e.amount);
    if (e.account === "ad_budget") { if (e.kind === "income") x.adIn += a; else x.adOut += a; continue; }
    if (e.kind === "expense") x.expense += a; else if (e.installment_id) x.collected += a; else x.otherIncome += a;
  }
  for (const i of inst) if (!i.paid) g(i.currency).pending += Number(i.amount);
  if (Object.keys(tot).length === 0) return <p className="text-sm text-muted-foreground">لا توجد حركات مالية بعد.</p>;
  return (
    <div className="space-y-6">
      {Object.entries(tot).map(([c, x]) => {
        const income = x.collected + x.otherIncome;
        return (
          <div key={c} className="space-y-3">
            <p className="text-sm text-muted-foreground">{CURRENCY_NAMES[c] ?? c}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {([["إجمالي المحصل (أتعاب)", income, "text-success"], ["المستحقات المعلقة", x.pending, "text-gold"], ["إجمالي المصروفات", x.expense, "text-destructive"], ["صافي الأرباح الفعلي", income - x.expense, income - x.expense >= 0 ? "text-gold" : "text-destructive"]] as const).map(([l, v, cls]) => (
                <div key={l} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{l}</p>
                  <p className={`num mt-1 break-all text-2xl ${cls}`}>{fmt(v)} <span className="font-sans text-sm">{cur(c)}</span></p>
                </div>
              ))}
            </div>
            {(x.adIn > 0 || x.adOut > 0) && (
              <div className="rounded-xl border border-dashed border-border p-4 text-sm">
                <p className="mb-1 text-xs text-muted-foreground">ميزانية الإعلانات (حساب منفصل — لا تدخل في الأرباح)</p>
                مستلم: <span className="num">{fmt(x.adIn)}</span> · مصروف: <span className="num">{fmt(x.adOut)}</span> · رصيد: <span className="num text-gold">{fmt(x.adIn - x.adOut)}</span> {cur(c)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function shareUrl(token: string) { return `${window.location.origin}/i/${token}`; }

function Invoices({ rows, clients, onChange }: { rows: Inv[]; clients: Client[]; onChange: () => void }) {
  const t = today();
  const [f, setF] = useState({ client_id: "", account: "fees", description: "", amount: "", due_date: t });
  return (
    <div className="space-y-4">
      <form className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={async (e) => {
        e.preventDefault();
        const c = clients.find((x) => x.id === f.client_id);
        if (!c || !Number(f.amount) || !f.description.trim()) return void toast.error("اختر العميل واكتب الوصف والمبلغ");
        const { error } = await supabase.from("invoices").insert({ client_id: c.id, account: f.account, description: f.description.trim(), amount: Number(f.amount), currency: c.currency, due_date: f.due_date });
        if (error) return void toast.error(error.message);
        setF({ ...f, description: "", amount: "" }); toast.success("تم إصدار الفاتورة"); onChange();
      }}>
        <Select value={f.client_id} onValueChange={(x) => setF({ ...f, client_id: x })}><SelectTrigger><SelectValue placeholder="العميل" /></SelectTrigger><SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.project_name}</SelectItem>)}</SelectContent></Select>
        <Select value={f.account} onValueChange={(x) => setF({ ...f, account: x })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ACCOUNTS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="تفاصيل الخدمة" maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Input inputMode="decimal" className="num" placeholder="المبلغ" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} />
        <Input type="date" className="num" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
        <Button type="submit">إصدار فاتورة يدوية</Button>
      </form>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">لا توجد فواتير. تُنشأ تلقائياً مع كل دفعة.</p>}
      <div className="space-y-2">
        {rows.map((r) => {
          const st = invoiceStatus(r.status, r.due_date, t);
          const c = r.clients as { client_name: string; project_name: string } | null;
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
              <span className="num text-gold">#{String(r.seq).padStart(4, "0")}</span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{c?.project_name} — {r.description}</p>
                <p className="text-xs text-muted-foreground">{ACCOUNTS[r.account]} · إصدار {fmtArDate(r.issue_date)} · استحقاق {fmtArDate(r.due_date)}</p>
              </div>
              <span className="num">{fmt(Number(r.amount))} {cur(r.currency)}</span>
              <span className={`rounded-full border px-2 py-0.5 text-xs ${st.cls}`}>{st.label}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" title="عرض وطباعة" onClick={() => window.open(shareUrl(r.share_token), "_blank")}><Printer className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="نسخ الرابط" onClick={async () => { await navigator.clipboard.writeText(shareUrl(r.share_token)); toast.success("تم نسخ رابط الفاتورة"); }}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Ledger({ rows, clients, onChange }: { rows: LRow[]; clients: Client[]; onChange: () => void }) {
  const [f, setF] = useState({ kind: "expense", account: "fees", amount: "", currency: "SAR", category: EXPENSE_CATEGORIES[0]!, note: "", entry_date: today(), client_id: "none" });
  return (
    <div className="space-y-4">
      <form className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={async (e) => {
        e.preventDefault();
        const amount = Number(f.amount);
        if (!amount) return void toast.error("اكتب المبلغ");
        const { error } = await supabase.from("finance_entries").insert({ kind: f.kind, account: f.account, amount, currency: f.currency, category: f.category.trim() || null, note: f.note.trim() || null, entry_date: f.entry_date, client_id: f.client_id === "none" ? null : f.client_id });
        if (error) return void toast.error(error.message);
        setF({ ...f, amount: "", note: "" }); onChange();
      }}>
        <Select value={f.account} onValueChange={(x) => setF({ ...f, account: x })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ACCOUNTS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <Select value={f.kind} onValueChange={(x) => setF({ ...f, kind: x })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="expense">مصروف</SelectItem><SelectItem value="income">دخل / استلام</SelectItem></SelectContent></Select>
        <Input inputMode="decimal" className="num" placeholder="المبلغ" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} />
        <Select value={f.currency} onValueChange={(x) => setF({ ...f, currency: x })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(CURRENCY_NAMES).map((k) => <SelectItem key={k} value={k}>{cur(k)}</SelectItem>)}</SelectContent></Select>
        <Select value={EXPENSE_CATEGORIES.includes(f.category) ? f.category : "أخرى"} onValueChange={(x) => setF({ ...f, category: x })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>
        <Select value={f.client_id} onValueChange={(x) => setF({ ...f, client_id: x })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">بدون عميل</SelectItem>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.project_name}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="ملاحظة" maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <Input type="date" className="num" value={f.entry_date} onChange={(e) => setF({ ...f, entry_date: e.target.value })} />
        <Button type="submit" className="lg:col-span-4">إضافة</Button>
      </form>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">لا توجد حركات.</p>}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm sm:flex">
            <span className={`num min-w-0 break-all sm:w-28 ${r.kind === "income" ? "text-success" : "text-destructive"}`}>{r.kind === "income" ? "+" : "-"}{fmt(Number(r.amount))} {cur(r.currency)}</span>
            <span className="col-span-2 row-start-2 min-w-0 break-words sm:flex-1">
              <span className={`me-2 rounded border px-1.5 text-[11px] ${r.account === "ad_budget" ? "border-chart-3/40 text-chart-3" : "border-gold/40 text-gold"}`}>{r.account === "ad_budget" ? "إعلانات" : "أتعاب"}</span>
              {r.category ?? "—"}{r.note ? ` · ${r.note}` : ""}{r.payment_method ? ` · ${r.payment_method}` : ""}{(r.clients as { project_name: string } | null)?.project_name ? ` · ${(r.clients as { project_name: string }).project_name}` : ""}
            </span>
            <span className="text-xs text-muted-foreground">{fmtArDate(r.entry_date)}</span>
            {!r.installment_id && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => { await supabase.from("finance_entries").delete().eq("id", r.id); onChange(); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Statement({ clients, inst, ledger }: { clients: Client[]; inst: Inst[]; ledger: LRow[] }) {
  const [id, setId] = useState("");
  const c = clients.find((x) => x.id === id);
  const spend = useQuery({
    queryKey: ["stmt-spend", id], enabled: !!id,
    queryFn: async () => ((await supabase.from("campaign_entries").select("spend").eq("client_id", id)).data ?? []).reduce((a, r) => a + Number(r.spend), 0),
  });
  const mine = inst.filter((i) => i.client_id === id);
  const agreed = c?.contract_total ? Number(c.contract_total) : mine.reduce((a, i) => a + Number(i.amount), 0);
  const received = mine.filter((i) => i.paid).reduce((a, i) => a + Number(i.amount), 0);
  const adIn = ledger.filter((e) => e.client_id === id && e.account === "ad_budget" && e.kind === "income").reduce((a, e) => a + Number(e.amount), 0);
  const tx = ledger.filter((e) => e.client_id === id);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Select value={id} onValueChange={setId}><SelectTrigger className="w-72 max-w-full"><SelectValue placeholder="اختر العميل" /></SelectTrigger><SelectContent>{clients.map((x) => <SelectItem key={x.id} value={x.id}>{x.project_name} — {x.client_name}</SelectItem>)}</SelectContent></Select>
        {c && <Button variant="outline" onClick={() => window.print()}><Printer className="me-2 h-4 w-4" />طباعة</Button>}
      </div>
      {c && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div><p className="text-lg font-bold">كشف حساب: {c.project_name}</p><p className="text-sm text-muted-foreground">{c.client_name} · {fmtArDate(today())}</p></div>
          <p className="text-sm font-semibold text-gold">أتعاب الإدارة والتسويق</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {([["إجمالي المتفق عليه", agreed, ""], ["إجمالي المقبوضات", received, "text-success"], ["الرصيد المتبقي", agreed - received, "text-gold"]] as const).map(([l, v, cls]) => (
              <div key={l} className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{l}</p><p className={`num text-xl ${cls}`}>{fmt(v)} {cur(c.currency)}</p></div>
            ))}
          </div>
          <p className="text-sm font-semibold text-chart-3">ميزانية الإعلانات (منفصلة)</p>
          <p className="text-sm">الميزانية الشهرية: <span className="num">{c.ad_budget ? fmt(Number(c.ad_budget)) : "—"}</span> · مستلم للإعلانات: <span className="num">{fmt(adIn)}</span> · الصرف الإعلاني الفعلي: <span className="num">{fmt(spend.data ?? 0)}</span> {cur(c.currency)}</p>
          <p className="text-sm font-semibold">جدول الدفعات</p>
          <div className="space-y-1 text-sm">
            {mine.length === 0 && <p className="text-muted-foreground">لا توجد دفعات.</p>}
            {mine.map((i) => <p key={i.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-1"><span>{i.total_count === 0 ? `دورة ${i.number}` : `دفعة ${i.number} من ${i.total_count}`} — {fmtArDate(i.due_date)}</span><span className={i.paid ? "text-success" : ""}><span className="num">{fmt(Number(i.amount))}</span> {i.paid ? `✓ ${i.payment_method ?? ""}` : "معلقة"}</span></p>)}
          </div>
          <p className="text-sm font-semibold">سجل المعاملات</p>
          <div className="space-y-1 text-sm">
            {tx.length === 0 && <p className="text-muted-foreground">لا توجد معاملات.</p>}
            {tx.map((e) => <p key={e.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-1"><span>{fmtArDate(e.entry_date)} · {ACCOUNTS[e.account]} · {e.category ?? ""} {e.note ?? ""}</span><span className={`num ${e.kind === "income" ? "text-success" : "text-destructive"}`}>{e.kind === "income" ? "+" : "-"}{fmt(Number(e.amount))}</span></p>)}
          </div>
        </div>
      )}
    </div>
  );
}
