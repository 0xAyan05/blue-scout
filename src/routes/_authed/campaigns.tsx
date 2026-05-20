import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listCampaigns, deleteCampaign } from "@/lib/campaigns.functions";
import { getInventoryStatus } from "@/lib/vendors.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/campaigns")({
  component: CampaignsPage,
});

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    scoring: { cls: "bg-amber-100 text-amber-800", label: "Scoring…" },
    in_progress: { cls: "bg-blue-100 text-blue-800", label: "In Progress" },
    exported: { cls: "bg-green-100 text-green-800", label: "Exported" },
  };
  const m = map[status] ?? { cls: "bg-slate-100 text-slate-800", label: status };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

function CampaignsPage() {
  const navigate = useNavigate();
  const list = useServerFn(listCampaigns);
  const inv = useServerFn(getInventoryStatus);
  const del = useServerFn(deleteCampaign);
  const qc = useQueryClient();

  const { data: campaigns, isLoading } = useQuery({ queryKey: ["campaigns"], queryFn: () => list({}) });
  const { data: inventory } = useQuery({ queryKey: ["inventory"], queryFn: () => inv({}) });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Campaign deleted");
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const hasVendors = (inventory?.count ?? 0) > 0;

  if (isLoading) {
    return <div className="p-8"><div className="h-8 w-48 animate-pulse rounded bg-muted" /></div>;
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto h-16 w-16 text-muted-foreground">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold">No campaigns yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {hasVendors ? "Create your first campaign to start scoring domains." : "Upload your vendor inventory first, then create your first campaign."}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/inventory" })}>Upload Inventory</Button>
            <Button onClick={() => navigate({ to: "/campaigns/new" })} disabled={!hasVendors}>New Campaign</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <Button onClick={() => navigate({ to: "/campaigns/new" })} disabled={!hasVendors}>New Campaign</Button>
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Niche</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Selected / Goal</th>
              <th className="px-4 py-3 font-medium">Budget</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-semibold">
                  <Link to="/campaigns/$id" params={{ id: c.id }} className="hover:underline">{c.client_name}</Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.client_niche}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.created_at ? new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                </td>
                <td className="px-4 py-3">{c.included_count} / {c.link_count_goal}</td>
                <td className="px-4 py-3">${c.budget_per_link}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/campaigns/$id", params: { id: c.id } })}>Open</Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete campaign "${c.client_name}"?`)) delMut.mutate(c.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
