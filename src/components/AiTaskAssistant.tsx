import { useState } from "react";
import { toast } from "sonner";
import { Bot } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { draftTask, type TaskDraft } from "@/lib/ai.functions";
import { fmtArDateTime } from "@/lib/crm";

export function AiTaskAssistant({ kinds, onCreated }: { kinds: Record<string, string>; onCreated: () => void }) {
  const run = useServerFn(draftTask);
  const [req, setReq] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  return (
    <div className="space-y-3 rounded-xl border border-gold/30 bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-gold"><Bot className="h-4 w-4" /> مساعد المهام الذكي</p>
      <Textarea maxLength={1000} placeholder="مثال: ذكّرني بكرة الساعة 10 الصبح أرسل تقرير روجا روز، أو جدد إعلانات حراج يومياً" value={req} onChange={(e) => setReq(e.target.value)} />
      <Button size="sm" disabled={busy || req.trim().length < 2} onClick={async () => {
        setBusy(true); setDraft(null);
        try {
          const r = await run({ data: { request: req.trim(), now: new Date().toString() } });
          if (!r.ok) toast.error(r.error); else setDraft(r.task);
        } catch { toast.error("تعذر الاتصال بالمساعد"); } finally { setBusy(false); }
      }}>{busy ? "جارِ التحضير..." : "اقترح المهمة"}</Button>
      {draft && (
        <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
          <p className="font-medium">{draft.title}</p>
          <p className="text-xs text-muted-foreground">{kinds[draft.kind] ?? draft.kind} · {fmtArDateTime(draft.due_at)} · {draft.recurrence === "none" ? "مرة واحدة" : draft.recurrence}</p>
          {draft.note && <p className="text-muted-foreground">{draft.note}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={async () => {
              const { error } = await supabase.from("reminders").insert({ ...draft });
              if (error) return void toast.error(error.message);
              toast.success("تم إنشاء المهمة"); setDraft(null); setReq(""); onCreated();
            }}>تأكيد الإنشاء</Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>إلغاء</Button>
          </div>
        </div>
      )}
    </div>
  );
}
