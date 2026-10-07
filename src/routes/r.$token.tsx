import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ReportCard } from "@/components/ReportCard";
import { DateRange } from "@/components/DateRange";
import { today, type Entry } from "@/lib/metrics";

export const Route = createFileRoute("/r/$token")({
  ssr: false,
  validateSearch: z.object({ from: z.string().optional(), to: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "تقرير الأداء — Mostafa Abdelazeem" },
      { name: "description", content: "تقرير أداء الحملات الإعلانية." },
      { property: "og:title", content: "تقرير الأداء" },
      { property: "og:description", content: "تقرير أداء الحملات الإعلانية التفاعلي." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedReport,
});

function SharedReport() {
  const { token } = Route.useParams();
  const s = Route.useSearch();
  const [from, setFrom] = useState(s.from ?? today());
  const [to, setTo] = useState(s.to ?? today());
  const { data, isLoading } = useQuery({
    queryKey: ["shared", token, from, to],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_shared_report", { _token: token, _from: from, _to: to });
      return data as { client_name: string; project_name: string; entries: Entry[] } | null;
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 py-10">
      <div className="flex justify-center"><DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} /></div>
      {isLoading ? (
        <p className="text-center text-muted-foreground">جارِ التحميل...</p>
      ) : !data ? (
        <p className="text-center">الرابط غير صالح.</p>
      ) : (
        <ReportCard title={data.project_name} dateLabel={from === to ? from : `${from} → ${to}`} entries={data.entries} />
      )}
    </div>
  );
}
