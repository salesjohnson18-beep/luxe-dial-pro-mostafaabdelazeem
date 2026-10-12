import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMe } from "@/lib/auth";
import { useStaff } from "@/lib/staff";
import { fmtArDateTime } from "@/lib/crm";
import { AiTaskAssistant } from "@/components/AiTaskAssistant";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "المهام والتنبيهات — لوحة التشغيل" },
      { name: "description", content: "المهام اليومية والمتكررة وحملاتي الشخصية." },
      { property: "og:title", content: "المهام والتنبيهات" },
      { property: "og:description", content: "المهام اليومية والمتكررة وحملاتي الشخصية." },
    ],
  }),
  component: TasksPage,
});

export const TASK_KINDS: Record<string, string> = {
  task: "مهمة",
  haraj: "تجديد إعلانات حراج",
  ad: "حملة / إعلان شخصي",
  limit: "تجديد ليمت حساب إعلاني",
  other: "تذكير",
};
const RECUR: Record<string, string> = { none: "مرة واحدة", daily: "يومي", weekly: "أسبوعي", monthly: "شهري" };

export function nextDue(due: string, rec: string) {
  const d = new Date(due);
  const now = new Date();
  do {
    if (rec === "daily") d.setDate(d.getDate() + 1);
    else if (rec === "weekly") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
  } while (d <= now);
  return d.toISOString();
}

export async function completeReminder(r: { id: string; recurrence: string; due_at: string }) {
  const now = new Date().toISOString();
  return r.recurrence === "none"
    ? supabase.from("reminders").update({ done: true, last_done_at: now }).eq("id", r.id)
    : supabase.from("reminders").update({ due_at: nextDue(r.due_at, r.recurrence), last_done_at: now }).eq("id", r.id);
}

function TasksPage() {
  const { data: me } = useMe();
  const { data: staff } = useStaff();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"open" | "personal" | "done">("open");
  const { data, refetch } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => (await supabase.from("reminders").select("*, clients(project_name)").order("due_at")).data ?? [],
  });
  const name = (id: string | null) => staff?.find((s) => s.id === id)?.name ?? "";
  const shown = (data ?? []).filter((r) =>
    tab === "done" ? r.done : !r.done && (tab === "personal" ? ["haraj", "ad", "limit"].includes(r.kind) : true),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border pb-5 sm:flex sm:justify-between">
        <h1 className="text-3xl font-bold">المهام والتنبيهات</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> مهمة / تذكير</Button>
      </div>
      <AiTaskAssistant kinds={TASK_KINDS} onCreated={() => refetch()} />
      <div className="flex flex-wrap gap-2">
        {([["open", "المفتوحة"], ["personal", "حملاتي وإعلاناتي"], ["done", "المنجزة"]] as const).map(([k, l]) => (
          <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>{l}</Button>
        ))}
      </div>
      {shown.length === 0 && <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">لا توجد عناصر.</div>}
      <div className="space-y-2">
        {shown.map((r) => {
          const overdue = !r.done && new Date(r.due_at) <= new Date();
          return (
            <div key={r.id} className={`flex items-center gap-3 rounded-lg border bg-card p-4 ${overdue ? "border-gold/60" : "border-border"}`}>
              {!r.done && (
                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" title="تم" onClick={async () => { const { error } = await completeReminder(r); if (error) toast.error(error.message); else { toast.success(r.recurrence === "none" ? "تم الإنجاز" : "تم — جُدول الموعد التالي"); refetch(); } }}>
                  <Check className="h-4 w-4" />
                </Button>
              )}
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${r.done ? "line-through opacity-60" : ""}`}>{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="text-gold">{TASK_KINDS[r.kind] ?? r.kind}</span> · {RECUR[r.recurrence]} · {fmtArDateTime(r.due_at)}
                  {(r.clients as { project_name: string } | null)?.project_name ? ` · ${(r.clients as { project_name: string }).project_name}` : ""}
                  {r.assignee_id ? ` · المسؤول: ${name(r.assignee_id)}` : ""}
                </p>
                {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
              </div>
              {r.link && <a href={r.link} target="_blank" rel="noreferrer" className="text-xs text-gold hover:underline">فتح</a>}
              {(r.owner_id === me?.user.id || me?.is("admin")) && (
                <Button size="icon" variant="ghost" onClick={async () => { await supabase.from("reminders").delete().eq("id", r.id); refetch(); }}><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
          );
        })}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>مهمة / تذكير جديد</DialogTitle></DialogHeader>
          <NewTask meId={me?.user.id ?? ""} onDone={() => { setOpen(false); refetch(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewTask({ meId, onDone }: { meId: string; onDone: () => void }) {
  const { data: staff } = useStaff();
  const { data: clients } = useQuery({
    queryKey: ["clients-lite"],
    queryFn: async () => (await supabase.from("clients").select("id,client_name,project_name").order("client_name")).data ?? [],
  });
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000 + 3600000).toISOString().slice(0, 16);
  const [f, setF] = useState({ title: "", kind: "task", recurrence: "none", due: local, client_id: "none", assignee_id: meId, note: "", link: "" });
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await supabase.from("reminders").insert({
          title: f.title.trim(), kind: f.kind, recurrence: f.recurrence, due_at: new Date(f.due).toISOString(),
          client_id: f.client_id === "none" ? null : f.client_id, assignee_id: f.assignee_id || null,
          note: f.note.trim() || null, link: f.link.trim() || null,
        });
        if (error) return void toast.error(error.message);
        toast.success("تمت الإضافة");
        onDone();
      }}
    >
      <div className="space-y-1"><Label>العنوان</Label><Input required maxLength={200} placeholder="مثال: تجديد إعلانات حراج" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label>النوع</Label>
          <Select value={f.kind} onValueChange={(x) => setF({ ...f, kind: x, recurrence: x === "haraj" ? "daily" : f.recurrence })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(TASK_KINDS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>التكرار</Label>
          <Select value={f.recurrence} onValueChange={(x) => setF({ ...f, recurrence: x })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(RECUR).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>الاستحقاق</Label><Input type="datetime-local" className="num" required value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></div>
        <div className="space-y-1"><Label>المسؤول</Label>
          <Select value={f.assignee_id} onValueChange={(x) => setF({ ...f, assignee_id: x })}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>{staff?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1"><Label>مرتبطة بعميل</Label>
        <Select value={f.client_id} onValueChange={(x) => setF({ ...f, client_id: x })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">مهمة شخصية عامة</SelectItem>
            {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.project_name} — {c.client_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>رابط (اختياري)</Label><Input dir="ltr" maxLength={500} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></div>
      <div className="space-y-1"><Label>ملاحظة</Label><Input maxLength={1000} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
      <Button type="submit">حفظ</Button>
    </form>
  );
}
