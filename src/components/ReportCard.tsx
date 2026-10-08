import { forwardRef } from "react";
import { cur } from "@/lib/crm";
import { byPlatform, computeTotals, fmt, type Entry } from "@/lib/metrics";

type Props = { title: string; dateLabel: string; entries: Entry[]; currency?: string | null };

export const ReportCard = forwardRef<HTMLDivElement, Props>(({ title, dateLabel, entries, currency }, ref) => {
  const t = computeTotals(entries);
  const platforms = byPlatform(entries);
  const max = Math.max(...platforms.map((p) => p.spend), 1);
  const c = cur(currency);
  const cells: [string, string, string, string?][] = [
    ["الصرف", "SPEND", fmt(t.spend, t.spend % 1 ? 2 : 0), c],
    ["الإيراد", "REVENUE", fmt(t.revenue, t.revenue % 1 ? 2 : 0), c],
    ["العائد", "ROAS", fmt(t.roas, 2) + "x"],
    ["المشتريات", "PURCHASES", fmt(t.purchases)],
    ["تكلفة الشراء", "CPA", fmt(t.cpa, 2), c],
    ["تكلفة النقرة", "CPC", fmt(t.cpc, 2), c],
    ["نسبة النقر", "CTR", fmt(t.ctr, 2) + "%"],
    ["نسبة التحويل", "CONV. RATE", fmt(t.conv, 2) + "%"],
  ];
  return (
    <div ref={ref} className="luxe-card mx-auto w-full max-w-[680px] overflow-hidden" dir="rtl">
      <div className="flex items-end justify-between gap-4 px-8 pb-7 pt-8">
        <div>
          <p className="num text-xs tracking-[0.3em] text-gold">PERFORMANCE REPORT</p>
          <h2 className="mt-2 text-3xl font-semibold">{title}</h2>
        </div>
        <p className="num text-sm text-muted-foreground">{dateLabel}</p>
      </div>
      <div className="grid grid-cols-2 border-y border-border sm:grid-cols-4" dir="ltr">
        {cells.map(([ar, k, v, unit], i) => (
          <div
            key={k}
            className={`p-5 text-left ${i % 4 !== 3 ? "sm:border-r" : ""} ${i < 4 ? "border-b" : ""} ${i % 2 === 0 ? "border-r sm:border-r" : ""} border-border`}
          >
            <p className="text-[11px] text-muted-foreground"><span>{ar}</span> · <span className="num tracking-wider">{k}</span></p>
            <p className="num mt-2 text-xl">{v}{unit && <span className="ms-1 font-sans text-xs text-muted-foreground">{unit}</span>}</p>
          </div>
        ))}
      </div>
      <div className="space-y-4 px-8 py-6">
        {platforms.length === 0 && <p className="text-center text-sm text-muted-foreground">لا توجد بيانات في هذه الفترة</p>}
        {platforms.map((p) => (
          <div key={p.platform} dir="ltr">
            <div className="flex justify-between text-sm">
              <span>{p.platform}</span>
              <span className="num text-muted-foreground">
                {fmt(p.spend)} {c} · {fmt(p.roas, 2)}x
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted">
              <div className="h-full rounded-full bg-gold" style={{ width: `${(p.spend / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-4 text-center">
        <p className="num text-[11px] tracking-[0.25em] text-muted-foreground">MOSTAFA ABDELAZEEM</p>
      </div>
    </div>
  );
});
ReportCard.displayName = "ReportCard";
