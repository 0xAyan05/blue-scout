import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePassword } from "./require-password";

type Vendor = {
  id: string;
  domain: string;
  main_niche: string | null;
  complementary_niche: string | null;
  indirect_niche: string | null;
  dr: number | null;
  traffic: number | null;
  price: number | null;
  geo: string | null;
  link_type: string | null;
  tat: number | null;
  ranking: string | null;
  red_flags: string | null;
  contact_email: string | null;
};

type Campaign = {
  id: string;
  client_name: string;
  client_niche: string;
  target_pages: Array<{ url: string; keyword: string }>;
  budget_per_link: number;
  min_dr: number;
  min_traffic: number;
  geo_focus: string[];
  link_preference: string;
  shortlist_size: number;
};

type Weights = {
  niche_match: number;
  domain_rating: number;
  traffic: number;
  price_efficiency: number;
  ranking_bonus: number;
  geo_match: number;
  no_red_flags: number;
};

type Config = {
  weights: Weights;
  disqualifiers: { ranking_excluded?: string[] };
  overrides: Record<string, Partial<Weights>>;
  niche_prompt: string | null;
};

function resolveWeights(cfg: Config, clientNiche: string): Weights {
  const w: Weights = { ...cfg.weights };
  for (const [industry, override] of Object.entries(cfg.overrides ?? {})) {
    if (clientNiche.toLowerCase().includes(industry.toLowerCase())) {
      Object.assign(w, override);
    }
  }
  return w;
}

function checkDisqualified(
  v: Vendor,
  c: Campaign,
  cfg: Config
): string | null {
  if (v.dr == null || v.dr < c.min_dr) return `DR ${v.dr ?? 0} — below minimum ${c.min_dr}`;
  if (v.traffic == null || v.traffic < c.min_traffic)
    return `Traffic ${v.traffic ?? 0} — below minimum ${c.min_traffic}`;
  if (
    c.link_preference === "dofollow" &&
    (v.link_type ?? "").toLowerCase() === "nofollow"
  )
    return `Nofollow link — campaign requires dofollow`;
  const excl = cfg.disqualifiers?.ranking_excluded ?? [];
  if (v.ranking && excl.includes(v.ranking)) return `Ranking: ${v.ranking} — excluded by config`;
  return null;
}

function scoreVendor(v: Vendor, c: Campaign, w: Weights) {
  const breakdown: Record<string, number> = {};
  // Niche match
  const clientTerms = [
    ...c.client_niche.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    ...c.target_pages.flatMap((p) =>
      p.keyword.toLowerCase().split(/\s+/).filter(Boolean)
    ),
  ];
  const domainTerms = [
    ...(v.main_niche ?? "").toLowerCase().split(/[\s,]+/),
    ...(v.complementary_niche ?? "").toLowerCase().split(/[\s,]+/),
    ...(v.indirect_niche ?? "").toLowerCase().split(/[\s,]+/),
  ].filter(Boolean);
  const matchCount = clientTerms.filter((t) =>
    domainTerms.some((d) => d.includes(t) || t.includes(d))
  ).length;
  const nicheRaw = Math.min(matchCount / Math.max(clientTerms.length, 1), 1);
  breakdown.niche_match = Math.round(nicheRaw * w.niche_match);

  // DR
  const drCap = 90;
  const drRange = drCap - c.min_dr;
  const drScore =
    drRange <= 0
      ? 1
      : Math.min(Math.max(((v.dr ?? 0) - c.min_dr) / drRange, 0), 1);
  breakdown.domain_rating = Math.round(drScore * w.domain_rating);

  // Traffic (log scale)
  const tRatio = (v.traffic ?? 0) / Math.max(c.min_traffic, 1);
  const trafficScore = tRatio <= 1 ? 0 : Math.min(Math.log(tRatio) / Math.log(100), 1);
  breakdown.traffic = Math.round(Math.max(trafficScore, 0) * w.traffic);

  // Price
  const price = v.price ?? Infinity;
  const priceScore = price <= c.budget_per_link ? 1 - price / c.budget_per_link : 0;
  breakdown.price_efficiency = Math.round(Math.max(priceScore, 0) * w.price_efficiency);

  // Ranking
  const rankingMap: Record<string, number> = { Good: 1, Okay: 0.5 };
  breakdown.ranking_bonus = Math.round((rankingMap[v.ranking ?? ""] ?? 0) * w.ranking_bonus);

  // Geo
  const clientGeos = c.geo_focus.map((g) => g.toLowerCase());
  const dGeo = (v.geo ?? "").toLowerCase();
  const geoMatch =
    clientGeos.includes("global") || dGeo === "global" || clientGeos.includes(dGeo);
  breakdown.geo_match = geoMatch ? w.geo_match : 0;

  // Red flags
  breakdown.no_red_flags = !v.red_flags || v.red_flags.trim() === "" ? w.no_red_flags : 0;

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { breakdown, total };
}

