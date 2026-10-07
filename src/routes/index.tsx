import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة مصطفى عبدالعظيم — الدخول" },
      { name: "description", content: "نظام إدارة الحملات والعملاء والتقارير لميديا باير." },
      { property: "og:title", content: "لوحة مصطفى عبدالعظيم" },
      { property: "og:description", content: "نظام إدارة الحملات والعملاء والتقارير." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/dashboard" : "/auth" });
  },
  component: () => null,
});
