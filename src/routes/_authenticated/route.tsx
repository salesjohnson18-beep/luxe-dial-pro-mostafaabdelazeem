import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, UserCog, Contact, Package, LogOut, Briefcase, FileText, ListChecks, Wallet } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { supabase } from "@/integrations/supabase/client";
import { useMe, ROLE_LABELS } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

function Shell() {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">جارِ التحميل...</div>;

  if (me && me.roles.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="luxe-card max-w-md p-8 text-center">
          <h1 className="text-xl font-bold">حسابك بانتظار التفعيل</h1>
          <p className="mt-2 text-sm text-muted-foreground">سيحدد مدير النظام دورك وصلاحياتك قريباً.</p>
          <button onClick={signOut} className="mt-6 text-sm text-gold hover:underline">تسجيل الخروج</button>
        </div>
      </div>
    );
  }

  const links = [
    { to: "/dashboard", label: "نظرة عامة", icon: LayoutDashboard },
    { to: "/clients", label: "العملاء", icon: Briefcase },
    ...(me?.is("admin") || me?.is("sales") || me?.is("accountant")
      ? [{ to: "/leads", label: "المتابعة والعملاء المحتملون", icon: Contact }, { to: "/quotes", label: "عروض الأسعار", icon: FileText }, { to: "/services", label: "دليل الخدمات", icon: Package }]
      : []),
    ...(me?.is("admin") || me?.is("accountant") ? [{ to: "/finance", label: "الماليات والدفعات", icon: Wallet }] : []),
    { to: "/tasks", label: "المهام والتنبيهات", icon: ListChecks },
    ...(me?.is("admin") ? [{ to: "/users", label: "المستخدمون", icon: UserCog }] : []),
  ] as const;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-l border-sidebar-border bg-sidebar p-4 md:flex">
        <div className="mb-8 px-2">
          <p className="num text-[10px] tracking-[0.3em] text-gold">MOSTAFA ABDELAZEEM</p>
          <p className="mt-1 text-lg font-bold">لوحة التشغيل</p>
        </div>
        <nav className="flex-1 space-y-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border pt-4 text-xs text-muted-foreground">
          <p className="truncate" dir="ltr">{me?.user.email}</p>
          <p className="mt-1 text-gold">{me?.roles.map((r) => ROLE_LABELS[r]).join("، ")}</p>
          <button onClick={signOut} className="mt-3 flex items-center gap-2 hover:text-foreground">
            <LogOut className="h-3.5 w-3.5" /> تسجيل الخروج
          </button>
        </div>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-border p-3 md:hidden">
          <span className="font-bold">لوحة التشغيل</span>
          <div className="flex items-center gap-3">
            <NotificationBell />
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="text-muted-foreground" activeProps={{ className: "text-gold" }}>
                <l.icon className="h-5 w-5" />
              </Link>
            ))}
            <button onClick={signOut} className="text-muted-foreground"><LogOut className="h-5 w-5" /></button>
          </div>
        </header>
        <div className="sticky top-0 z-30 hidden justify-end border-b border-border bg-background/80 px-8 py-2 backdrop-blur md:flex">
          <NotificationBell />
        </div>
        <main className="mx-auto max-w-6xl p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

