import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Link2, Eye, EyeOff, Trash2, Upload, Copy } from "lucide-react";
import { toPng } from "html-to-image";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportCard } from "@/components/ReportCard";
import { DateRange } from "@/components/DateRange";
import { ClientForm, type ClientValues } from "@/components/ClientForm";
import { useMe } from "@/lib/auth";
import { PLATFORMS, computeTotals, fmt, today, type Entry } from "@/lib/metrics";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  head: () => ({
    meta: [
      { title: "بروفايل العميل — لوحة التشغيل" },
      { name: "description", content: "بيانات العميل والحملات والتقارير." },
      { property: "og:title", content: "بروفايل العميل" },
      { property: "og:description", content: "بيانات العميل والحملات." },
    ],
  }),
  component: ClientPage,
});

function ClientPage() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const { data: client, refetch } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => (await supabase.from("clients").select("*").eq("id", id).maybeSingle()).data,
  });
  if (client === undefined) return <p className="text-muted-foreground">جارِ التحميل...</p>;
  if (!client) return <p>العميل غير موجود أو لا تملك صلاحية الوصول.</p>;
  const canEdit = !!me?.canEditCampaigns;

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-6">
        <p className="text-xs text-gold">{client.industry || "—"}</p>
        <h1 className="text-3xl font-bold">{client.project_name}</h1>
        <p className="text-muted-foreground">{client.client_name}</p>
      </div>
      <Tabs defaultValue="report" dir="rtl">
        <TabsList className="flex-wrap">
          <TabsTrigger value="report">تقرير العميل</TabsTrigger>
          {canEdit && <TabsTrigger value="entry">الإدخال اليومي</TabsTrigger>}
          {canEdit && <TabsTrigger value="import">استيراد إكسل</TabsTrigger>}
          {canEdit && <TabsTrigger value="vault">الخزانة الآمنة</TabsTrigger>}
          {canEdit && <TabsTrigger value="settings">البيانات</TabsTrigger>}
        </TabsList>
        <TabsContent value="report" className="mt-6"><ReportTab clientId={id} title={client.project_name} token={client.share_token} /></TabsContent>
        {canEdit && <TabsContent value="entry" className="mt-6"><EntryTab clientId={id} /></TabsContent>}
        {canEdit && <TabsContent value="import" className="mt-6"><ImportTab clientId={id} /></TabsContent>}
        {canEdit && <TabsContent value="vault" className="mt-6"><VaultTab clientId={id} /></TabsContent>}
        {canEdit && (
          <TabsContent value="settings" className="mt-6">
            <SettingsTab client={client} isAdmin={!!me?.is("admin")} onSaved={refetch} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ReportTab({ clientId, title, token }: { clientId: string; title: string; token: string }) {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: ["entries", clientId, from, to],
    queryFn: async () =>
      ((await supabase.from("campaign_entries").select("entry_date,platform,spend,clicks,impressions,purchases,revenue").eq("client_id", clientId).gte("entry_date", from).lte("entry_date", to)).data ?? []) as Entry[],
  });

  async function download() {
    if (!ref.current) return;
    const url = await toPng(ref.current, { pixelRatio: 2, backgroundColor: getComputedStyle(document.body).backgroundColor });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}-${from}.png`;
    a.click();
  }
  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/r/${token}?from=${from}&to=${to}`);
    toast.success("تم نسخ رابط التقرير");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        <Button variant="outline" size="sm" onClick={copyLink}><Link2 className="h-4 w-4" /> نسخ الرابط</Button>
        <Button size="sm" onClick={download}><Download className="h-4 w-4" /> تحميل الكارت</Button>
      </div>
      <div className="p-2">
        <ReportCard ref={ref} title={title} dateLabel={from === to ? from : `${from} → ${to}`} entries={data ?? []} />
      </div>
    </div>
  );
}

type Row = { spend: string; clicks: string; impressions: string; purchases: string; revenue: string };
const emptyRow: Row = { spend: "", clicks: "", impressions: "", purchases: "", revenue: "" };
const FIELDS: [keyof Row, string][] = [["spend", "الصرف"], ["clicks", "النقرات"], ["impressions", "الظهور"], ["purchases", "المشتريات"], ["revenue", "الإيراد"]];

