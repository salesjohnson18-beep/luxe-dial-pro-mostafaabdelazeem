import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientForm, emptyClient } from "@/components/ClientForm";
import { useMe } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({
    meta: [
      { title: "العملاء — لوحة التشغيل" },
      { name: "description", content: "قائمة العملاء والمشاريع." },
      { property: "og:title", content: "العملاء" },
      { property: "og:description", content: "إدارة العملاء والمشاريع." },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const { data: me } = useMe();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: clients, refetch } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <h1 className="text-3xl font-bold">العملاء</h1>
        {me?.canEditCampaigns && (
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> عميل جديد</Button>
        )}
      </div>
      {clients?.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          لا يوجد عملاء بعد. ابدأ بإضافة أول عميل.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients?.map((c) => (
          <Link key={c.id} to="/clients/$id" params={{ id: c.id }} className="rounded-xl border border-border bg-card p-5 transition hover:border-gold/50">
            <p className="text-xs text-gold">{c.industry || "—"}</p>
            <h3 className="mt-1 text-lg font-semibold">{c.project_name}</h3>
            <p className="text-sm text-muted-foreground">{c.client_name}</p>
            <div className="mt-4 flex gap-2 text-[11px] text-muted-foreground">
              <span className="rounded border border-border px-2 py-0.5">{c.contract_type === "fulltime" ? "دوام كامل" : "فري لانس"}</span>
              <span className="rounded border border-border px-2 py-0.5">تحويل {c.transfer_cycle === "monthly" ? "شهري" : "أسبوعي"}</span>
            </div>
          </Link>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" dir="rtl">
          <DialogHeader><DialogTitle>عميل جديد</DialogTitle></DialogHeader>
          <ClientForm
            initial={emptyClient}
            submitLabel="حفظ العميل"
            onSubmit={async (v) => {
              const { data, error } = await supabase.from("clients").insert(v).select("id").single();
              if (error) return void toast.error(error.message);
              toast.success("تم إضافة العميل");
              setOpen(false);
              refetch();
              nav({ to: "/clients/$id", params: { id: data.id } });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
