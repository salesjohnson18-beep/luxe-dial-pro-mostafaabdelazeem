import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { syncSheetNow } from "@/lib/sheet-sync.functions";
import { useMe } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "مزامنة Google Sheet — لوحة التشغيل" },
      { name: "description", content: "ربط النظام بجوجل شيت ومزامنة كل البيانات تلقائياً." },
      { property: "og:title", content: "مزامنة Google Sheet" },
      { property: "og:description", content: "مزامنة العملاء والحملات والمالية والمهام والعروض مع جوجل شيت." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const SCRIPT = `function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  data.sheets.forEach(function (s) {
    var sh = ss.getSheetByName(s.name) || ss.insertSheet(s.name);
    sh.clearContents();
    if (!s.rows.length) return;
    var w = s.rows.reduce(function (m, r) { return Math.max(m, r.length); }, 1);
    var rows = s.rows.map(function (r) { while (r.length < w) r.push(""); return r; });
    sh.getRange(1, 1, rows.length, w).setValues(rows);
    sh.getRange(1, 1, 1, w).setFontWeight("bold").setBackground("#111111").setFontColor("#d4af37");
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
  });
  return ContentService.createTextOutput("ok");
}`;

function SettingsPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const sync = useServerFn(syncSheetNow);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: s } = useQuery({
    queryKey: ["sheet-sync"],
    queryFn: async () => (await supabase.from("sheet_sync_settings").select("*").eq("id", true).maybeSingle()).data,
  });
  useEffect(() => { if (s?.webhook_url) setUrl(s.webhook_url); }, [s?.webhook_url]);

  if (me && !me.is("admin")) return <p className="p-6 text-muted-foreground">هذه الصفحة للأدمن فقط.</p>;

  async function save(patch: { webhook_url?: string | null; enabled?: boolean }) {
    const { error } = await supabase.from("sheet_sync_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", true);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["sheet-sync"] });
    toast.success("تم الحفظ");
  }

  async function runNow() {
    setBusy(true);
    try {
      const r = await sync();
      r.ok ? toast.success("تمت المزامنة مع الشيت") : toast.error(r.error);
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["sheet-sync"] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold">مزامنة Google Sheet</h1>
      <div className="luxe-card space-y-4 p-5">
        <div className="space-y-2">
          <Label>رابط المزامنة (Apps Script)</Label>
          <Input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => save({ webhook_url: url.trim() || null })}>حفظ الرابط</Button>
          <Button variant="outline" onClick={runNow} disabled={busy || !s?.webhook_url}><RefreshCw className={`ms-1 h-4 w-4 ${busy ? "animate-spin" : ""}`} />مزامنة الآن</Button>
          <label className="flex items-center gap-2 text-sm">المزامنة التلقائية <Switch checked={s?.enabled ?? true} onCheckedChange={(c) => save({ enabled: c })} /></label>
        </div>
        <p className="text-sm text-muted-foreground">
          آخر مزامنة: <span className="num">{s?.last_sync_at ? new Date(s.last_sync_at).toLocaleString("ar-EG") : "—"}</span> — {s?.last_status ?? "لم تتم بعد"}
        </p>
        <p className="text-xs text-muted-foreground">يتم تحديث الشيت تلقائياً كل 5 دقائق بكل حركة في النظام: العملاء، الحملات اليومية، مبيعات المتجر، الدفعات، الفواتير، المالية، عروض الأسعار، المتابعات، المهام والخدمات. (كلمات سر الخزنة لا تُزامن أبداً.)</p>
      </div>
      <div className="luxe-card space-y-3 p-5 text-sm">
        <p className="font-semibold text-gold">طريقة الربط (مرة واحدة فقط)</p>
        <ol className="list-decimal space-y-1 pe-5">
          <li>افتح الشيت ← من القائمة: Extensions (الإضافات) ← Apps Script.</li>
          <li>امسح أي كود موجود والصق الكود التالي ثم احفظ.</li>
          <li>اضغط Deploy ← New deployment ← النوع Web app، واجعل Who has access = Anyone، ثم Deploy ووافق على الصلاحيات.</li>
          <li>انسخ رابط Web app (ينتهي بـ /exec) والصقه بالأعلى واضغط «حفظ الرابط» ثم «مزامنة الآن».</li>
        </ol>
        <div className="relative">
          <pre dir="ltr" className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">{SCRIPT}</pre>
          <Button size="sm" variant="outline" className="absolute left-2 top-2" onClick={() => { navigator.clipboard.writeText(SCRIPT); toast.success("تم نسخ الكود"); }}><Copy className="h-3 w-3" /></Button>
        </div>
      </div>
    </div>
  );
}
