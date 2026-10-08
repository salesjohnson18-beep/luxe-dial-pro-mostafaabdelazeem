import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Downloads a Google Sheet shared as "anyone with the link" as XLSX (base64). */
export const fetchGoogleSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().url().max(500) }).parse(d))
  .handler(async ({ data }) => {
    const m = data.url.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
    if (!m) return { ok: false as const, error: "الرابط ليس رابط Google Sheet صحيح" };
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${m[1]}/export?format=xlsx`, { redirect: "follow" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || type.includes("text/html"))
      return { ok: false as const, error: "تعذر فتح الشيت — تأكد أن المشاركة «أي شخص لديه الرابط يمكنه العرض»" };
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { ok: true as const, base64: btoa(bin) };
  });
