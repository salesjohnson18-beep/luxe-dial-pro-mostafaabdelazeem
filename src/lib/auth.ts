import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "media_buyer" | "sales" | "accountant";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير النظام",
  media_buyer: "ميديا باير",
  sales: "مبيعات / خدمة عملاء",
  accountant: "محاسب",
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return null;
      await supabase.rpc("bootstrap_user");
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const list = (roles ?? []).map((r) => r.role as Role);
      return {
        user,
        roles: list,
        is: (r: Role) => list.includes(r),
        canEditCampaigns: list.includes("admin") || list.includes("media_buyer"),
      };
    },
    staleTime: 60_000,
  });
}
