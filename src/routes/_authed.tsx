import { createFileRoute, redirect, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { checkAuth, logout } from "@/lib/auth.functions";
import {
  LayoutGrid,
  PlusSquare,
  Database,
  Settings,
  LogOut,
} from "lucide-react";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async () => {
    const { authenticated } = await checkAuth();
    if (!authenticated) throw redirect({ to: "/login" });
  },
  component: AuthedLayout,
});

const NAV = [
  { to: "/campaigns", label: "Campaigns", icon: LayoutGrid },
  { to: "/campaigns/new", label: "New Campaign", icon: PlusSquare },
  { to: "/inventory", label: "Inventory", icon: Database },
  { to: "/config", label: "Config", icon: Settings },
] as const;

function AuthedLayout() {
  const logoutFn = useServerFn(logout);
  const location = useLocation();
  const handleLogout = async () => {
    await logoutFn({});
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-10 flex w-[220px] flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
            </svg>
          </div>
          <div className="text-sm font-semibold">Domain Selector</div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.to ||
              (item.to === "/campaigns" &&
                location.pathname.startsWith("/campaigns") &&
                location.pathname !== "/campaigns/new");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  isActive
                    ? "border-l-2 border-primary bg-sidebar-accent text-sidebar-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border px-3 py-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="ml-[220px] min-h-screen flex-1">
        <Outlet />
      </main>
    </div>
  );
}
