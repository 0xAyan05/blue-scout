import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  getCampaign,
  getCampaignResults,
  getCampaignStatus,
  toggleResultIncluded,
  resetCampaign,
} from "@/lib/campaigns.functions";
import { runScoringBatch } from "@/lib/scoring.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Download, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authed/campaigns/$id")({
  component: CampaignDetailPage,
});

function formatTraffic(n: number | null) {
  if (n == null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function CampaignDetailPage() {
  const { id } = Route.useParams();
  const getC = useServerFn(getCampaign);
  const getR = useServerFn(getCampaignResults);
  const getS = useServerFn(getCampaignStatus);
  const score = useServerFn(runScoringBatch);
  const toggle = useServerFn(toggleResultIncluded);
  const reset = useServerFn(resetCampaign);
  const qc = useQueryClient();

  const { data: campaign } = useQuery({ queryKey: ["campaign", id], queryFn: () => getC({ data: { id } }) });
  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["campaign-status", id],
    queryFn: () => getS({ data: { id } }),
    refetchInterval: (q) => (q.state.data?.status === "scoring" ? 2000 : false),
  });
  const isScoring = status?.status === "scoring";
  const { data: results } = useQuery({
    queryKey: ["campaign-results", id],
    queryFn: () => getR({ data: { id } }),
    enabled: !isScoring,
  });

  // Drive scoring batches forward while status is "scoring"
  const [scoringInFlight, setScoringInFlight] = useState(false);
  useEffect(() => {
    if (!isScoring || scoringInFlight) return;
    setScoringInFlight(true);
    score({ data: { campaign_id: id } })
      .then((r) => {
        refetchStatus();
        if (r.done) {
          qc.invalidateQueries({ queryKey: ["campaign-results", id] });
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setScoringInFlight(false));
  }, [isScoring, scoringInFlight, id, score, refetchStatus, qc]);

  const toggleMut = useMutation({
    mutationFn: (v: { result_id: string; included: boolean }) =>
      toggle({ data: { campaign_id: id, ...v } }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["campaign-results", id] });
      const prev = qc.getQueryData<any[]>(["campaign-results", id]);
      qc.setQueryData<any[]>(["campaign-results", id], (old) =>
        (old ?? []).map((r) => (r.id === v.result_id ? { ...r, included: v.included } : r)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["campaign-results", id], ctx.prev);
    },
  });

  const resetMut = useMutation({
    mutationFn: () => reset({ data: { id } }),
    onSuccess: () => refetchStatus(),
  });

  const [tab, setTab] = useState<"shortlist" | "disqualified">("shortlist");
  const [search, setSearch] = useState("");
  const [shortlistSize, setShortlistSize] = useState<25 | 50 | 100>(50);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (campaign) setShortlistSize(campaign.shortlist_size as 25 | 50 | 100);
  }, [campaign]);

  const scored = (results ?? []).filter((r) => !r.disqualified);
  const disqualified = (results ?? []).filter((r) => r.disqualified);

  const shortlist = useMemo(() => {
    const slice = scored.filter((r) => (r.rank_position ?? Infinity) <= shortlistSize);
    if (!search.trim()) return slice;
    const s = search.toLowerCase();
    return slice.filter((r) => r.domain.toLowerCase().includes(s));
  }, [scored, shortlistSize, search]);

  // Stats: based on included rows within current shortlist size
  const includedRows = scored.filter(
    (r) => r.included && (r.rank_position ?? Infinity) <= shortlistSize,
  );
  const linksSelected = includedRows.length;
  const totalSpent = includedRows.reduce((acc, r) => acc + Number(r.price ?? 0), 0);
  const budgetRemaining =
    (campaign?.link_count_goal ?? 0) * Number(campaign?.budget_per_link ?? 0) - totalSpent;
  const avgDr =
    includedRows.length === 0
      ? 0
      : includedRows.reduce((acc, r) => acc + (r.dr ?? 0), 0) / includedRows.length;

  const interrupted = isScoring && (status?.scored ?? 0) === 0 && !scoringInFlight;

  if (!campaign) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div>
      <div className="sticky top-0 z-10 border-b bg-background">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link to="/campaigns" className="flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> Campaigns
            </Link>
            <div className="text-sm">
              <span className="font-semibold">{campaign.client_name}</span>
              <span className="text-muted-foreground"> — {campaign.client_niche}</span>
            </div>
          </div>
          <a
            href={`/api/export/${id}`}
            download
            className={`inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 ${
              isScoring ? "pointer-events-none opacity-40" : ""
            }`}
          >
            <Download className="h-4 w-4" /> Export Campaign
          </a>
        </div>
        <div className="grid grid-cols-4 gap-6 bg-sidebar px-6 py-3 text-sm text-sidebar-foreground">
          <div><span className="text-sidebar-foreground/60">Links Selected:</span> <strong>{linksSelected}</strong></div>
          <div><span className="text-sidebar-foreground/60">Total Spent:</span> <strong>${totalSpent.toFixed(0)}</strong></div>
          <div><span className="text-sidebar-foreground/60">Budget Remaining:</span> <strong>${budgetRemaining.toFixed(0)}</strong></div>
          <div><span className="text-sidebar-foreground/60">Avg DR:</span> <strong>{avgDr.toFixed(1)}</strong></div>
        </div>
      </div>

      {interrupted && (
        <div className="m-6 flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Scoring was interrupted.</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { setScoringInFlight(false); refetchStatus(); }}>Resume Scoring</Button>
            <Button size="sm" variant="outline" onClick={() => resetMut.mutate()}>Discard & Start Over</Button>
          </div>
        </div>
      )}

      {isScoring && !interrupted && (
        <div className="m-6 rounded-md border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>⏳ Scoring in progress — {status?.scored ?? 0} of {status?.total ?? 0} domains processed…</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${status && status.total > 0 ? Math.round((status.scored / status.total) * 100) : 0}%` }} />
          </div>
        </div>
      )}

      {!isScoring && results && (
        <div className="p-6">
          <div className="mb-4 flex items-center gap-2 border-b">
            <button onClick={() => setTab("shortlist")} className={`px-3 py-2 text-sm ${tab === "shortlist" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}>
              Shortlist ({scored.length})
            </button>
            <button onClick={() => setTab("disqualified")} className={`px-3 py-2 text-sm ${tab === "disqualified" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}>
              Disqualified ({disqualified.length})
            </button>
          </div>

          {tab === "shortlist" && (
            <>
              <div className="mb-4 flex items-center gap-2">
                <Input placeholder="Search domains…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
                <div className="ml-auto inline-flex overflow-hidden rounded-md border">
                  {[25, 50, 100].map((n) => (
                    <button key={n} onClick={() => setShortlistSize(n as 25 | 50 | 100)} className={`px-3 py-1.5 text-xs ${shortlistSize === n ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Domain</th>
                      <th className="px-3 py-2 text-left">Score</th>
                      <th className="px-3 py-2"></th>
                      <th className="px-3 py-2 text-left">Reasoning</th>
                      <th className="px-3 py-2 text-left">DR</th>
                      <th className="px-3 py-2 text-left">Traffic</th>
                      <th className="px-3 py-2 text-left">Geo</th>
                      <th className="px-3 py-2 text-left">Price</th>
                      <th className="px-3 py-2 text-left">TAT</th>
                      <th className="px-3 py-2 text-left">Link</th>
                      <th className="px-3 py-2 text-left">Contact</th>
                      <th className="px-3 py-2 text-left">⚠</th>
                      <th className="px-3 py-2 text-left">Include</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {shortlist.map((r) => {
                      const exp = expanded[r.id];
                      const bd = (r.score_breakdown ?? {}) as Record<string, number>;
                      return (
                        <>
                          <tr key={r.id} className={!r.included ? "bg-rose-50" : ""}>
                            <td className="px-3 py-2 text-muted-foreground">{r.rank_position}</td>
                            <td className="px-3 py-2 font-semibold">
                              <a href={`https://${r.domain}`} target="_blank" rel="noreferrer" className={`hover:underline ${!r.included ? "line-through" : ""}`}>{r.domain}</a>
                            </td>
                            <td className="px-3 py-2">
                              <div>{Number(r.score ?? 0).toFixed(0)}</div>
                              <div className="mt-1 h-1 w-16 rounded bg-muted">
                                <div className="h-full rounded bg-primary" style={{ width: `${Number(r.score ?? 0)}%` }} />
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <button onClick={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))} className="text-xs text-primary hover:underline">
                                {exp ? "▼" : "▶"} Details
                              </button>
                            </td>
                            <td className="max-w-xs truncate px-3 py-2 text-muted-foreground" title={r.reasoning ?? ""}>{r.reasoning}</td>
                            <td className="px-3 py-2">{r.dr}</td>
                            <td className="px-3 py-2">{formatTraffic(r.traffic)}</td>
                            <td className="px-3 py-2">{r.geo}</td>
                            <td className="px-3 py-2">${r.price}</td>
                            <td className="px-3 py-2">{r.tat ? `${r.tat}d` : "—"}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded px-2 py-0.5 text-xs ${(r.link_type ?? "").toLowerCase() === "dofollow" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}>
                                {r.link_type}
                              </span>
                            </td>
                            <td className="max-w-[160px] truncate px-3 py-2 text-xs text-muted-foreground" title={r.contact_email ?? ""}>{r.contact_email}</td>
                            <td className="px-3 py-2">{r.red_flags ? <span title={r.red_flags}>⚠️</span> : null}</td>
                            <td className="px-3 py-2">
                              <Switch checked={!!r.included} onCheckedChange={(v) => toggleMut.mutate({ result_id: r.id, included: v })} />
                            </td>
                          </tr>
                          {exp && (
                            <tr className="bg-muted/30">
                              <td colSpan={14} className="px-3 py-3">
                                <div className="space-y-1 text-xs">
                                  {Object.entries(bd).map(([k, v]) => (
                                    <div key={k} className="flex items-center gap-2">
                                      <span className="w-32 capitalize text-muted-foreground">{k.replace(/_/g, " ")}</span>
                                      <div className="h-2 w-40 rounded bg-muted">
                                        <div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, v * 3)}%` }} />
                                      </div>
                                      <span className="font-mono">{v}</span>
                                    </div>
                                  ))}
                                  <div className="mt-1 border-t pt-1 font-semibold">Total: {Number(r.score ?? 0).toFixed(0)}/100</div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "disqualified" && (
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
                  {[...disqualified].sort((a, b) => a.domain.localeCompare(b.domain)).map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">{r.domain}</td>
                      <td className="px-3 py-2">{r.dr}</td>
                      <td className="px-3 py-2">{formatTraffic(r.traffic)}</td>
                      <td className="px-3 py-2">{r.link_type}</td>
                      <td className="px-3 py-2">{r.ranking}</td>
                      <td className="px-3 py-2">{r.red_flags}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.disqualify_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
