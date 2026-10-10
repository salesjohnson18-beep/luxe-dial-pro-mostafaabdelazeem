export const PLATFORMS = ["Google Ads", "Meta", "Snapchat", "TikTok", "Twitter/X"] as const;
export const SOCIAL_PLATFORMS = ["Meta", "Snapchat", "TikTok", "Twitter/X"] as const;
export const supportsLeads = (platform: string) => SOCIAL_PLATFORMS.some((p) => p === platform);

export type Entry = {
  entry_date: string;
  platform: string;
  spend: number;
  clicks: number;
  impressions: number;
  purchases: number;
  revenue: number;
  leads?: number;
};

export type Totals = ReturnType<typeof computeTotals>;

export function computeTotals(rows: Entry[]) {
  const t = rows.reduce(
    (a, r) => ({
      spend: a.spend + Number(r.spend || 0),
      clicks: a.clicks + Number(r.clicks || 0),
      impressions: a.impressions + Number(r.impressions || 0),
      purchases: a.purchases + Number(r.purchases || 0),
      revenue: a.revenue + Number(r.revenue || 0),
      leads: a.leads + (supportsLeads(r.platform) ? Number(r.leads || 0) : 0),
      socialSpend: a.socialSpend + (supportsLeads(r.platform) ? Number(r.spend || 0) : 0),
    }),
    { spend: 0, clicks: 0, impressions: 0, purchases: 0, revenue: 0, leads: 0, socialSpend: 0 },
  );
  const div = (a: number, b: number) => (b ? a / b : 0);
  return {
    ...t,
    roas: div(t.revenue, t.spend),
    cpa: div(t.spend, t.purchases),
    cpc: div(t.spend, t.clicks),
    cpm: div(t.spend, t.impressions) * 1000,
    ctr: div(t.clicks, t.impressions) * 100,
    conv: div(t.purchases, t.clicks) * 100,
    cpl: div(t.socialSpend, t.leads),
  };
}

export function byPlatform(rows: Entry[]) {
  const map = new Map<string, Entry[]>();
  rows.forEach((r) => map.set(r.platform, [...(map.get(r.platform) ?? []), r]));
  return [...map.entries()]
    .map(([platform, list]) => ({ platform, ...computeTotals(list) }))
    .sort((a, b) => b.spend - a.spend);
}

export function byDay(rows: Entry[], from: string, to: string) {
  const out: { date: string; spend: number; revenue: number }[] = [];
  const d = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (d <= end && out.length < 400) {
    const key = d.toISOString().slice(0, 10);
    const list = rows.filter((r) => r.entry_date === key);
    const t = computeTotals(list);
    out.push({ date: key.slice(5), spend: round(t.spend), revenue: round(t.revenue) });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;
export const fmt = (n: number, d = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const today = () => new Date().toISOString().slice(0, 10);
export const monthStart = () => today().slice(0, 8) + "01";
export const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export const INDUSTRIES = [
  "محل ورد",
  "شركة تنظيف",
  "متجر عطور",
  "عبايات",
  "مطعم / كافيه",
  "متجر إلكتروني",
  "مركز طبي",
  "عقارات",
  "تجميل وصالونات",
];
