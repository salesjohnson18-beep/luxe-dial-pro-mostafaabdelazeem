import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — لوحة مصطفى عبدالعظيم" },
      { name: "description", content: "سجّل الدخول لإدارة العملاء والحملات والتقارير." },
      { property: "og:title", content: "تسجيل الدخول" },
      { property: "og:description", content: "الدخول إلى نظام إدارة الحملات." },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "verify";

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes("confirm")) {
            setMode("verify");
            await supabase.auth.resend({ type: "signup", email });
            toast.info("أرسلنا كود التحقق إلى بريدك");
            return;
          }
          throw error;
        }
        nav({ to: "/dashboard" });
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("كلمة المرور 8 أحرف على الأقل");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        setMode("verify");
        toast.success("أرسلنا كود التحقق إلى بريدك الإلكتروني");
      } else {
        const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "signup" });
        if (error) throw error;
        nav({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="luxe-card w-full max-w-md space-y-5 p-8">
        <div>
          <p className="num text-xs tracking-[0.3em] text-gold">MOSTAFA ABDELAZEEM</p>
          <h1 className="mt-2 text-2xl font-bold">
            {mode === "login" ? "تسجيل الدخول" : mode === "signup" ? "إنشاء حساب" : "كود التحقق"}
          </h1>
          {mode === "verify" && (
            <p className="mt-1 text-sm text-muted-foreground">أدخل الكود المرسل إلى {email} أو اضغط الرابط في الإيميل.</p>
          )}
        </div>
        {mode === "signup" && (
          <div className="space-y-2">
            <Label>الاسم</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
          </div>
        )}
        {mode !== "verify" ? (
          <>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <Input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label>الكود</Label>
            <Input dir="ltr" className="num text-center text-lg tracking-[0.5em]" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={10} />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "..." : mode === "login" ? "دخول" : mode === "signup" ? "إنشاء الحساب" : "تأكيد"}
        </Button>
        <div className="text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <button type="button" onClick={() => setMode("signup")} className="text-gold hover:underline">
              ليس لديك حساب؟ أنشئ حساباً
            </button>
          ) : (
            <button type="button" onClick={() => setMode("login")} className="text-gold hover:underline">
              لديك حساب؟ سجّل الدخول
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
