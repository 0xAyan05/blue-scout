"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
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
import { fetchJson } from "@/lib/client-fetch";
import { toast } from "sonner";

type Campaign = {
  id: string;
  client_name: string;
  client_niche: string;
  created_at: string | null;
  link_count_goal: number;
  budget_per_link: number;
  status: string;
  included_count: number;
};

type InventoryStatus = {
  count: number;
  lastUploadedAt: string | null;
};

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

export default function CampaignsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => fetchJson<Campaign[]>("/api/campaigns"),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: inventory } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => fetchJson<InventoryStatus>("/api/inventory/status"),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string; code?: string };
        const error = new Error(payload.error ?? "Failed to delete campaign") as Error & {
          code?: string;
        };
        error.code = payload.code;
        throw error;
      }
      return id;
    },
    onSuccess: async (deletedId) => {
      toast.success("Campaign deleted");
      setPendingDelete(null);
      queryClient.setQueryData<Campaign[]>(["campaigns"], (current) =>
        (current ?? []).filter((campaign) => campaign.id !== deletedId),
      );
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: async (error) => {
      const pendingId = pendingDelete?.id;
      const code =
        error instanceof Error && "code" in error
          ? (error as Error & { code?: string }).code
          : undefined;

      if (pendingId && code === "CAMPAIGN_NOT_FOUND") {
        queryClient.setQueryData<Campaign[]>(["campaigns"], (current) =>
          (current ?? []).filter((campaign) => campaign.id !== pendingId),
        );
        setPendingDelete(null);
        await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        toast.success("Campaign removed");
        return;
      }

      toast.error(error instanceof Error ? error.message : "Delete failed");
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
          <div className="surface-panel max-w-xl px-10 py-12 text-center">
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
            <div className="section-title">Campaign Workspace</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">No campaigns yet</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Upload your vendor inventory first, then create your first campaign.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => router.push("/inventory")}>
                Upload Inventory
              </Button>
              {hasVendors ? (
                <Button onClick={() => router.push("/campaigns/new")}>New Campaign</Button>
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
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="section-title">Operations</div>
            <h1 className="page-title">Campaigns</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Track live scoring jobs, reopen shortlist decisions, and export finished campaigns.
            </p>
          </div>
          {hasVendors ? (
            <Button onClick={() => router.push("/campaigns/new")}>New Campaign</Button>
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

        <div className="surface-panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.7))]">
              <tr className="table-header text-left">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Niche</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Selected / Goal</th>
                <th className="px-4 py-3 font-medium">Budget</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="transition-colors hover:bg-white/72">
                  <td className="px-4 py-4 font-semibold">
                    <Link href={`/campaigns/${campaign.id}`} className="hover:text-primary hover:underline">
                      {campaign.client_name}
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{campaign.client_niche}</td>
                  <td className="px-4 py-4 text-muted-foreground">{formatDate(campaign.created_at)}</td>
                  <td className="px-4 py-4">
                    {campaign.included_count} / {campaign.link_count_goal}
                  </td>
                  <td className="px-4 py-4 font-medium">${campaign.budget_per_link}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={campaign.status} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => router.push(`/campaigns/${campaign.id}`)}>
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl"
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

        <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
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
                onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
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
