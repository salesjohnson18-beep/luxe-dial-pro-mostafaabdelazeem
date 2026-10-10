import { forwardRef } from "react";
import { cur } from "@/lib/crm";
import { byPlatform, computeTotals, fmt, supportsLeads, type Entry } from "@/lib/metrics";

type Props = { title: string; dateLabel: string; entries: Entry[]; currency?: string | null | undefined };

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
    ["النقرات", "CLICKS", fmt(t.clicks)],
    ["الظهور", "IMPRESSIONS", fmt(t.impressions)],
    ["الرسائل / ليدز", "LEADS / MESSAGES", fmt(t.leads)],
    ["تكلفة الرسالة", "COST / LEAD", fmt(t.cpl, 2), c],
  ];
  return (
    <div ref={ref} className="luxe-card mx-auto w-full max-w-[680px] overflow-hidden" dir="rtl">
      <div className="grid min-w-0 gap-3 px-4 pb-5 pt-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-8 sm:pb-7 sm:pt-8">
        <div className="min-w-0">
          <p className="num text-xs tracking-[0.3em] text-gold">PERFORMANCE REPORT</p>
          <h2 className="mt-2 break-words text-2xl font-semibold sm:text-3xl">{title}</h2>
        </div>
        <p className="num break-words text-xs text-muted-foreground sm:text-sm">{dateLabel}</p>
      </div>
      <div className="grid grid-cols-2 border-y border-border sm:grid-cols-4" dir="ltr">
        {cells.map(([ar, k, v, unit]) => (
          <div
            key={k}
            className="min-w-0 border-b border-r border-border p-3 text-left sm:p-5"
          >
            <p className="text-[11px] leading-5 text-muted-foreground"><span>{ar}</span> · <span className="num">{k}</span></p>
            <p className="num mt-2 flex min-w-0 flex-wrap items-baseline gap-1 break-all text-lg sm:text-xl">{v}{unit && <span className="font-sans text-xs text-muted-foreground">{unit}</span>}</p>
          </div>
        ))}
      </div>
      <div className="space-y-6 px-4 py-6 sm:px-8">
        {platforms.length === 0 && <p className="text-center text-sm text-muted-foreground">لا توجد بيانات في هذه الفترة</p>}
        {platforms.map((p) => (
          <div key={p.platform} dir="ltr">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm">
              <span className="min-w-0 break-words font-medium">{p.platform}</span>
              <span className="num text-xs text-muted-foreground">
                {fmt(p.spend)} {c} · {fmt(p.roas, 2)}x
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted">
              <div className="h-full rounded-full bg-gold" style={{ width: `${(p.spend / max) * 100}%` }} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-xs sm:grid-cols-3">
              {([
                ["الصرف · SPEND", `${fmt(p.spend, 2)} ${c}`],
                ["الإيراد · REVENUE", `${fmt(p.revenue, 2)} ${c}`],
                ["المشتريات · PURCHASES", fmt(p.purchases)],
                ["النقرات · CLICKS", fmt(p.clicks)],
                ["الظهور · IMPRESSIONS", fmt(p.impressions)],
                ["العائد · ROAS", `${fmt(p.roas, 2)}x`],
                ["تكلفة الشراء · CPA", `${fmt(p.cpa, 2)} ${c}`],
                ["تكلفة النقرة · CPC", `${fmt(p.cpc, 2)} ${c}`],
                ["تكلفة الألف · CPM", `${fmt(p.cpm, 2)} ${c}`],
                ["نسبة النقر · CTR", `${fmt(p.ctr, 2)}%`],
                ["نسبة التحويل · CONV. RATE", `${fmt(p.conv, 2)}%`],
                ...(supportsLeads(p.platform) ? [
                  ["الرسائل / ليدز · LEADS", fmt(p.leads)],
                  ["تكلفة الرسالة · COST / LEAD", `${fmt(p.cpl, 2)} ${c}`],
                ] : []),
              ]).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="num mt-1 break-all">{value}</dd></div>)}
            </dl>
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
