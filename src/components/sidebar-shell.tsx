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
    <div className="flex min-h-screen overflow-x-hidden bg-background">
      <aside className="fixed inset-y-0 left-0 z-10 flex w-[252px] flex-col border-r border-white/8 bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.18),transparent_18%),linear-gradient(180deg,rgba(15,23,42,1),rgba(20,29,48,0.98)_48%,rgba(17,24,39,1))] text-sidebar-foreground shadow-[18px_0_55px_rgba(15,23,42,0.22)]">
        <div className="px-5 pt-5">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 p-2 shadow-[0_14px_30px_rgba(15,23,42,0.18)] ring-1 ring-white/20">
                <img
                  src="https://bluetree.digital/wp-content/uploads/logo-dark-1-1-1.svg"
                  alt="BlueTree logo"
                  className="h-8 w-8 object-contain"
                />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-sidebar-foreground/50">
                  BlueTree
                </div>
                <div className="text-[15px] font-semibold leading-tight text-white">Domain Selector</div>
                <div className="mt-1 text-xs text-sidebar-foreground/48">Internal campaign selection workspace</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 px-5 text-[11px] uppercase tracking-[0.26em] text-sidebar-foreground/38">
          Workspace
        </div>

        <nav className="mt-3 flex-1 space-y-1.5 px-4 py-2">
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
                  "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-all duration-200",
                  isActive
                    ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.11),rgba(255,255,255,0.07))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_24px_rgba(15,23,42,0.18)] ring-1 ring-white/10"
                    : "text-sidebar-foreground/72 hover:bg-white/7 hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      : "bg-white/6 text-sidebar-foreground/70 group-hover:bg-white/10 group-hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-5 pb-5">
          <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.04))] p-4 text-xs text-sidebar-foreground/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="text-[11px] uppercase tracking-[0.22em] text-sidebar-foreground/34">
              Submitted By
            </div>
            <div className="mt-3 text-[15px] font-semibold text-white">Adrian Repomanta</div>
            <div className="mt-1.5 leading-relaxed text-sidebar-foreground/52">
              Application - Junior AI Tools Developer
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-[252px] min-h-screen min-w-0 flex-1 overflow-x-hidden">
        <div className="min-h-screen min-w-0 overflow-x-hidden bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.1),transparent_20%),radial-gradient(circle_at_10%_20%,rgba(255,255,255,0.75),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.34),rgba(246,248,252,0.92))]">
          {children}
        </div>
      </main>
    </div>
  );
}
