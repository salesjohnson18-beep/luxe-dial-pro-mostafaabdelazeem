import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const MODEL = "openai/gpt-6-astra";

function runIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has("X-Lovable-AIG-Run-ID")) headers.set("X-Lovable-AIG-Run-ID", runId);
    const res = await fetch(input, { ...init, headers });
    runId ??= res.headers.get("X-Lovable-AIG-Run-ID")?.trim() || undefined;
    return res;
  };
}

/** One-shot gateway call: streams server-side and returns the final text. */
export async function askAI(instructions: string, prompt: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch(),
  });
  const result = streamText({
    model: provider.responses(MODEL),
    instructions,
    messages: [{ role: "user", content: prompt }],
    maxRetries: 0,
    providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
  });
  return await result.text;
}

export function aiErrorMessage(e: unknown) {
  const s = String((e as { statusCode?: number })?.statusCode ?? "");
  const msg = e instanceof Error ? e.message : String(e);
  if (s === "402" || /402|credit/i.test(msg)) return "نفد رصيد الذكاء الاصطناعي في مساحة العمل — أضف رصيداً من إعدادات الفوترة.";
  if (s === "429" || /429|rate/i.test(msg)) return "ضغط كبير على الخدمة، حاول بعد دقيقة.";
  if (s === "403") return "الخدمة غير متاحة لهذه المساحة حالياً.";
  return "تعذر الحصول على رد من المساعد، حاول مرة أخرى.";
}

export function parseJson<T>(text: string): T | null {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (m ? m[1] : text)!.trim();
  const start = raw.search(/[[{]/);
  try { return JSON.parse(start > 0 ? raw.slice(start) : raw) as T; } catch { return null; }
}
