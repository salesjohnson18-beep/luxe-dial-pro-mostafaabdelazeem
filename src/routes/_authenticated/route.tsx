import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, UserCog, Contact, Package, LogOut, Briefcase, FileText, ListChecks, Wallet, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = Route.useRouteContext();
  const { data: profile } = useQuery({
    queryKey: ["my-profile", user.id],
    queryFn: async () => (await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()).data,
  });

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
          <Button variant="ghost" onClick={signOut} className="mt-6 text-gold">تسجيل الخروج</Button>
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
    ...(me?.is("admin") || me?.is("accountant") ? [{ to: "/finance", label: "المالية والمحاسبة", icon: Wallet }] : []),
    { to: "/tasks", label: "المهام والتنبيهات", icon: ListChecks },
    ...(me?.is("admin") ? [{ to: "/users", label: "المستخدمون", icon: UserCog }] : []),
  ] as const;

  return (
    <div className="flex min-h-screen min-w-0">
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
          {profile?.full_name && <p className="mt-1 break-words text-foreground">{profile.full_name}</p>}
          <p className="mt-1 text-gold">{me?.roles.map((r) => ROLE_LABELS[r]).join("، ")}</p>
          <Button variant="ghost" onClick={signOut} className="mt-3 h-auto justify-start px-0 text-xs">
            <LogOut className="h-3.5 w-3.5" /> تسجيل الخروج
          </Button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/95 p-3 backdrop-blur md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild><Button variant="ghost" size="icon" className="shrink-0" aria-label="فتح القائمة"><Menu className="h-5 w-5" /></Button></SheetTrigger>
              <SheetContent side="right" className="flex w-[min(88vw,320px)] flex-col border-sidebar-border bg-sidebar px-4 pt-14" dir="rtl">
                <div className="border-b border-sidebar-border pb-5">
                  <p className="num text-[10px] text-gold">MOSTAFA ABDELAZEEM</p>
                  <SheetTitle className="mt-2 text-right">لوحة التشغيل</SheetTitle>
                  <SheetDescription className="sr-only">أقسام الحساب</SheetDescription>
                </div>
                <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="أقسام النظام">
                  {links.map((l) => <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center gap-3 rounded-md px-3 py-3 text-sm text-sidebar-foreground transition hover:bg-sidebar-accent" activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}><l.icon className="h-5 w-5 shrink-0" /><span className="min-w-0">{l.label}</span></Link>)}
                </nav>
                <div className="shrink-0 space-y-2 border-t border-sidebar-border pb-3 pt-4">
                  <p className="break-words text-sm font-medium">{profile?.full_name || me?.user.email?.split("@")[0]}</p>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">{me?.user.email}</p>
                  <p className="text-xs text-gold">{me?.roles.map((r) => ROLE_LABELS[r]).join("، ")}</p>
                  <Button variant="outline" className="w-full justify-start" onClick={() => { setMenuOpen(false); void signOut(); }}><LogOut className="h-4 w-4" />تسجيل الخروج</Button>
                </div>
              </SheetContent>
            </Sheet>
            <span className="truncate text-base font-bold">لوحة التشغيل</span>
          </div>
          <div className="shrink-0">
            <NotificationBell />
          </div>
        </header>
        <div className="sticky top-0 z-30 hidden justify-end border-b border-border bg-background/80 px-8 py-2 backdrop-blur md:flex">
          <NotificationBell />
        </div>
        <main className="app-content mx-auto w-full min-w-0 max-w-6xl p-3 sm:p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

