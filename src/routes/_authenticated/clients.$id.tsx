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
import { parseSheets, type ImportResult } from "@/lib/excel-import";
import { useServerFn } from "@tanstack/react-start";
import { fetchGoogleSheet } from "@/lib/sheets.functions";
import { RefreshCw } from "lucide-react";

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
        <TabsContent value="report" className="mt-6"><ReportTab clientId={id} title={client.project_name} token={client.share_token} currency={client.currency} /></TabsContent>
        {canEdit && <TabsContent value="entry" className="mt-6"><EntryTab clientId={id} /></TabsContent>}
        {canEdit && <TabsContent value="import" className="mt-6"><ImportTab clientId={id} sheetUrl={client.sheet_url} syncedAt={client.sheet_synced_at} onChanged={refetch} /></TabsContent>}
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

function ReportTab({ clientId, title, token, currency }: { clientId: string; title: string; token: string; currency: string }) {
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
        <ReportCard ref={ref} title={title} dateLabel={from === to ? from : `${from} → ${to}`} entries={data ?? []} currency={currency} />
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

function workbookToSheets(data: ArrayBuffer | string, base64 = false) {
  const wb = XLSX.read(data, { cellDates: false, raw: false, type: base64 ? "base64" : "array" });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]!;
    for (const m of ws["!merges"] ?? []) {
      const src = ws[XLSX.utils.encode_cell(m.s)];
      if (!src) continue;
      for (let r = m.s.r; r <= m.e.r; r++)
        for (let c = m.s.c; c <= m.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!ws[addr]) ws[addr] = { ...src };
        }
    }
    return { name, rows: XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true }) };
  });
}

async function saveImport(clientId: string, result: ImportResult) {
  const ops = [];
  if (result.entries.length)
    ops.push(supabase.from("campaign_entries").upsert(result.entries.map((e) => ({ client_id: clientId, ...e })), { onConflict: "client_id,entry_date,platform" }));
  if (result.store.length)
    ops.push(supabase.from("store_sales").upsert(result.store.map((s) => ({ client_id: clientId, ...s })), { onConflict: "client_id,entry_date" }));
  const res = await Promise.all(ops);
  return res.find((r) => r.error)?.error ?? null;
}

