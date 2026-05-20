import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  Download,
  Filter,
  Info,
  Search,
} from "lucide-react";
import {
  getCampaign,
  getCampaignResults,
  getCampaignStatus,
  resetCampaign,
  toggleResultIncluded,
} from "@/lib/campaigns.functions";
import { runScoringBatch } from "@/lib/scoring.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authed/campaigns/$id")({
  component: CampaignDetailPage,
});

function formatTraffic(value: number | null) {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateLong(value: string | null | undefined) {
  if (!value) return "—";
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

function CampaignDetailPage() {
  const { id } = Route.useParams();
  const getCampaignFn = useServerFn(getCampaign);
  const getResultsFn = useServerFn(getCampaignResults);
  const getStatusFn = useServerFn(getCampaignStatus);
  const scoreFn = useServerFn(runScoringBatch);
  const toggleFn = useServerFn(toggleResultIncluded);
  const resetFn = useServerFn(resetCampaign);
  const qc = useQueryClient();

  const { data: campaign } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => getCampaignFn({ data: { id } }),
  });

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["campaign-status", id],
    queryFn: () => getStatusFn({ data: { id } }),
    refetchInterval: (query) => (query.state.data?.status === "scoring" ? 2000 : false),
  });

  const isScoring = status?.status === "scoring";

  const { data: results } = useQuery({
    queryKey: ["campaign-results", id],
    queryFn: () => getResultsFn({ data: { id } }),
    enabled: !isScoring,
  });

  const [scoringInFlight, setScoringInFlight] = useState(false);
  useEffect(() => {
    if (!isScoring || scoringInFlight) return;
    setScoringInFlight(true);
    scoreFn({ data: { campaign_id: id } })
      .then((result) => {
        void refetchStatus();
        if (result.done) {
          void qc.invalidateQueries({ queryKey: ["campaign-results", id] });
          void qc.invalidateQueries({ queryKey: ["campaign", id] });
          void qc.invalidateQueries({ queryKey: ["campaigns"] });
        }
      })
      .catch((error) => console.error(error))
      .finally(() => setScoringInFlight(false));
  }, [id, isScoring, qc, refetchStatus, scoreFn, scoringInFlight]);

  const toggleMutation = useMutation({
    mutationFn: (payload: { result_id: string; included: boolean }) =>
      toggleFn({ data: { campaign_id: id, ...payload } }),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ["campaign-results", id] });
      const previous = qc.getQueryData<any[]>(["campaign-results", id]);
      qc.setQueryData<any[]>(["campaign-results", id], (old) =>
        (old ?? []).map((row) =>
          row.id === payload.result_id ? { ...row, included: payload.included } : row,
        ),
      );
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) qc.setQueryData(["campaign-results", id], context.previous);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["campaigns"] });
      void qc.invalidateQueries({ queryKey: ["campaign", id] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetFn({ data: { id } }),
    onSuccess: async () => {
      await refetchStatus();
      await qc.invalidateQueries({ queryKey: ["campaign-results", id] });
    },
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
    () => ["All", ...Array.from(new Set(scored.map((row) => row.geo).filter(Boolean))).sort()],
    [scored],
  );
  const linkTypeOptions = useMemo(
    () => ["All", ...Array.from(new Set(scored.map((row) => row.link_type).filter(Boolean))).sort()],
    [scored],
  );
  const rankingOptions = useMemo(
    () => ["All", ...Array.from(new Set(scored.map((row) => row.ranking).filter(Boolean))).sort()],
    [scored],
  );

  const shortlist = useMemo(() => {
    const minimumScore = minScore.trim() === "" ? null : Number(minScore);

    return scored
      .filter((row) => (row.rank_position ?? Infinity) <= shortlistSize)
      .filter((row) => (search.trim() ? row.domain.toLowerCase().includes(search.toLowerCase()) : true))
      .filter((row) => (minimumScore != null && !Number.isNaN(minimumScore) ? Number(row.score ?? 0) >= minimumScore : true))
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

  if (!campaign) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  const configMeta = campaign.scoring_config_meta as
    | { version: number; label: string | null; weights: Record<string, number> }
    | null;
  const inventoryStatus = campaign.inventory_status as
    | { count: number; uploaded_at: string | null }
    | undefined;

  return (
    <div>
      <div className="sticky top-0 z-10 border-b bg-background">
        <div className="flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/campaigns"
              className="flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Campaigns
            </Link>
            <div className="min-w-0 text-sm">
              <div className="truncate font-semibold">{campaign.client_name}</div>
              <div className="truncate text-muted-foreground">{campaign.client_niche}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1"
              title={configMeta ? JSON.stringify(configMeta.weights, null, 2) : "No config metadata"}
            >
              <Info className="h-3.5 w-3.5" />
              {configMeta ? `Config v${configMeta.version} — ${configMeta.label ?? "Untitled"}` : "Config —"}
            </div>
            <div
              className="inline-flex rounded-full border px-3 py-1"
              title={inventoryStatus?.uploaded_at ? formatDateLong(inventoryStatus.uploaded_at) : "No upload date"}
            >
              Inventory: {inventoryStatus?.count ?? 0} domains, uploaded {formatDate(inventoryStatus?.uploaded_at)}
            </div>
            <a
              href={`/api/export/${id}`}
              download
              className={`inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 ${
                isScoring ? "pointer-events-none opacity-40" : ""
              }`}
            >
              <Download className="h-4 w-4" />
              Export Campaign
            </a>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 bg-sidebar px-6 py-3 text-sm text-sidebar-foreground">
          <div>
            <span className="text-sidebar-foreground/60">Links Selected:</span> <strong>{linksSelected}</strong>
          </div>
          <div>
            <span className="text-sidebar-foreground/60">Total Spent:</span> <strong>${totalSpent.toFixed(0)}</strong>
          </div>
          <div>
            <span className="text-sidebar-foreground/60">Budget Remaining:</span>{" "}
            <strong>${budgetRemaining.toFixed(0)}</strong>
          </div>
          <div>
            <span className="text-sidebar-foreground/60">Avg DR:</span> <strong>{avgDr.toFixed(1)}</strong>
          </div>
        </div>
      </div>

      {interrupted && (
        <div className="m-6 flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Scoring was interrupted.
          </span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void refetchStatus()}>
              Resume Scoring
            </Button>
            <Button size="sm" variant="outline" onClick={() => resetMutation.mutate()}>
              Discard & Start Over
            </Button>
          </div>
        </div>
      )}

      {isScoring && !interrupted && (
        <div className="m-6 rounded-md border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>
              ⏳ Scoring in progress — {status?.scored ?? 0} of {status?.total ?? 0} domains processed…
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${status && status.total > 0 ? Math.round((status.scored / status.total) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {!isScoring && results && (
        <div className="p-6">
          <div className="mb-4 flex items-center gap-2 border-b">
            <button
              onClick={() => setTab("shortlist")}
              className={`px-3 py-2 text-sm ${tab === "shortlist" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
            >
              Shortlist
            </button>
            <button
              onClick={() => setTab("disqualified")}
              className={`px-3 py-2 text-sm ${tab === "disqualified" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
            >
              Disqualified ({disqualified.length})
            </button>
          </div>

          {tab === "shortlist" && (
            <>
              <div className="mb-4 grid grid-cols-[minmax(220px,1fr)_120px_120px_120px_120px_auto] items-center gap-2">
                <div className="relative">
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
                />
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
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
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={linkTypeFilter}
                  onChange={(event) => setLinkTypeFilter(event.target.value)}
                >
                  {linkTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      Link: {option}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={rankingFilter}
                  onChange={(event) => setRankingFilter(event.target.value)}
                >
                  {rankingOptions.map((option) => (
                    <option key={option} value={option}>
                      Ranking: {option}
                    </option>
                  ))}
                </select>
                <div className="ml-auto inline-flex overflow-hidden rounded-md border">
                  {[25, 50, 100].map((size) => (
                    <button
                      key={size}
                      onClick={() => setShortlistSize(size as 25 | 50 | 100)}
                      className={`px-3 py-1.5 text-xs ${shortlistSize === size ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                Showing {shortlist.length} shortlisted domains after filters
              </div>

              <div className="overflow-hidden rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
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
                  <tbody className="divide-y">
                    {shortlist.map((row) => {
                      const isExpanded = !!expanded[row.id];
                      const breakdown = (row.score_breakdown ?? {}) as Record<string, number>;
                      const weights = configMeta?.weights ?? {};
                      return (
                        <Fragment key={row.id}>
                          <tr key={row.id} className={row.included ? "" : "bg-rose-50"}>
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
                              <div>{Number(row.score ?? 0).toFixed(0)}/100</div>
                              <div className="mt-1 h-1.5 w-16 rounded bg-muted">
                                <div
                                  className="h-full rounded bg-primary"
                                  style={{ width: `${Number(row.score ?? 0)}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <button
                                onClick={() =>
                                  setExpanded((current) => ({
                                    ...current,
                                    [row.id]: !current[row.id],
                                  }))
                                }
                                className="text-xs text-primary hover:underline"
                              >
                                {isExpanded ? "▼" : "▶"} Details
                              </button>
                            </td>
                            <td className="max-w-[280px] truncate px-3 py-2 text-muted-foreground" title={row.reasoning ?? ""}>
                              {row.reasoning}
                            </td>
                            <td className="px-3 py-2">{row.dr}</td>
                            <td className="px-3 py-2">{formatTraffic(row.traffic)}</td>
                            <td className="px-3 py-2">{row.geo}</td>
                            <td className="px-3 py-2">${row.price}</td>
                            <td className="px-3 py-2">{row.tat ? `${row.tat}d` : "—"}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex rounded px-2 py-0.5 text-xs ${
                                  (row.link_type ?? "").toLowerCase() === "dofollow"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {row.link_type}
                              </span>
                            </td>
                            <td className="max-w-[160px] truncate px-3 py-2 text-xs text-muted-foreground" title={row.contact_email ?? ""}>
                              {row.contact_email}
                            </td>
                            <td className="px-3 py-2">
                              {row.red_flags ? <span title={row.red_flags}>⚠</span> : null}
                            </td>
                            <td className="px-3 py-2">
                              <Switch
                                checked={!!row.included}
                                onCheckedChange={(value) =>
                                  toggleMutation.mutate({ result_id: row.id, included: value })
                                }
                              />
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-muted/30">
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
                                    <div key={key} className="grid grid-cols-[140px_1fr_56px] items-center gap-3">
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
              <div className="mb-3 text-sm font-medium">
                {disqualified.length} domains disqualified
              </div>
              <div className="overflow-hidden rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
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
  );
}
