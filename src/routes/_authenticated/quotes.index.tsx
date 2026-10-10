import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QuoteCreateDialog } from "@/components/QuoteCreateDialog";
import { useMe } from "@/lib/auth";
import { PAYMENT_TYPES, QUOTE_STATUS, cur, fmtArDate } from "@/lib/crm";
import { fmt } from "@/lib/metrics";

export const Route = createFileRoute("/_authenticated/quotes/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "عروض الأسعار — لوحة التشغيل" },
      { name: "description", content: "متابعة كل عروض الأسعار وحالاتها." },
      { property: "og:title", content: "عروض الأسعار" },
      { property: "og:description", content: "متابعة كل عروض الأسعار وحالاتها." },
    ],
  }),
  component: QuotesPage,
});

function QuotesPage() {
  const { data: me } = useMe();
  const canEdit = !!(me?.is("admin") || me?.is("sales"));
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const { data } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => (await supabase.from("quotes").select("*, quote_items(price,qty)").order("created_at", { ascending: false })).data ?? [],
  });
  const shown = (data ?? []).filter((q) => filter === "all" || q.status === filter);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border pb-5 sm:flex sm:justify-between">
        <h1 className="text-3xl font-bold">عروض الأسعار</h1>
        {canEdit && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> عرض سعر جديد</Button>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>الكل</Button>
        {Object.entries(QUOTE_STATUS).map(([k, v]) => <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{v.label}</Button>)}
      </div>
      {shown.length === 0 && <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">لا توجد عروض هنا.</div>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-card text-muted-foreground"><tr><th className="p-3 text-start">#</th><th className="p-3 text-start">العميل</th><th className="p-3 text-start">الإجمالي</th><th className="p-3 text-start">الدفع</th><th className="p-3 text-start">التاريخ</th><th className="p-3 text-start">الحالة</th></tr></thead>
          <tbody>
            {shown.map((q) => {
              const sub = (q.quote_items as { price: number; qty: number }[]).reduce((a, i) => a + Number(i.price) * i.qty, 0);
              const st = QUOTE_STATUS[q.status] ?? QUOTE_STATUS["draft"]!;
              return (
                <tr key={q.id} className="border-t border-border hover:bg-card/60">
                  <td className="num p-3 text-gold">{q.seq}</td>
                  <td className="p-3"><Link to="/quotes/$id" params={{ id: q.id }} className="font-medium hover:text-gold">{q.customer_name}</Link><p className="text-xs text-muted-foreground">{q.project_name}</p></td>
                  <td className="num p-3">{fmt(Math.max(sub - Number(q.discount), 0))} <span className="font-sans text-xs">{cur(q.currency)}</span></td>
                  <td className="p-3 text-xs">{PAYMENT_TYPES[q.payment_type]}{q.payment_type !== "upfront" ? ` · ${q.installments}` : ""}</td>
                  <td className="p-3 text-xs">{fmtArDate(q.created_at)}</td>
                  <td className="p-3"><span className={`rounded-full border px-2 py-0.5 text-xs ${st.cls}`}>{st.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <QuoteCreateDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
