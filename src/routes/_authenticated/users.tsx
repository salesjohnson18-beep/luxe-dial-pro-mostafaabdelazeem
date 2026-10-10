import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { useMe, ROLE_LABELS, type Role } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "المستخدمون والصلاحيات — لوحة التشغيل" },
      { name: "description", content: "إدارة المستخدمين وأدوارهم." },
      { property: "og:title", content: "المستخدمون" },
      { property: "og:description", content: "إدارة المستخدمين والصلاحيات." },
    ],
  }),
  component: UsersPage,
});

const ROLES: Role[] = ["admin", "media_buyer", "sales", "accountant"];

function UsersPage() {
  const { data: me } = useMe();
  const { data: users, refetch } = useQuery({
    queryKey: ["users"],
    enabled: !!me?.is("admin"),
    queryFn: async () => (await supabase.rpc("list_users")).data ?? [],
  });
  if (!me?.is("admin")) return <p>هذه الصفحة لمدير النظام فقط.</p>;

  async function toggle(userId: string, role: Role, on: boolean) {
    const { error } = on
      ? await supabase.from("user_roles").insert({ user_id: userId, role })
      : await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) toast.error(error.message);
    refetch();
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold">المستخدمون والصلاحيات</h1>
        <p className="mt-1 text-sm text-muted-foreground">أي شخص ينشئ حساباً يظهر هنا بانتظار أن تحدد دوره.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3 text-right">المستخدم</th>
              {ROLES.map((r) => <th key={r} className="p-3">{ROLE_LABELS[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-b border-border">
                <td className="p-3">
                  <p>{u.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{u.email}</p>
                  {u.roles.length === 0 && <p className="text-[11px] text-gold">بانتظار التفعيل</p>}
                </td>
                {ROLES.map((r) => (
                  <td key={r} className="p-3 text-center">
                    <Checkbox
                      checked={u.roles.includes(r)}
                      disabled={u.id === me.user.id && r === "admin"}
                      onCheckedChange={(c) => toggle(u.id, r, !!c)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