function generateReasoning(
  breakdown: Record<string, number>,
  v: Vendor,
  c: Campaign
): string {
  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const top = sorted[0]?.[0];
  const second = sorted[1]?.[0];
  const phrases: Record<string, string> = {
    niche_match: `Strong niche alignment with ${c.client_niche}.`,
    domain_rating: `DR ${v.dr} well above the minimum of ${c.min_dr}.`,
    traffic: `High organic traffic (${(v.traffic ?? 0).toLocaleString()}/mo).`,
    price_efficiency: `Price $${v.price} is efficient within the $${c.budget_per_link} budget.`,
    ranking_bonus: `Quality rated ${v.ranking} by editorial team.`,
    geo_match: `Geo matches target market.`,
    no_red_flags: `No red flags on record.`,
  };
  const a = phrases[top ?? ""] ?? "";
  const b = phrases[second ?? ""] ?? "";
  return `${a} ${b}`.trim();
}

const BATCH_SIZE = 200;

export const runScoringBatch = createServerFn({ method: "POST" })
  .middleware([requirePassword])
  .inputValidator((input) => z.object({ campaign_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", data.campaign_id)
      .single();
    if (cErr || !campaign) throw new Error(cErr?.message ?? "Campaign not found");
    if (campaign.status !== "scoring") {
      return { done: true, scored: 0, total: 0 };
    }

    const { data: cfgRow, error: cfgErr } = await supabaseAdmin
      .from("scoring_config")
      .select("*")
      .eq("id", campaign.scoring_config_id ?? "")
      .maybeSingle();
    if (cfgErr || !cfgRow) throw new Error("Scoring config not found");
    const cfg = cfgRow as unknown as Config;

    const { count: total } = await supabaseAdmin
      .from("vendors")
      .select("*", { count: "exact", head: true });
    const { count: alreadyScored } = await supabaseAdmin
      .from("campaign_results")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", data.campaign_id);

    const totalCount = total ?? 0;
    const offset = alreadyScored ?? 0;

    if (offset >= totalCount) {
      // All done — finalize: rank and set status
      await finalizeCampaign(data.campaign_id, campaign.shortlist_size);
      return { done: true, scored: offset, total: totalCount };
    }

    // Fetch this batch of vendors
    const { data: vendors, error: vErr } = await supabaseAdmin
      .from("vendors")
      .select("*")
      .order("id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);
    if (vErr) throw new Error(vErr.message);

    const camp = campaign as unknown as Campaign;
    const weights = resolveWeights(cfg, camp.client_niche);

    const rowsToInsert = (vendors ?? []).map((v) => {
      const vendor = v as unknown as Vendor;
      const dq = checkDisqualified(vendor, camp, cfg);
      if (dq) {
        return {
          campaign_id: data.campaign_id,
          domain: vendor.domain,
          score: null,
          score_breakdown: null,
          reasoning: null,
          dr: vendor.dr,
          traffic: vendor.traffic,
          geo: vendor.geo,
          price: vendor.price,
          tat: vendor.tat,
          link_type: vendor.link_type,
          ranking: vendor.ranking,
          red_flags: vendor.red_flags,
          contact_email: vendor.contact_email,
          included: false,
          disqualified: true,
          disqualify_reason: dq,
          rank_position: null,
        };
      }
      const { breakdown, total: t } = scoreVendor(vendor, camp, weights);
      return {
        campaign_id: data.campaign_id,
        domain: vendor.domain,
        score: t,
        score_breakdown: breakdown,
        reasoning: generateReasoning(breakdown, vendor, camp),
        dr: vendor.dr,
        traffic: vendor.traffic,
        geo: vendor.geo,
        price: vendor.price,
        tat: vendor.tat,
        link_type: vendor.link_type,
        ranking: vendor.ranking,
        red_flags: vendor.red_flags,
        contact_email: vendor.contact_email,
        included: false, // set during finalize
        disqualified: false,
        disqualify_reason: null,
        rank_position: null,
      };
    });

    if (rowsToInsert.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from("campaign_results")
        .insert(rowsToInsert);
      if (insErr) throw new Error(insErr.message);
    }

    const newScored = offset + (vendors?.length ?? 0);
    const done = newScored >= totalCount;
    if (done) {
      await finalizeCampaign(data.campaign_id, campaign.shortlist_size);
    }
    return { done, scored: newScored, total: totalCount };
  });

async function finalizeCampaign(campaignId: string, shortlistSize: number) {
  const { data: scored } = await supabaseAdmin
    .from("campaign_results")
    .select("id, score")
    .eq("campaign_id", campaignId)
    .eq("disqualified", false)
    .order("score", { ascending: false, nullsFirst: false });

  const ranked = scored ?? [];
  // Bulk update ranks & included flag (chunked)
  const updates = ranked.map((r, i) => ({
    id: r.id,
    rank_position: i + 1,
    included: i < shortlistSize,
  }));
  // Supabase doesn't have bulk update by id without upsert; iterate per chunk
  const CHUNK = 100;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const slice = updates.slice(i, i + CHUNK);
    await Promise.all(
      slice.map((u) =>
        supabaseAdmin
          .from("campaign_results")
          .update({ rank_position: u.rank_position, included: u.included })
          .eq("id", u.id)
      )
    );
  }

  await supabaseAdmin
    .from("campaigns")
    .update({ status: "in_progress", updated_at: new Date().toISOString() })
    .eq("id", campaignId);
}
