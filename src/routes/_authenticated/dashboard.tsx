import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { DateRange, Stat } from "@/components/DateRange";
import { byDay, byPlatform, computeTotals, daysAgo, fmt, today, type Entry } from "@/lib/metrics";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "نظرة عامة — لوحة التشغيل" },
      { name: "description", content: "مؤشرات الصرف والإيراد والعائد لكل العملاء." },
      { property: "og:title", content: "نظرة عامة" },
      { property: "og:description", content: "مؤشرات الأداء المجمعة." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(today());
  const { data } = useQuery({
    queryKey: ["dash", from, to],
    queryFn: async () => {
      const [e, s] = await Promise.all([
        supabase.from("campaign_entries").select("entry_date,platform,spend,clicks,impressions,purchases,revenue").gte("entry_date", from).lte("entry_date", to),
        supabase.from("store_sales").select("revenue").gte("entry_date", from).lte("entry_date", to),
      ]);
      return {
        entries: (e.data ?? []) as Entry[],
        store: (s.data ?? []).reduce((a, r) => a + Number(r.revenue), 0),
      };
    },
  });
  const entries = data?.entries ?? [];
  const t = computeTotals(entries);
  const days = byDay(entries, from, to);
  const plats = byPlatform(entries);
  const maxSpend = Math.max(...plats.map((p) => p.spend), 1);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 border-b border-border pb-5 lg:flex lg:items-center lg:justify-between">
        <h1 className="text-3xl font-bold">نظرة عامة</h1>
        <DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt); }} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="إجمالي الصرف" value={`${fmt(t.spend)} ر.س`} />
        <Stat label="الإيراد (المنصات)" value={`${fmt(t.revenue)} ر.س`} />
        <Stat label="ROAS" value={`${fmt(t.roas, 2)}x`} sub={data?.store ? `Blended ${fmt(t.spend ? data.store / t.spend : 0, 2)}x` : undefined} />
        <Stat label="المشتريات" value={fmt(t.purchases)} sub={`CPA ${fmt(t.cpa, 2)}`} />
        <Stat label="CPC" value={fmt(t.cpc, 2)} />
        <Stat label="CPM" value={fmt(t.cpm, 2)} />
        <Stat label="CTR" value={`${fmt(t.ctr, 2)}%`} />
        <Stat label="معدل التحويل" value={`${fmt(t.conv, 2)}%`} />
      </div>

      <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="mb-4 font-semibold">الصرف مقابل الإيراد يومياً</h2>
        <div className="h-72" dir="ltr">
          <ResponsiveContainer>
            <AreaChart data={days}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Area type="linear" dataKey="revenue" name="الإيراد" stroke="var(--gold)" strokeWidth={2} fill="url(#g)" />
              <Area type="linear" dataKey="spend" name="الصرف" stroke="var(--muted-foreground)" strokeDasharray="4 4" fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
          <h2 className="mb-4 font-semibold">الصرف حسب المنصة</h2>
          {plats.length === 0 && <p className="text-sm text-muted-foreground">لا توجد بيانات بعد</p>}
          <div className="space-y-4" dir="ltr">
            {plats.map((p) => (
              <div key={p.platform}>
                <div className="flex justify-between text-sm">
                  <span>{p.platform}</span>
                  <span className="num text-muted-foreground">{fmt(p.spend)} ({fmt(t.spend ? (p.spend / t.spend) * 100 : 0, 0)}%)</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${(p.spend / maxSpend) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
          <h2 className="mb-4 font-semibold">أداء المنصات</h2>
          {plats.length === 0 && <p className="text-sm text-muted-foreground">لا توجد بيانات بعد</p>}
          <div className="max-w-full overflow-x-auto"><table className="w-full text-sm" dir="ltr">
            {plats.length > 0 && (
              <thead className="text-xs text-muted-foreground">
                <tr><th className="pb-2 text-left">Platform</th><th>ROAS</th><th>CPA</th><th>CTR</th></tr>
              </thead>
            )}
            <tbody className="num">
              {plats.map((p) => (
                <tr key={p.platform} className="border-t border-border">
                  <td className="py-2 text-left font-sans">{p.platform}</td>
                  <td className="text-center text-gold">{fmt(p.roas, 2)}x</td>
                  <td className="text-center">{fmt(p.cpa, 2)}</td>
                  <td className="text-center">{fmt(p.ctr, 2)}%</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}
