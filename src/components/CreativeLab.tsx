import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Bookmark, Copy, Sparkle, Trash2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { analyzeCampaigns, generateCreative, type CreativeItem } from "@/lib/ai.functions";

const KINDS = { hook: "هوكات", angle: "زوايا تسويقية", copy: "نصوص إعلانية", script: "سيناريو فيديو" } as const;
type Kind = keyof typeof KINDS;
const PLATFORMS = ["Meta", "TikTok", "Snapchat", "Google Ads", "Twitter/X"];

export function CreativeLab({ clientId }: { clientId: string }) {
  const gen = useServerFn(generateCreative);
  const analyze = useServerFn(analyzeCampaigns);
  const [platform, setPlatform] = useState("Meta");
  const [audience, setAudience] = useState("");
  const [offer, setOffer] = useState("");
  const [kinds, setKinds] = useState<Kind[]>(["hook", "angle"]);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<CreativeItem[]>([]);
  const [analysis, setAnalysis] = useState("");
  const [aBusy, setABusy] = useState(false);
  const saved = useQuery({ queryKey: ["ideas", clientId], queryFn: async () => (await supabase.from("creative_ideas").select("*").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [] });

  async function save(i: CreativeItem) {
    const { error } = await supabase.from("creative_ideas").insert({ client_id: clientId, kind: i.kind, platform, title: i.title || null, content: i.content });
    if (error) return void toast.error(error.message);
    toast.success("تم الحفظ في ملف العميل"); saved.refetch();
  }
  const copy = async (t: string) => { await navigator.clipboard.writeText(t); toast.success("تم النسخ"); };

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-xl border border-gold/30 bg-card p-4 sm:p-5">
        <p className="flex items-center gap-2 font-semibold text-gold"><Sparkle className="h-4 w-4" /> مختبر الكرييتف</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2"><Label>المنصة</Label>
            <Select value={platform} onValueChange={setPlatform}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>الجمهور المستهدف</Label><Input maxLength={500} placeholder="نساء 25-40 في الرياض..." value={audience} onChange={(e) => setAudience(e.target.value)} /></div>
          <div className="space-y-2"><Label>العرض / المنتج</Label><Input maxLength={500} placeholder="خصم 20% على باقات الورد" value={offer} onChange={(e) => setOffer(e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KINDS) as Kind[]).map((k) => (
            <Button key={k} size="sm" type="button" variant={kinds.includes(k) ? "default" : "outline"} onClick={() => setKinds((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}>{KINDS[k]}</Button>
          ))}
        </div>
        <Button disabled={busy || !kinds.length} onClick={async () => {
          setBusy(true);
          try { const r = await gen({ data: { clientId, platform, audience, offer, kinds } }); if (!r.ok) toast.error(r.error); else setItems(r.items); }
          catch { toast.error("تعذر الاتصال بالمساعد"); } finally { setBusy(false); }
        }}>{busy ? "جارِ التوليد..." : "توليد بالذكاء الاصطناعي"}</Button>
        {items.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((i, n) => (
              <div key={n} className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs text-gold">{KINDS[i.kind as Kind] ?? i.kind}{i.title ? ` · ${i.title}` : ""}</p>
                <p className="whitespace-pre-wrap break-words text-sm">{i.content}</p>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-8" onClick={() => save(i)}><Bookmark className="h-3.5 w-3.5" /> حفظ</Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copy(i.content)}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <p className="font-semibold">الأفكار المعتمدة في ملف العميل</p>
        {(saved.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">لا توجد أفكار محفوظة بعد.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {(saved.data ?? []).map((i) => (
            <div key={i.id} className="space-y-2 rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-gold">{KINDS[i.kind as Kind] ?? i.kind}{i.platform ? ` · ${i.platform}` : ""}{i.title ? ` · ${i.title}` : ""}</p>
              <p className="whitespace-pre-wrap break-words text-sm">{i.content}</p>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copy(i.content)}><Copy className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={async () => { await supabase.from("creative_ideas").delete().eq("id", i.id); saved.refetch(); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
        <p className="flex items-center gap-2 font-semibold text-gold"><TrendingUp className="h-4 w-4" /> مساعد تحليل الحملات (آخر 30 يوماً)</p>
        <Button variant="outline" disabled={aBusy} onClick={async () => {
          setABusy(true);
          try { const r = await analyze({ data: { clientId } }); if (!r.ok) toast.error(r.error); else setAnalysis(r.text); }
          catch { toast.error("تعذر الاتصال بالمساعد"); } finally { setABusy(false); }
        }}>{aBusy ? "جارِ التحليل..." : "حلّل الأداء وأعطني توصيات"}</Button>
        {analysis && <div className="prose prose-sm prose-invert max-w-none break-words leading-7 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:text-gold"><ReactMarkdown>{analysis}</ReactMarkdown></div>}
      </section>
    </div>
  );
}