function EntryTab({ clientId }: { clientId: string }) {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [store, setStore] = useState({ revenue: "", orders: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [e, s] = await Promise.all([
        supabase.from("campaign_entries").select("*").eq("client_id", clientId).eq("entry_date", date),
        supabase.from("store_sales").select("*").eq("client_id", clientId).eq("entry_date", date).maybeSingle(),
      ]);
      const r: Record<string, Row> = {};
      PLATFORMS.forEach((p) => (r[p] = { ...emptyRow }));
      e.data?.forEach((x) => (r[x.platform] = { spend: String(x.spend), clicks: String(x.clicks), impressions: String(x.impressions), purchases: String(x.purchases), revenue: String(x.revenue) }));
      setRows(r);
      setStore({ revenue: s.data ? String(s.data.revenue) : "", orders: s.data ? String(s.data.orders) : "" });
    })();
  }, [clientId, date]);

  const asEntry = (p: string, r: Row): Entry => ({
    entry_date: date, platform: p,
    spend: Number(r.spend) || 0, clicks: Math.round(Number(r.clicks) || 0), impressions: Math.round(Number(r.impressions) || 0),
    purchases: Math.round(Number(r.purchases) || 0), revenue: Number(r.revenue) || 0,
  });
  const all = Object.entries(rows).map(([p, r]) => asEntry(p, r));
  const total = computeTotals(all);
  const storeRev = Number(store.revenue) || 0;

  async function save() {
    setBusy(true);
    const filled = Object.entries(rows).filter(([, r]) => Object.values(r).some((v) => v !== ""));
    const empty = Object.entries(rows).filter(([, r]) => Object.values(r).every((v) => v === "")).map(([p]) => p);
    const ops = [];
    if (filled.length) ops.push(supabase.from("campaign_entries").upsert(filled.map(([p, r]) => ({ client_id: clientId, ...asEntry(p, r) })), { onConflict: "client_id,entry_date,platform" }));
    if (empty.length) ops.push(supabase.from("campaign_entries").delete().eq("client_id", clientId).eq("entry_date", date).in("platform", empty));
    if (store.revenue !== "" || store.orders !== "")
      ops.push(supabase.from("store_sales").upsert({ client_id: clientId, entry_date: date, revenue: storeRev, orders: Math.round(Number(store.orders) || 0) }, { onConflict: "client_id,entry_date" }));
    const res = await Promise.all(ops);
    setBusy(false);
    const err = res.find((r) => r.error)?.error;
    if (err) toast.error(err.message);
    else toast.success("تم حفظ أرقام اليوم");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Label>التاريخ</Label>
        <Input type="date" className="num w-44" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[900px] text-sm" dir="ltr">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3 text-left">Platform</th>
              {FIELDS.map(([k]) => <th key={k} className="p-3 capitalize">{k}</th>)}
              {["ROAS", "CPA", "CPC", "CPM", "CTR", "CONV"].map((h) => <th key={h} className="p-3">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {Object.entries(rows).map(([p, r]) => {
              const m = computeTotals([asEntry(p, r)]);
              return (
                <tr key={p} className="border-b border-border">
                  <td className="p-2 font-medium">{p}</td>
                  {FIELDS.map(([k]) => (
                    <td key={k} className="p-1">
                      <Input inputMode="decimal" className="num h-8 w-24 text-center" value={r[k]} onChange={(e) => setRows((s) => ({ ...s, [p]: { ...(s[p] ?? emptyRow), [k]: e.target.value.replace(/[^\d.]/g, "") } }))} />
                    </td>
                  ))}
                  <Metrics m={m} />
                </tr>
              );
            })}
            <tr className="bg-gold-soft font-semibold">
              <td className="p-3 text-gold">PAID CHANNELS</td>
              {FIELDS.map(([k]) => <td key={k} className="num p-3 text-center">{fmt(total[k], k === "spend" || k === "revenue" ? 2 : 0)}</td>)}
              <Metrics m={total} />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-4">
        <div className="space-y-2"><Label>مبيعات المتجر الفعلية</Label><Input inputMode="decimal" className="num" value={store.revenue} onChange={(e) => setStore((s) => ({ ...s, revenue: e.target.value.replace(/[^\d.]/g, "") }))} /></div>
        <div className="space-y-2"><Label>عدد الطلبات</Label><Input inputMode="numeric" className="num" value={store.orders} onChange={(e) => setStore((s) => ({ ...s, orders: e.target.value.replace(/\D/g, "") }))} /></div>
        <div><p className="text-xs text-muted-foreground">ROAS المنصات</p><p className="num mt-2 text-xl">{fmt(total.roas, 2)}x</p></div>
        <div><p className="text-xs text-muted-foreground">Blended ROAS الحقيقي</p><p className="num mt-2 text-xl text-gold">{fmt(total.spend ? storeRev / total.spend : 0, 2)}x</p></div>
      </div>
      <Button onClick={save} disabled={busy}>{busy ? "..." : "حفظ أرقام اليوم"}</Button>
    </div>
  );
}

function Metrics({ m }: { m: ReturnType<typeof computeTotals> }) {
  return (
    <>
      {[fmt(m.roas, 2) + "x", fmt(m.cpa, 2), fmt(m.cpc, 2), fmt(m.cpm, 2), fmt(m.ctr, 2) + "%", fmt(m.conv, 2) + "%"].map((v, i) => (
        <td key={i} className="num p-3 text-center text-muted-foreground">{v}</td>
      ))}
    </>
  );
}

const HEADER_MAP: Record<string, keyof Entry> = {
  date: "entry_date", "التاريخ": "entry_date", day: "entry_date",
  platform: "platform", "المنصة": "platform",
  spend: "spend", cost: "spend", "الصرف": "spend", "amount spent": "spend",
  clicks: "clicks", "النقرات": "clicks",
  impressions: "impressions", "الظهور": "impressions", "مرات الظهور": "impressions",
  purchases: "purchases", conversions: "purchases", "المشتريات": "purchases",
  revenue: "revenue", "conversion value": "revenue", "الإيراد": "revenue",
};

function ImportTab({ clientId }: { clientId: string }) {
  const [preview, setPreview] = useState<Entry[]>([]);
  const [defaultPlatform, setDefaultPlatform] = useState<string>(PLATFORMS[0]);
  const [busy, setBusy] = useState(false);

  async function onFile(f: File) {
    const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0] ?? ""]!, { defval: "" });
    const out: Entry[] = [];
    for (const r of raw) {
      const e: Partial<Entry> = {};
      for (const [k, v] of Object.entries(r)) {
        const key = HEADER_MAP[k.trim().toLowerCase()];
        if (!key) continue;
        if (key === "entry_date") {
          const d = v instanceof Date ? v : new Date(String(v));
          if (!isNaN(d.getTime())) e.entry_date = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        } else if (key === "platform") e.platform = String(v).trim();
        else (e as Record<string, number>)[key] = Number(String(v).replace(/[^\d.-]/g, "")) || 0;
      }
      if (!e.entry_date) continue;
      out.push({ platform: e.platform || defaultPlatform, spend: 0, clicks: 0, impressions: 0, purchases: 0, revenue: 0, ...e } as Entry);
    }
    if (!out.length) toast.error("لم نجد صفوفاً صالحة. تأكد من وجود عمود التاريخ (Date / التاريخ).");
    setPreview(out);
  }

  async function save() {
    setBusy(true);
    const merged = new Map<string, Entry>();
    preview.forEach((e) => merged.set(`${e.entry_date}|${e.platform}`, { ...e, clicks: Math.round(e.clicks), impressions: Math.round(e.impressions), purchases: Math.round(e.purchases) }));
    const { error } = await supabase.from("campaign_entries").upsert([...merged.values()].map((e) => ({ client_id: clientId, ...e })), { onConflict: "client_id,entry_date,platform" });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(`تم حفظ ${merged.size} صف من البيانات التاريخية`);
    setPreview([]);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        الأعمدة المدعومة: <span className="num text-foreground">Date, Platform, Spend, Clicks, Impressions, Purchases, Revenue</span> (أو بالعربي: التاريخ، المنصة، الصرف، النقرات، الظهور، المشتريات، الإيراد). إذا لم يوجد عمود المنصة نستخدم المنصة الافتراضية.
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>المنصة الافتراضية</Label>
          <Select value={defaultPlatform} onValueChange={setDefaultPlatform}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
          <Upload className="h-4 w-4" /> اختر ملف إكسل
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      </div>
      {preview.length > 0 && (
        <>
          <p className="text-sm">تم قراءة <span className="num text-gold">{preview.length}</span> صف — إجمالي الصرف <span className="num">{fmt(computeTotals(preview).spend, 2)}</span></p>
          <div className="max-h-72 overflow-auto rounded-xl border border-border" dir="ltr">
            <table className="w-full text-xs">
              <tbody className="num">
                {preview.slice(0, 50).map((e, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="p-2">{e.entry_date}</td><td className="font-sans">{e.platform}</td><td>{e.spend}</td><td>{e.clicks}</td><td>{e.impressions}</td><td>{e.purchases}</td><td>{e.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={save} disabled={busy}>{busy ? "..." : "حفظ البيانات"}</Button>
        </>
      )}
    </div>
  );
}

function VaultTab({ clientId }: { clientId: string }) {
  const [form, setForm] = useState({ kind: "password", label: "", value: "", notes: "" });
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const { data, refetch } = useQuery({
    queryKey: ["vault", clientId],
    queryFn: async () => (await supabase.from("client_vault").select("*").eq("client_id", clientId).order("created_at")).data ?? [],
  });
  const kinds: Record<string, string> = { password: "كلمة مرور", link: "رابط", plan: "خطة" };

  return (
    <div className="space-y-6">
      <form
        className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("client_vault").insert({ client_id: clientId, ...form, label: form.label.trim() });
          if (error) return void toast.error(error.message);
          setForm({ kind: form.kind, label: "", value: "", notes: "" });
          refetch();
        }}
      >
        <Select value={form.kind} onValueChange={(k) => setForm((f) => ({ ...f, kind: k }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(kinds).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="العنوان (مثال: حساب ميتا)" required maxLength={120} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
        <Input placeholder="القيمة" maxLength={4000} value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
        <Input placeholder="ملاحظات" maxLength={1000} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        <Button type="submit">إضافة</Button>
      </form>
      {data?.length === 0 && <p className="text-sm text-muted-foreground">الخزانة فارغة.</p>}
      <div className="space-y-2">
        {data?.map((v) => (
          <div key={v.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <span className="rounded bg-gold-soft px-2 py-0.5 text-[11px] text-gold">{kinds[v.kind] ?? v.kind}</span>
            <div className="flex-1">
              <p className="font-medium">{v.label}</p>
              <p className="num text-sm text-muted-foreground">{v.kind === "password" && !shown[v.id] ? "••••••••" : v.value}</p>
              {v.notes && <p className="text-xs text-muted-foreground">{v.notes}</p>}
            </div>
            {v.kind === "password" && (
              <Button size="icon" variant="ghost" onClick={() => setShown((s) => ({ ...s, [v.id]: !s[v.id] }))}>
                {shown[v.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(v.value ?? ""); toast.success("تم النسخ"); }}><Copy className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={async () => { await supabase.from("client_vault").delete().eq("id", v.id); refetch(); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ client, isAdmin, onSaved }: { client: ClientValues & { id: string }; isAdmin: boolean; onSaved: () => void }) {
  const nav = useNavigate();
  const { data: buyers } = useQuery({
    queryKey: ["buyers"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.rpc("list_users");
      return (data ?? []).filter((u) => u.roles.includes("media_buyer") || u.roles.includes("admin")).map((u) => ({ id: u.id, label: u.full_name || u.email || "" }));
    },
  });
  const { id, ...initial } = client;
  return (
    <div className="space-y-8">
      <ClientForm
        initial={initial}
        buyers={isAdmin ? buyers : undefined}
        submitLabel="حفظ التعديلات"
        onSubmit={async (v) => {
          const { error } = await supabase.from("clients").update(v).eq("id", id);
          if (error) return void toast.error(error.message);
          toast.success("تم الحفظ");
          onSaved();
        }}
      />
      {isAdmin && (
        <Button
          variant="destructive"
          onClick={async () => {
            if (!confirm("حذف العميل وكل بياناته نهائياً؟")) return;
            const { error } = await supabase.from("clients").delete().eq("id", id);
            if (error) return void toast.error(error.message);
            nav({ to: "/clients" });
          }}
        >
          حذف العميل
        </Button>
      )}
    </div>
  );
}
