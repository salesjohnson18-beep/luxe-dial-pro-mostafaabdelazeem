import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/auth";
import { playChime } from "@/lib/chime";
import { cur, fmtArDateTime, transferDue, waLink } from "@/lib/crm";
import { fmt, today } from "@/lib/metrics";
import { completeReminder } from "@/routes/_authenticated/tasks";

type Note = {
  id: string; kind: "task" | "lead" | "payment" | "transfer"; title: string; sub: string; at: string;
  to: { to: string; params?: Record<string, string> }; action?: { label: string; run: () => PromiseLike<unknown> }; wa?: string;
};
const ICON: Record<Note["kind"], string> = { task: "✓", lead: "☎", payment: "💰", transfer: "↗" };

export function NotificationBell() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [sound, setSound] = useState(true);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => { setSound(localStorage.getItem("bell-sound") !== "off"); }, []);

  const { data: notes = [] } = useQuery({
    queryKey: ["notifications"],
    enabled: !!me,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Note[]> => {
      const now = new Date().toISOString();
      const t = today();
      const out: Note[] = [];
      const fin = me!.is("admin") || me!.is("accountant");
      const crm = me!.is("admin") || me!.is("sales");
      const camp = me!.canEditCampaigns;
      const [rem, leads, inst, clients] = await Promise.all([
        supabase.from("reminders").select("*").eq("done", false).lte("due_at", now).or(`owner_id.eq.${me!.user.id},assignee_id.eq.${me!.user.id}`),
        crm ? supabase.from("leads").select("id,client_name,phone,next_followup_at").eq("status", "following").lte("next_followup_at", now) : Promise.resolve({ data: [] }),
        fin ? supabase.from("client_installments").select("*, clients(id,project_name,phone)").eq("paid", false).lte("due_date", t) : Promise.resolve({ data: [] }),
        camp ? supabase.from("clients").select("id,project_name,phone,transfer_cycle,work_start_date,last_transfer_at,is_active").eq("is_active", true) : Promise.resolve({ data: [] }),
      ]);
      for (const r of rem.data ?? []) out.push({ id: `r:${r.id}:${r.due_at}`, kind: "task", title: r.title, sub: "مهمة مستحقة", at: r.due_at, to: { to: "/tasks" }, action: { label: "تم", run: () => completeReminder(r) } });
      for (const l of (leads.data ?? []) as { id: string; client_name: string; phone: string | null; next_followup_at: string }[])
        out.push({ id: `l:${l.id}:${l.next_followup_at}`, kind: "lead", title: `موعد متابعة: ${l.client_name}`, sub: "كارت المتابعة", at: l.next_followup_at, to: { to: "/leads/$id", params: { id: l.id } }, ...(l.phone ? { wa: waLink(l.phone) } : {}) });
      for (const i of (inst.data ?? []) as { id: string; amount: number; currency: string; number: number; total_count: number; due_date: string; clients: { id: string; project_name: string; phone: string | null } | null }[])
        out.push({
          id: `p:${i.id}`, kind: "payment", title: `هل دفع ${i.clients?.project_name ?? "العميل"}؟`,
          sub: `الدفعة المستحقة: ${fmt(Number(i.amount))} ${cur(i.currency)} - الدفعة ${i.number} من ${i.total_count}`, at: i.due_date + "T09:00:00Z",
          to: { to: "/finance" }, action: { label: "نعم دفع", run: () => supabase.rpc("set_installment_paid", { _id: i.id, _paid: true }) },
        });
      for (const c of (clients.data ?? []) as { id: string; project_name: string; phone: string | null; transfer_cycle: string; work_start_date: string | null; last_transfer_at: string | null }[]) {
        const base = c.last_transfer_at ?? c.work_start_date;
        if (!base) continue;
        const due = transferDue(base, c.transfer_cycle);
        if (due > t) continue;
        out.push({
          id: `t:${c.id}:${due}`, kind: "transfer", title: `موعد رسالة التحويل ${c.transfer_cycle === "monthly" ? "الشهري" : "الأسبوعي"}: ${c.project_name}`,
          sub: "أرسل رسالة التحويل للعميل", at: due + "T09:00:00Z", to: { to: "/clients/$id", params: { id: c.id } },
          action: { label: "تم الإرسال", run: () => supabase.from("clients").update({ last_transfer_at: t }).eq("id", c.id) },
          ...(c.phone ? { wa: waLink(c.phone, "مرحباً، نذكركم بموعد التحويل لهذه الدورة. شكراً لكم") } : {}),
        });
      }
      return out.sort((a, b) => b.at.localeCompare(a.at));
    },
  });

  // Ring when new items appear (not on first load of the session's known items)
  useEffect(() => {
    const ids = new Set(notes.map((n) => n.id));
    if (seen.current === null) {
      const stored = new Set<string>(JSON.parse(localStorage.getItem("bell-seen") ?? "[]"));
      seen.current = stored;
    }
    const fresh = notes.filter((n) => !seen.current!.has(n.id));
    if (fresh.length) {
      if (sound) playChime();
      toast(fresh[0]!.title, { description: fresh.length > 1 ? `و ${fresh.length - 1} تنبيهات أخرى` : fresh[0]!.sub });
      fresh.forEach((n) => seen.current!.add(n.id));
      localStorage.setItem("bell-seen", JSON.stringify([...seen.current!].filter((id) => ids.has(id))));
    }
  }, [notes, sound]);

  const toggleSound = () => { const v = !sound; setSound(v); localStorage.setItem("bell-sound", v ? "on" : "off"); if (v) playChime(); };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative shrink-0 text-muted-foreground" aria-label="الإشعارات">
          <Bell className="h-5 w-5" />
          {notes.length > 0 && <span className="num absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[11px] font-bold text-primary-foreground">{notes.length > 99 ? "99+" : notes.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0" dir="rtl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-bold">الإشعارات</p>
          <Button size="icon" variant="ghost" onClick={toggleSound} className="text-muted-foreground hover:text-gold" aria-label={sound ? "كتم الرنة" : "تشغيل الرنة"} title={sound ? "كتم الرنة" : "تشغيل الرنة"}>{sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</Button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {notes.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">لا توجد تنبيهات مستحقة 🎉</p>}
          {notes.map((n) => (
            <div key={n.id} className="flex gap-3 border-b border-border px-4 py-3 hover:bg-accent/40">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold">{ICON[n.kind]}</span>
              <div className="min-w-0 flex-1">
                <Link {...(n.to as { to: "/tasks" })} className="block text-sm font-medium hover:text-gold">{n.title}</Link>
                <p className="text-xs text-muted-foreground">{n.sub}</p>
                <p className="mt-0.5 text-[11px] text-gold/80">{fmtArDateTime(n.at)}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {n.action && <Button variant="outline" size="sm" className="h-8 px-2 text-xs text-gold" onClick={async () => { await n.action?.run(); qc.invalidateQueries(); }}>{n.action.label}</Button>}
                  {n.wa && <a href={n.wa} target="_blank" rel="noreferrer" className="rounded border border-success/40 px-2 py-0.5 text-xs text-success">واتساب</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
