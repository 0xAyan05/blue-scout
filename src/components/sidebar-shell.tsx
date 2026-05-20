"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, LayoutGrid, PlusSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/campaigns", label: "Campaigns", icon: LayoutGrid },
  { href: "/campaigns/new", label: "New Campaign", icon: PlusSquare },
  { href: "/inventory", label: "Inventory", icon: Database },
  { href: "/config", label: "Config", icon: Settings },
];

export function SidebarShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-10 flex w-[236px] flex-col border-r border-sidebar-border/60 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.96))] text-sidebar-foreground shadow-[12px_0_40px_rgba(15,23,42,0.18)]">
        <div className="px-4 pt-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(129,140,248,1),rgba(99,102,241,1))] text-primary-foreground shadow-lg shadow-indigo-950/30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
                </svg>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-sidebar-foreground/55">
                  BlueTree
                </div>
                <div className="text-sm font-semibold">Domain Selector</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 px-4 text-[11px] uppercase tracking-[0.22em] text-sidebar-foreground/45">
          Workspace
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3 py-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href === "/campaigns" &&
                pathname.startsWith("/campaigns") &&
                pathname !== "/campaigns/new");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                  isActive
                    ? "bg-white/10 text-white shadow-inner ring-1 ring-white/10"
                    : "text-sidebar-foreground/75 hover:bg-white/6 hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition",
                    isActive
                      ? "bg-white/12 text-white"
                      : "bg-white/5 text-sidebar-foreground/70 group-hover:bg-white/10 group-hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-4">
          <div className="rounded-2xl border border-white/8 bg-white/5 p-3 text-xs text-sidebar-foreground/60">
            <div className="text-[11px] uppercase tracking-[0.2em] text-sidebar-foreground/40">
              Submitted By
            </div>
            <div className="mt-2 text-sm font-semibold text-white">Adrian Repomanta</div>
            <div className="mt-1 leading-relaxed text-sidebar-foreground/55">
              Application - Junior AI Tools Developer
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-[236px] min-h-screen flex-1">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.35),rgba(248,250,252,0.8))]">
          {children}
        </div>
      </main>
    </div>
  );
}
