import { SidebarShell } from "@/components/sidebar-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <SidebarShell>{children}</SidebarShell>;
}
