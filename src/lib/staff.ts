import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Registered team members (anyone with a role) for owner/assignee dropdowns. */
export function useStaff() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: async () => ((await supabase.rpc("list_staff")).data ?? []) as { id: string; name: string }[],
    staleTime: 5 * 60_000,
  });
}