function SheetSync({ clientId, sheetUrl, syncedAt, defaultPlatform, onChanged, onResult }: { clientId: string; sheetUrl: string | null; syncedAt: string | null; defaultPlatform: string; onChanged: () => void; onResult: (r: ImportResult) => void }) {
  const [url, setUrl] = useState(sheetUrl ?? "");
  const [busy, setBusy] = useState(false);
  const fetchSheet = useServerFn(fetchGoogleSheet);
  async function sync() {
    if (!url.trim()) return void toast.error("ضع رابط Google Sheet أولاً");
    setBusy(true);
    try {
      if (url.trim() !== sheetUrl) await supabase.from("clients").update({ sheet_url: url.trim() }).eq("id", clientId);
      const res = await fetchSheet({ data: { url: url.trim() } });
      if (!res.ok) return void toast.error(res.error);
      const r = parseSheets(workbookToSheets(res.base64, true), defaultPlatform);
      onResult(r);
      if (!r.entries.length && !r.store.length) return void toast.error("لم نجد بيانات في الشيت — راجع التحذيرات");
      const err = await saveImport(clientId, r);
      if (err) return void toast.error(err.message);
      await supabase.from("clients").update({ sheet_synced_at: new Date().toISOString() }).eq("id", clientId);
      toast.success(`تمت المزامنة: ${r.entries.length} سجل حملات و ${r.store.length} يوم مبيعات`);
      onChanged();
    } catch (e) {
      toast.error("فشلت المزامنة: " + (e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-5">
      <p className="font-semibold">ربط Google Sheet</p>
      <p className="text-xs text-muted-foreground">شارك الشيت بخيار «أي شخص لديه الرابط يمكنه العرض» ثم الصق الرابط. المزامنة تحدّث السجل اليومي مباشرة.</p>
      <div className="flex flex-wrap gap-2">
        <Input dir="ltr" className="min-w-64 flex-1" placeholder="https://docs.google.com/spreadsheets/d/..." value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button onClick={sync} disabled={busy}><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> مزامنة وتحديث</Button>
      </div>
      {syncedAt && <p className="text-xs text-muted-foreground">آخر مزامنة: <span className="num">{new Date(syncedAt).toLocaleString("en-GB")}</span></p>}
    </div>
  );
}

function ImportTab({ clientId, sheetUrl, syncedAt, onChanged }: { clientId: string; sheetUrl: string | null; syncedAt: string | null; onChanged: () => void }) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [defaultPlatform, setDefaultPlatform] = useState<string>(PLATFORMS[0]);
  const [busy, setBusy] = useState(false);

  async function onFile(f: File) {
    try {
      const r = parseSheets(workbookToSheets(await f.arrayBuffer()), defaultPlatform);
      setResult(r);
      if (!r.entries.length && !r.store.length) toast.error("لم نجد بيانات قابلة للاستيراد. راجع التحذيرات بالأسفل.");
    } catch (e) {
      toast.error("تعذر قراءة الملف: " + (e instanceof Error ? e.message : ""));
    }
  }

  async function save() {
    if (!result) return;
    setBusy(true);
    const err = await saveImport(clientId, result);
    setBusy(false);
    if (err) return void toast.error(err.message);
    toast.success(`تم حفظ ${result.entries.length} سجل حملات و ${result.store.length} يوم مبيعات متجر`);
    setResult(null);
  }

  const FIELD_AR: Record<string, string> = { date: "التاريخ", platform: "المنصة", spend: "الصرف", clicks: "النقرات", impressions: "الظهور", purchases: "المشتريات", revenue: "الإيراد", store_revenue: "مبيعات المتجر", store_orders: "طلبات المتجر" };

  return (
    <div className="space-y-5">
      <SheetSync clientId={clientId} sheetUrl={sheetUrl} syncedAt={syncedAt} defaultPlatform={defaultPlatform} onChanged={onChanged} onResult={setResult} />
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        ارفع الملف كما هو. يدعم الشيت الرأسي (عمود تاريخ) والشيت الأفقي (التواريخ بالعرض في الصف الأول والمنصات والمؤشرات في العمود A مثل PAID CHANNELS / GOOGLE / SNAPCHAT). يتجاهل أعمدة الإجمالي مثل Total May، ينظّف العملات (SAR208.00 ← 208)، ويتجاهل أخطاء الصيغ مثل #REF! و #DIV/0! دون إيقاف الاستيراد. إذا وُجدت أقسام منصات منفصلة تُحفظ كل منصة وحدها، وإلا تُحفظ أرقام PAID CHANNELS على المنصة الافتراضية.
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>المنصة الافتراضية (إن لم يوجد عمود منصة)</Label>
          <Select value={defaultPlatform} onValueChange={setDefaultPlatform}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
          <Upload className="h-4 w-4" /> اختر ملف إكسل
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
        </label>
      </div>
      {result && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">صفوف مقروءة</p><p className="num mt-1 text-xl">{result.rowsRead}</p></div>
            <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">سجلات حملات (يوم × منصة)</p><p className="num mt-1 text-xl text-gold">{result.entries.length}</p></div>
            <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">أيام مبيعات متجر</p><p className="num mt-1 text-xl">{result.store.length}</p></div>
          </div>
          {result.mapping.map((m) => (
            <div key={m.sheet} className="flex flex-wrap gap-2 text-xs">
              <span className="text-muted-foreground">ورقة «{m.sheet}»:</span>
              {Object.entries(m.columns).map(([f, h]) => (
                <span key={f} className="rounded border border-border px-2 py-0.5"><span className="text-gold">{FIELD_AR[f]}</span> ← {h}</span>
              ))}
            </div>
          ))}
          {result.warnings.length > 0 && (
            <details className="rounded-lg border border-border bg-card p-3 text-sm">
              <summary className="cursor-pointer text-gold">{result.warnings.length} تحذير (تم استيراد باقي الصفوف)</summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs text-muted-foreground">
                {result.warnings.map((w, i) => <li key={i}>«{w.sheet}» صف <span className="num">{w.row}</span>: {w.message}</li>)}
              </ul>
            </details>
          )}
          {result.entries.length > 0 && (
            <div className="max-h-72 overflow-auto rounded-xl border border-border" dir="ltr">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card text-muted-foreground"><tr><th className="p-2 text-left">Date</th><th>Platform</th><th>Spend</th><th>Clicks</th><th>Impr.</th><th>Purch.</th><th>Revenue</th></tr></thead>
                <tbody className="num">
                  {result.entries.slice(0, 200).map((e, i) => (
                    <tr key={i} className="border-t border-border text-center">
                      <td className="p-2 text-left">{e.entry_date}</td><td className="font-sans">{e.platform}</td><td>{fmt(e.spend, 2)}</td><td>{fmt(e.clicks)}</td><td>{fmt(e.impressions)}</td><td>{e.purchases}</td><td>{fmt(e.revenue, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy || (!result.entries.length && !result.store.length)}>{busy ? "..." : "حفظ في السجل اليومي"}</Button>
            <Button variant="outline" onClick={() => setResult(null)}>إلغاء</Button>
          </div>
        </>
      )}
    </div>
  );
}

const VAULT_KINDS: Record<string, { label: string; fields: ("username" | "secret" | "url")[]; secretLabel?: string }> = {
  password: { label: "حساب (مستخدم + كلمة مرور)", fields: ["url", "username", "secret"], secretLabel: "كلمة المرور" },
  link: { label: "رابط دخول", fields: ["url"] },
  token: { label: "توكن / بكسل", fields: ["secret"], secretLabel: "التوكن أو رقم البكسل" },
  plan: { label: "خطة / ملاحظة", fields: [] },
};
const emptyVault = { kind: "password", label: "", username: "", secret: "", url: "", notes: "" };

function CopyBtn({ text }: { text: string }) {
  return <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(text); toast.success("تم النسخ"); }}><Copy className="h-3.5 w-3.5" /></Button>;
}

function VaultTab({ clientId }: { clientId: string }) {
  const [form, setForm] = useState(emptyVault);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const { data, refetch } = useQuery({
    queryKey: ["vault", clientId],
    queryFn: async () => (await supabase.from("client_vault").select("*").eq("client_id", clientId).order("created_at")).data ?? [],
  });
  const k = VAULT_KINDS[form.kind]!;
  const set = (key: keyof typeof emptyVault, v: string) => setForm((f) => ({ ...f, [key]: v }));

  return (
    <div className="space-y-6">
      <form
        className="space-y-3 rounded-xl border border-border bg-card p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("client_vault").insert({
            client_id: clientId, kind: form.kind, label: form.label.trim(),
            username: form.username.trim() || null, secret: form.secret || null, url: form.url.trim() || null, notes: form.notes.trim() || null,
          });
          if (error) return void toast.error(error.message);
          setForm({ ...emptyVault, kind: form.kind });
          toast.success("تم الحفظ في الخزانة");
          refetch();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>نوع السر</Label>
            <Select value={form.kind} onValueChange={(x) => set("kind", x)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(VAULT_KINDS).map(([key, v]) => <SelectItem key={key} value={key}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>العنوان</Label><Input placeholder="مثال: حساب ميتا للإعلانات" required maxLength={120} value={form.label} onChange={(e) => set("label", e.target.value)} /></div>
          {k.fields.includes("url") && <div className="space-y-1"><Label>رابط الدخول</Label><Input dir="ltr" placeholder="https://" maxLength={1000} value={form.url} onChange={(e) => set("url", e.target.value)} /></div>}
          {k.fields.includes("username") && <div className="space-y-1"><Label>اسم المستخدم / الإيميل</Label><Input dir="ltr" maxLength={300} value={form.username} onChange={(e) => set("username", e.target.value)} /></div>}
          {k.fields.includes("secret") && <div className="space-y-1"><Label>{k.secretLabel}</Label><Input dir="ltr" type={form.kind === "password" ? "password" : "text"} maxLength={4000} value={form.secret} onChange={(e) => set("secret", e.target.value)} /></div>}
          <div className="space-y-1 sm:col-span-2"><Label>{form.kind === "plan" ? "الخطة / التفاصيل" : "ملاحظات (اختياري)"}</Label><Input maxLength={2000} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <Button type="submit">إضافة للخزانة</Button>
      </form>
      {data?.length === 0 && <p className="text-sm text-muted-foreground">الخزانة فارغة.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {data?.map((v) => {
          const secret = v.secret ?? (v.kind !== "link" ? v.value : null);
          const url = v.url ?? (v.kind === "link" ? v.value : null);
          return (
            <div key={v.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-gold-soft px-2 py-0.5 text-[11px] text-gold">{VAULT_KINDS[v.kind]?.label ?? v.kind}</span>
                <p className="flex-1 font-medium">{v.label}</p>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => { if (!confirm("حذف من الخزانة؟")) return; await supabase.from("client_vault").delete().eq("id", v.id); refetch(); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
              {url && <Row label="الرابط"><a href={url} target="_blank" rel="noreferrer" className="truncate text-gold hover:underline" dir="ltr">{url}</a><CopyBtn text={url} /></Row>}
              {v.username && <Row label="المستخدم"><span className="num truncate" dir="ltr">{v.username}</span><CopyBtn text={v.username} /></Row>}
              {secret && (
                <Row label={VAULT_KINDS[v.kind]?.secretLabel ?? "السر"}>
                  <span className="num truncate" dir="ltr">{v.kind === "password" && !shown[v.id] ? "••••••••" : secret}</span>
                  {v.kind === "password" && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShown((s) => ({ ...s, [v.id]: !s[v.id] }))}>{shown[v.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>}
                  <CopyBtn text={secret} />
                </Row>
              )}
              {v.notes && <p className="whitespace-pre-line text-xs text-muted-foreground">{v.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center gap-2 text-sm"><span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span><div className="flex min-w-0 flex-1 items-center gap-1">{children}</div></div>;
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
          if (v.contract_total) await supabase.rpc("generate_client_installments", { _client: id });
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
