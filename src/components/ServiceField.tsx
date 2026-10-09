import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Pick a service from the catalog, or type a custom one. */
export function ServiceField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: services } = useQuery({
    queryKey: ["services-active"],
    queryFn: async () => (await supabase.from("services").select("id,name").eq("is_active", true).order("name")).data ?? [],
  });
  const names = services?.map((s) => s.name) ?? [];
  const [custom, setCustom] = useState(!!value && services !== undefined && !names.includes(value));
  const isCustom = custom || (!!value && services !== undefined && !names.includes(value));
  return (
    <div className="space-y-2">
      <Select value={isCustom ? "__custom" : value} onValueChange={(x) => { if (x === "__custom") { setCustom(true); onChange(""); } else { setCustom(false); onChange(x); } }}>
        <SelectTrigger><SelectValue placeholder="اختر خدمة من الدليل" /></SelectTrigger>
        <SelectContent>
          {names.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          <SelectItem value="__custom">خدمة أخرى (كتابة يدوية)...</SelectItem>
        </SelectContent>
      </Select>
      {isCustom && <Input maxLength={200} placeholder="اكتب الخدمة أو المنتج" value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}
