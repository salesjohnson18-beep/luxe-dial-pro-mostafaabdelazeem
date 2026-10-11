import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ACCOUNTS, cur, fmtArDate, invoiceStatus } from "@/lib/crm";
import { fmt, today } from "@/lib/metrics";

export const Route = createFileRoute("/i/$token")({
  head: () => ({
    meta: [
      { title: "فاتورة — MOSTAFA ABDELAZEEM" },
      { name: "description", content: "عرض وطباعة الفاتورة." },
      { property: "og:title", content: "فاتورة" },
      { property: "og:description", content: "عرض وطباعة الفاتورة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoicePage,
});

type Inv = { seq: number; description: string; amount: number; currency: string; issue_date: string; due_date: string; status: string; paid_at: string | null; account: string; client_name: string; project_name: string; phone: string | null };

function InvoicePage() {
  const { token } = Route.useParams();
  const { data, isLoading } = useQuery({ queryKey: ["inv", token], queryFn: async () => (await supabase.rpc("get_shared_invoice", { _token: token })).data as Inv | null });
  if (isLoading) return <div className="p-10 text-center text-muted-foreground">...</div>;
  if (!data) return <div className="p-10 text-center text-muted-foreground">الفاتورة غير موجودة.</div>;
  const st = invoiceStatus(data.status, data.due_date, today());
  return (
    <div dir="rtl" className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
      <div className="space-y-6 rounded-2xl border border-gold/40 bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div><p className="text-2xl font-bold text-gold">فاتورة</p><p className="num text-muted-foreground">#{String(data.seq).padStart(4, "0")}</p></div>
          <span className={`rounded-full border px-3 py-1 text-sm ${st.cls}`}>{st.label}</span>
        </div>
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div><p className="text-xs text-muted-foreground">العميل</p><p className="font-medium">{data.client_name}</p><p>{data.project_name}</p>{data.phone && <p className="num" dir="ltr">{data.phone}</p>}</div>
          <div><p className="text-xs text-muted-foreground">تاريخ الإصدار</p><p>{fmtArDate(data.issue_date)}</p><p className="mt-2 text-xs text-muted-foreground">تاريخ الاستحقاق</p><p>{fmtArDate(data.due_date)}</p></div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">{ACCOUNTS[data.account]}</p>
          <p className="mt-1 break-words">{data.description}</p>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="font-bold">الإجمالي</p>
          <p className="num text-2xl text-gold">{fmt(Number(data.amount), Number(data.amount) % 1 ? 2 : 0)} {cur(data.currency)}</p>
        </div>
        <p className="text-center text-xs tracking-widest text-gold">MOSTAFA ABDELAZEEM</p>
      </div>
      <Button className="w-full print:hidden" onClick={() => window.print()}><Printer className="me-2 h-4 w-4" />طباعة / حفظ PDF</Button>
    </div>
  );
}
