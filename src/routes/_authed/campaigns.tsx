import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listCampaigns, deleteCampaign } from "@/lib/campaigns.functions";
import { getInventoryStatus } from "@/lib/vendors.functions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/campaigns")({
  component: CampaignsPage,
});

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    scoring: { cls: "bg-amber-100 text-amber-800", label: "Scoring..." },
    in_progress: { cls: "bg-blue-100 text-blue-800", label: "In Progress" },
    exported: { cls: "bg-green-100 text-green-800", label: "Exported" },
    error: { cls: "bg-rose-100 text-rose-800", label: "Error" },
  };
  const match = map[status] ?? { cls: "bg-slate-100 text-slate-800", label: status };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${match.cls}`}>
      {match.label}
    </span>
  );
}

function CampaignsPage() {
  const navigate = useNavigate();
  const list = useServerFn(listCampaigns);
  const inv = useServerFn(getInventoryStatus);
  const del = useServerFn(deleteCampaign);
  const qc = useQueryClient();

  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => list({}),
  });
  const { data: inventory } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => inv({}),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: async () => {
      toast.success("Campaign deleted");
      setPendingDelete(null);
      await qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete campaign");
    },
  });

  const hasVendors = (inventory?.count ?? 0) > 0;

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="mb-6 h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <TooltipProvider>
        <div className="flex min-h-screen items-center justify-center p-8">
          <div className="max-w-xl text-center">
            <svg
              viewBox="0 0 120 120"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mx-auto h-28 w-28 text-muted-foreground"
            >
              <rect x="18" y="22" width="52" height="52" rx="6" />
              <path d="M31 36h26M31 48h26M31 60h18" />
              <circle cx="80" cy="78" r="16" />
              <path d="m92 90 10 10" />
            </svg>
            <h2 className="mt-5 text-2xl font-semibold">No campaigns yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload your vendor inventory first, then create your first campaign.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => navigate({ to: "/inventory" })}>
                Upload Inventory
              </Button>
              {hasVendors ? (
                <Button onClick={() => navigate({ to: "/campaigns/new" })}>New Campaign</Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button disabled>New Campaign</Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Upload inventory first</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          {hasVendors ? (
            <Button onClick={() => navigate({ to: "/campaigns/new" })}>New Campaign</Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled>New Campaign</Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Upload inventory first</TooltipContent>
            </Tooltip>
          )}
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
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">
                    <Link
                      to="/campaigns/$id"
                      params={{ id: campaign.id }}
                      className="hover:underline"
                    >
                      {campaign.client_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{campaign.client_niche}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(campaign.created_at)}</td>
                  <td className="px-4 py-3">
                    {campaign.included_count} / {campaign.link_count_goal}
                  </td>
                  <td className="px-4 py-3">${campaign.budget_per_link}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={campaign.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          navigate({ to: "/campaigns/$id", params: { id: campaign.id } })
                        }
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setPendingDelete({ id: campaign.id, name: campaign.client_name })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AlertDialog
          open={!!pendingDelete}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete
                  ? `This will permanently delete "${pendingDelete.name}" and its related results and exports.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (pendingDelete) delMut.mutate(pendingDelete.id);
                }}
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
