"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, Download, Filter, Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetchJson } from "@/lib/client-fetch";
import { toast } from "sonner";

type CampaignData = {
  id: string;
  client_name: string;
  client_niche: string;
  budget_per_link: number;
  link_count_goal: number;
  shortlist_size: number;
  status: string;
  scoring_config_meta:
    | { version: number; label: string | null; weights: Record<string, number> }
    | null;
  inventory_status: { count: number; uploaded_at: string | null };
};

type CampaignStatus = { status: string; scored: number; total: number };

type CampaignResult = {
  id: string;
  domain: string;
  score: number | null;
  score_breakdown: Record<string, number> | null;
  reasoning: string | null;
  dr: number | null;
  traffic: number | null;
  geo: string | null;
  price: number | null;
  tat: number | null;
  link_type: string | null;
  ranking: string | null;
  red_flags: string | null;
  contact_email: string | null;
  included: boolean | null;
  disqualified: boolean | null;
  disqualify_reason: string | null;
  rank_position: number | null;
};

function formatTraffic(value: number | null) {
  if (value == null) return "-";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateLong(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreBarWidth(value: number, max: number) {
  if (max <= 0) return "0%";
  return `${Math.min(100, Math.round((value / max) * 100))}%`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { className: string; label: string }> = {
    scoring: { className: "bg-amber-100 text-amber-800", label: "Scoring..." },
    in_progress: { className: "bg-blue-100 text-blue-800", label: "In Progress" },
    exported: { className: "bg-green-100 text-green-800", label: "Exported" },
    error: { className: "bg-rose-100 text-rose-800", label: "Error" },
  };

  const resolved = map[status] ?? {
    className: "bg-slate-100 text-slate-700",
    label: status,
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${resolved.className}`}
    >
      {resolved.label}
    </span>
  );
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();

  const { data: campaign } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => fetchJson<CampaignData>(`/api/campaigns/${id}`),
    enabled: !!id,
  });

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["campaign-status", id],
    queryFn: () => fetchJson<CampaignStatus>(`/api/campaigns/${id}/status`),
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.status === "scoring" ? 2000 : false),
  });

  const isScoring = status?.status === "scoring";

  const { data: results } = useQuery({
    queryKey: ["campaign-results", id],
    queryFn: () => fetchJson<CampaignResult[]>(`/api/campaigns/${id}/results`),
    enabled: !!id && !isScoring,
  });

  const [scoringInFlight, setScoringInFlight] = useState(false);

  useEffect(() => {
    if (!id || !isScoring || scoringInFlight) return;

    setScoringInFlight(true);
    fetch(`/api/campaigns/${id}/score`, { method: "POST" })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload.error ?? "Scoring failed");
        }
        await refetchStatus();
        await queryClient.invalidateQueries({ queryKey: ["campaign-results", id] });
        await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      })
      .catch((error) => {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Scoring failed");
      })
      .finally(() => setScoringInFlight(false));
  }, [id, isScoring, queryClient, refetchStatus, scoringInFlight]);

  const toggleMutation = useMutation({
    mutationFn: async (payload: { resultId: string; included: boolean }) => {
      const response = await fetch(`/api/campaigns/${id}/results/${payload.resultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ included: payload.included }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to update result");
      return data;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["campaign-results", id] });
      const previous = queryClient.getQueryData<CampaignResult[]>(["campaign-results", id]);
      queryClient.setQueryData<CampaignResult[]>(["campaign-results", id], (old) =>
        (old ?? []).map((row) =>
          row.id === payload.resultId ? { ...row, included: payload.included } : row,
        ),
      );
      return { previous };
    },
    onError: (error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["campaign-results", id], context.previous);
      }
      toast.error(error instanceof Error ? error.message : "Update failed");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      await queryClient.invalidateQueries({ queryKey: ["campaign", id] });
    },
  });

  const restartMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/campaigns/${id}/restart`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to restart campaign");
      return data;
    },
    onSuccess: async () => {
      await refetchStatus();
      await queryClient.invalidateQueries({ queryKey: ["campaign-results", id] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Restart failed"),
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/campaigns/${id}/score`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to resume scoring");
      return data;
    },
    onSuccess: async () => {
      await refetchStatus();
      await queryClient.invalidateQueries({ queryKey: ["campaign-results", id] });
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Resume failed"),
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/campaigns/${id}/export`, { method: "POST" });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Export failed");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] ?? "campaign.xlsx";
      return { blob, filename };
    },
    onSuccess: async ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Campaign exported");
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      await queryClient.invalidateQueries({ queryKey: ["campaign", id] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Export failed"),
  });

  const [tab, setTab] = useState<"shortlist" | "disqualified">("shortlist");
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState("");
  const [geoFilter, setGeoFilter] = useState("All");
  const [linkTypeFilter, setLinkTypeFilter] = useState("All");
  const [rankingFilter, setRankingFilter] = useState("All");
  const [shortlistSize, setShortlistSize] = useState<25 | 50 | 100>(50);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (campaign?.shortlist_size) {
      setShortlistSize(campaign.shortlist_size as 25 | 50 | 100);
    }
  }, [campaign]);

  const scored = (results ?? []).filter((row) => !row.disqualified);
  const disqualified = (results ?? []).filter((row) => row.disqualified);

  const geoOptions = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(scored.map((row) => row.geo).filter((value): value is string => Boolean(value))),
      ).sort(),
    ],
    [scored],
  );

  const linkTypeOptions = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          scored.map((row) => row.link_type).filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    ],
    [scored],
  );

  const rankingOptions = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(scored.map((row) => row.ranking).filter((value): value is string => Boolean(value))),
      ).sort(),
    ],
    [scored],
  );

  const shortlist = useMemo(() => {
    const minimumScore = minScore.trim() === "" ? null : Number(minScore);
    return scored
      .filter((row) => (row.rank_position ?? Number.POSITIVE_INFINITY) <= shortlistSize)
      .filter((row) =>
        search.trim() ? row.domain.toLowerCase().includes(search.toLowerCase()) : true,
      )
      .filter((row) =>
        minimumScore != null && !Number.isNaN(minimumScore)
          ? Number(row.score ?? 0) >= minimumScore
          : true,
      )
      .filter((row) => (geoFilter !== "All" ? row.geo === geoFilter : true))
      .filter((row) => (linkTypeFilter !== "All" ? row.link_type === linkTypeFilter : true))
      .filter((row) => (rankingFilter !== "All" ? row.ranking === rankingFilter : true));
  }, [geoFilter, linkTypeFilter, minScore, rankingFilter, scored, search, shortlistSize]);

  const includedRows = scored.filter((row) => row.included);
  const linksSelected = includedRows.length;
  const totalSpent = includedRows.reduce((sum, row) => sum + Number(row.price ?? 0), 0);
  const budgetRemaining =
    (campaign?.link_count_goal ?? 0) * Number(campaign?.budget_per_link ?? 0) - totalSpent;
  const avgDr =
    includedRows.length === 0
      ? 0
      : includedRows.reduce((sum, row) => sum + Number(row.dr ?? 0), 0) / includedRows.length;

  const interrupted = isScoring && (status?.scored ?? 0) === 0 && !scoringInFlight;

  if (!campaign) return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;

  const configMeta = campaign.scoring_config_meta;
  const inventoryStatus = campaign.inventory_status;
  const resolvedStatus = status?.status ?? campaign.status;

  return (
    <TooltipProvider>
      <div className="min-w-0 overflow-x-hidden">
        <div className="sticky top-0 z-10 border-b border-white/60 bg-background/88 backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-4 overflow-x-hidden px-6 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/campaigns"
                className="flex items-center text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
                Campaigns
              </Link>
              <div className="min-w-0 text-sm">
                <div className="section-title mb-1">Campaign Workspace</div>
                <div className="flex items-center gap-2">
                  <div className="truncate font-semibold">{campaign.client_name}</div>
                  <StatusBadge status={resolvedStatus} />
                </div>
                <div className="truncate text-muted-foreground">{campaign.client_niche}</div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 text-xs">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="glass-pill inline-flex items-center gap-1 px-3 py-1.5">
                    <Info className="h-3.5 w-3.5" />
                    {configMeta
                      ? `Config v${configMeta.version} - ${configMeta.label ?? "Untitled"}`
                      : "Config -"}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <pre className="max-w-sm whitespace-pre-wrap text-[11px]">
                    {configMeta ? JSON.stringify(configMeta.weights, null, 2) : "No config metadata"}
                  </pre>
                </TooltipContent>
              </Tooltip>

              <div
                className="glass-pill inline-flex px-3 py-1.5"
                title={formatDateLong(inventoryStatus?.uploaded_at)}
              >
                Inventory: {inventoryStatus?.count ?? 0} domains, uploaded{" "}
                {formatDate(inventoryStatus?.uploaded_at)}
              </div>

              <Button
                onClick={() => exportMutation.mutate()}
                disabled={isScoring || exportMutation.isPending}
                className="h-11 rounded-2xl px-5 shadow-[0_14px_28px_rgba(79,70,229,0.28)]"
              >
                <Download className="h-4 w-4" />
                Export Campaign
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 overflow-x-auto bg-[linear-gradient(135deg,rgba(15,23,42,1),rgba(30,41,59,0.98))] px-6 py-4 text-sm text-sidebar-foreground premium-scrollbar">
            <div className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <span className="text-sidebar-foreground/60">Links Selected:</span>
              <strong className="ml-1">{linksSelected}</strong>
            </div>
            <div className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <span className="text-sidebar-foreground/60">Total Spent:</span>
              <strong className="ml-1">${totalSpent.toFixed(0)}</strong>
            </div>
            <div className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <span className="text-sidebar-foreground/60">Budget Remaining:</span>
              <strong className="ml-1">${budgetRemaining.toFixed(0)}</strong>
            </div>
            <div className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.05))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <span className="text-sidebar-foreground/60">Avg DR:</span>
              <strong className="ml-1">{avgDr.toFixed(1)}</strong>
            </div>
          </div>
        </div>

        {resolvedStatus === "error" && (
          <div className="m-6 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            Scoring failed. Check the server logs.
          </div>
        )}

        {interrupted && (
          <div className="m-6 flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Scoring was interrupted.
            </span>
            <div className="flex gap-2">
              <Button size="sm" disabled={resumeMutation.isPending} onClick={() => resumeMutation.mutate()}>
                Resume Scoring
              </Button>
              <Button size="sm" variant="outline" onClick={() => restartMutation.mutate()}>
                Discard and Start Over
              </Button>
            </div>
          </div>
        )}

        {isScoring && !interrupted && (
          <div className="surface-panel m-6 p-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>
                Scoring in progress - {status?.scored ?? 0} of {status?.total ?? 0} domains processed...
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${
                    status && status.total > 0 ? Math.round((status.scored / status.total) * 100) : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {!isScoring && results && (
          <div className="min-w-0 overflow-x-hidden p-6">
            <div className="mb-4 flex items-center gap-2 border-b">
              <button
                onClick={() => setTab("shortlist")}
                className={`px-3 py-2 text-sm ${
                  tab === "shortlist" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"
                }`}
              >
                Shortlist
              </button>
              <button
                onClick={() => setTab("disqualified")}
                className={`px-3 py-2 text-sm ${
                  tab === "disqualified"
                    ? "border-b-2 border-primary font-medium"
                    : "text-muted-foreground"
                }`}
              >
                Disqualified ({disqualified.length})
              </button>
            </div>

            {tab === "shortlist" && (
              <>
                <div className="mb-4 overflow-x-auto premium-scrollbar">
                  <div className="flex min-w-[1120px] items-center gap-2">
                    <div className="relative min-w-[320px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search domains..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Input
                      placeholder="Min Score"
                      value={minScore}
                      onChange={(event) => setMinScore(event.target.value)}
                      type="number"
                      min={0}
                      max={100}
                      className="w-[140px]"
                    />
                    <select
                      className="h-10 w-[150px] rounded-md border bg-background px-3 text-sm"
                      value={geoFilter}
                      onChange={(event) => setGeoFilter(event.target.value)}
                    >
                      {geoOptions.map((option) => (
                        <option key={option} value={option}>
                          Geo: {option}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-10 w-[170px] rounded-md border bg-background px-3 text-sm"
                      value={linkTypeFilter}
                      onChange={(event) => setLinkTypeFilter(event.target.value)}
                    >
                      {linkTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          Link Type: {option}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-10 w-[150px] rounded-md border bg-background px-3 text-sm"
                      value={rankingFilter}
                      onChange={(event) => setRankingFilter(event.target.value)}
                    >
                      {rankingOptions.map((option) => (
                        <option key={option} value={option}>
                          Ranking: {option}
                        </option>
                      ))}
                    </select>
                    <div className="ml-auto inline-flex overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm">
                      {[25, 50, 100].map((size) => (
                        <button
                          key={size}
                          onClick={() => setShortlistSize(size as 25 | 50 | 100)}
                          className={`px-3 py-1.5 text-xs ${
                            shortlistSize === size
                              ? "bg-primary text-primary-foreground"
                              : "bg-background hover:bg-accent"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" />
                  Showing {shortlist.length} shortlisted domains after filters
                </div>

                <div className="surface-panel overflow-x-auto overflow-y-hidden premium-scrollbar">
                  <table className="min-w-[1500px] w-full text-sm">
                    <thead className="bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.76))] table-header">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Domain</th>
                        <th className="px-3 py-2 text-left">Score</th>
                        <th className="px-3 py-2 text-left">Breakdown</th>
                        <th className="px-3 py-2 text-left">Reasoning</th>
                        <th className="px-3 py-2 text-left">DR</th>
                        <th className="px-3 py-2 text-left">Traffic</th>
                        <th className="px-3 py-2 text-left">Geo</th>
                        <th className="px-3 py-2 text-left">Price</th>
                        <th className="px-3 py-2 text-left">TAT</th>
                        <th className="px-3 py-2 text-left">Link Type</th>
                        <th className="px-3 py-2 text-left">Contact</th>
                        <th className="px-3 py-2 text-left">Red Flags</th>
                        <th className="px-3 py-2 text-left">Include</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/65">
                      {shortlist.map((row) => {
                        const isExpanded = !!expanded[row.id];
                        const breakdown = row.score_breakdown ?? {};
                        const weights = configMeta?.weights ?? {};

                        return (
                          <Fragment key={row.id}>
                            <tr className={`transition-colors hover:bg-white/72 ${row.included ? "" : "bg-rose-50/80"}`}>
                              <td className="px-3 py-2 text-muted-foreground">{row.rank_position}</td>
                              <td className="px-3 py-2 font-semibold">
                                <a
                                  href={`https://${row.domain}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`hover:underline ${row.included ? "" : "line-through"}`}
                                >
                                  {row.domain}
                                </a>
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium">{Number(row.score ?? 0).toFixed(0)}/100</div>
                                <div className="mt-1.5 h-1.5 w-20 rounded-full bg-slate-200">
                                  <div
                                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(99,102,241,1),rgba(129,140,248,0.9))]"
                                    style={{ width: `${Number(row.score ?? 0)}%` }}
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() =>
                                    setExpanded((current) => ({ ...current, [row.id]: !current[row.id] }))
                                  }
                                  className="text-xs font-medium text-primary hover:underline"
                                >
                                  {isExpanded ? "v" : ">"} Details
                                </button>
                              </td>
                              <td className="max-w-[280px] truncate px-3 py-2 text-muted-foreground">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-default">{row.reasoning}</span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs text-xs">
                                    {row.reasoning ?? "No reasoning available."}
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                              <td className="px-3 py-2">{row.dr}</td>
                              <td className="px-3 py-2">{formatTraffic(row.traffic)}</td>
                              <td className="px-3 py-2">{row.geo}</td>
                              <td className="px-3 py-2">${row.price}</td>
                              <td className="px-3 py-2">{row.tat ? `${row.tat}d` : "-"}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                    (row.link_type ?? "").toLowerCase() === "dofollow"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {row.link_type}
                                </span>
                              </td>
                              <td className="max-w-[160px] truncate px-3 py-2 text-xs text-muted-foreground">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-default">{row.contact_email}</span>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">
                                    {row.contact_email ?? "No contact email"}
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                              <td className="px-3 py-2">
                                {row.red_flags ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help font-semibold text-amber-700">!</span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs text-xs">
                                      {row.red_flags}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : null}
                              </td>
                              <td className="px-3 py-2">
                                <Switch
                                  checked={!!row.included}
                                  onCheckedChange={(value) =>
                                    toggleMutation.mutate({ resultId: row.id, included: value })
                                  }
                                />
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="bg-slate-50/78">
                                <td colSpan={14} className="px-4 py-4">
                                  <div className="space-y-2 text-xs">
                                    {[
                                      ["niche_match", "Niche Match"],
                                      ["domain_rating", "Domain Rating"],
                                      ["traffic", "Traffic"],
                                      ["price_efficiency", "Price"],
                                      ["ranking_bonus", "Ranking Bonus"],
                                      ["geo_match", "Geo Match"],
                                      ["no_red_flags", "No Red Flags"],
                                    ].map(([key, label]) => (
                                      <div
                                        key={key}
                                        className="grid grid-cols-[140px_1fr_56px] items-center gap-3"
                                      >
                                        <span className="text-muted-foreground">{label}</span>
                                        <div className="h-2 overflow-hidden rounded bg-muted">
                                          <div
                                            className="h-full rounded bg-primary"
                                            style={{
                                              width: scoreBarWidth(
                                                Number(breakdown[key] ?? 0),
                                                Number(weights[key] ?? 0),
                                              ),
                                            }}
                                          />
                                        </div>
                                        <span className="font-mono">
                                          {Number(breakdown[key] ?? 0)}/{Number(weights[key] ?? 0)}
                                        </span>
                                      </div>
                                    ))}
                                    <div className="border-t pt-2 text-right font-semibold">
                                      Total {Number(row.score ?? 0).toFixed(0)}/100
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab === "disqualified" && (
              <>
                <div className="mb-3 text-sm font-medium">{disqualified.length} domains disqualified</div>
                <div className="surface-panel overflow-x-auto overflow-y-hidden premium-scrollbar">
                  <table className="min-w-[1100px] w-full text-sm">
                    <thead className="bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.76))] table-header">
                      <tr>
                        <th className="px-3 py-2 text-left">Domain</th>
                        <th className="px-3 py-2 text-left">DR</th>
                        <th className="px-3 py-2 text-left">Traffic</th>
                        <th className="px-3 py-2 text-left">Link Type</th>
                        <th className="px-3 py-2 text-left">Ranking</th>
                        <th className="px-3 py-2 text-left">Red Flags</th>
                        <th className="px-3 py-2 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[...disqualified]
                        .sort((a, b) => a.domain.localeCompare(b.domain))
                        .map((row) => (
                          <tr key={row.id}>
                            <td className="px-3 py-2">{row.domain}</td>
                            <td className="px-3 py-2">{row.dr}</td>
                            <td className="px-3 py-2">{formatTraffic(row.traffic)}</td>
                            <td className="px-3 py-2">{row.link_type}</td>
                            <td className="px-3 py-2">{row.ranking}</td>
                            <td className="px-3 py-2">{row.red_flags}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.disqualify_reason}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
