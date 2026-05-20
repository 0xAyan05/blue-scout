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
  id: string;
  version: number;
  weights: Weights;
  disqualifiers: { ranking_excluded?: string[] };
  overrides: Record<string, Partial<Weights>>;
  niche_prompt: string | null;
};

const BATCH_SIZE = 200;

function resolveWeights(cfg: Config, clientNiche: string): Weights {
  const weights: Weights = { ...cfg.weights };
  for (const [industry, override] of Object.entries(cfg.overrides ?? {})) {
    if (clientNiche.toLowerCase().includes(industry.toLowerCase())) {
      Object.assign(weights, override);
    }
  }
  return weights;
}

function checkDisqualified(v: Vendor, c: Campaign, cfg: Config): string | null {
  if (v.dr == null || v.dr < c.min_dr) return `DR ${v.dr ?? 0} — below minimum ${c.min_dr}`;
  if (v.traffic == null || v.traffic < c.min_traffic) {
    return `Traffic ${v.traffic ?? 0} — below minimum ${c.min_traffic}`;
  }
  if (c.link_preference === "dofollow" && (v.link_type ?? "").toLowerCase() === "nofollow") {
    return "Nofollow link — campaign requires dofollow";
  }
  const excluded = cfg.disqualifiers?.ranking_excluded ?? [];
  if (v.ranking && excluded.includes(v.ranking)) {
    return `Ranking: ${v.ranking} — excluded by config`;
  }
  return null;
}

function scoreVendor(v: Vendor, c: Campaign, w: Weights) {
  const breakdown: Record<string, number> = {};

  const clientTerms = [
    ...c.client_niche.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    ...c.target_pages.flatMap((p) => p.keyword.toLowerCase().split(/\s+/).filter(Boolean)),
  ];
  const domainTerms = [
    ...(v.main_niche ?? "").toLowerCase().split(/[\s,]+/),
    ...(v.complementary_niche ?? "").toLowerCase().split(/[\s,]+/),
    ...(v.indirect_niche ?? "").toLowerCase().split(/[\s,]+/),
  ].filter(Boolean);
  const matchCount = clientTerms.filter((term) =>
    domainTerms.some((domainTerm) => domainTerm.includes(term) || term.includes(domainTerm)),
  ).length;
  const nicheRaw = Math.min(matchCount / Math.max(clientTerms.length, 1), 1);
  breakdown.niche_match = Math.round(nicheRaw * w.niche_match);

  const drCap = 90;
  const drRange = drCap - c.min_dr;
  const drScore =
    drRange <= 0 ? 1 : Math.min(Math.max(((v.dr ?? 0) - c.min_dr) / drRange, 0), 1);
  breakdown.domain_rating = Math.round(drScore * w.domain_rating);

  const trafficScore = Math.min(
    Math.log(Math.max((v.traffic ?? 0) / Math.max(c.min_traffic, 1), 1)) / Math.log(100),
    1,
  );
  breakdown.traffic = Math.round(Math.max(trafficScore, 0) * w.traffic);

  const priceScore =
    (v.price ?? Infinity) <= c.budget_per_link ? 1 - (v.price ?? 0) / c.budget_per_link : 0;
  breakdown.price_efficiency = Math.round(Math.max(priceScore, 0) * w.price_efficiency);

  const rankingMap: Record<string, number> = { Good: 1, Okay: 0.5 };
  breakdown.ranking_bonus = Math.round((rankingMap[v.ranking ?? ""] ?? 0) * w.ranking_bonus);

  const clientGeos = c.geo_focus.map((g) => g.toLowerCase());
  const domainGeo = (v.geo ?? "").toLowerCase();
  const geoMatch =
    clientGeos.includes("global") || domainGeo === "global" || clientGeos.includes(domainGeo);
  breakdown.geo_match = geoMatch ? w.geo_match : 0;

  breakdown.no_red_flags = !v.red_flags || v.red_flags.trim() === "" ? w.no_red_flags : 0;

  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { breakdown, total };
}

function generateReasoning(breakdown: Record<string, number>, v: Vendor, c: Campaign) {
  const dims = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const top = dims[0]?.[0];
  const second = dims[1]?.[0];
  const phrases: Record<string, string> = {
    niche_match: `Strong niche alignment with ${c.client_niche}.`,
    domain_rating: `DR ${v.dr} well above the minimum of ${c.min_dr}.`,
    traffic: `High organic traffic (${(v.traffic ?? 0).toLocaleString()}/mo).`,
    price_efficiency: `Price $${v.price} is efficient within the $${c.budget_per_link} budget.`,
    ranking_bonus: `Quality rated ${v.ranking} by editorial team.`,
    geo_match: "Geo matches target market.",
    no_red_flags: "No red flags on record.",
  };
  return `${phrases[top ?? ""] ?? ""} ${phrases[second ?? ""] ?? ""}`.trim();
}

async function finalizeCampaign(campaignId: string, shortlistSize: number) {
  const { data: scored } = await supabaseAdmin
    .from("campaign_results")
    .select("id, score")
    .eq("campaign_id", campaignId)
    .eq("disqualified", false)
    .order("score", { ascending: false, nullsFirst: false });

  const ranked = scored ?? [];
  const updates = ranked.map((row, index) => ({
    id: row.id,
    rank_position: index + 1,
    included: index < shortlistSize,
  }));

  for (let i = 0; i < updates.length; i += 100) {
    const chunk = updates.slice(i, i + 100);
    await Promise.all(
      chunk.map((u) =>
        supabaseAdmin
          .from("campaign_results")
          .update({
            rank_position: u.rank_position,
            included: u.included,
          })
          .eq("id", u.id),
      ),
    );
  }

  await supabaseAdmin
    .from("campaigns")
    .update({
      status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
}

async function processScoringBatch(campaignId: string) {
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) throw new Error(campaignError?.message ?? "Campaign not found");

  if (campaign.status !== "scoring") {
    const { count: scored } = await supabaseAdmin
      .from("campaign_results")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId);
    const { count: total } = await supabaseAdmin
      .from("vendors")
      .select("*", { count: "exact", head: true });
    return { done: true, scored: scored ?? 0, total: total ?? 0 };
  }

  const { data: cfgRow, error: cfgError } = await supabaseAdmin
    .from("scoring_config")
    .select("*")
    .eq("id", campaign.scoring_config_id ?? "")
    .maybeSingle();

  if (cfgError || !cfgRow) {
    await supabaseAdmin
      .from("campaigns")
      .update({
        status: "error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);
    throw new Error("Scoring config not found");
  }

  const cfg = cfgRow as unknown as Config;
  const camp = campaign as unknown as Campaign;

  const { count: total } = await supabaseAdmin
    .from("vendors")
    .select("*", { count: "exact", head: true });
  const { count: alreadyScored } = await supabaseAdmin
    .from("campaign_results")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const totalCount = total ?? 0;
  const offset = alreadyScored ?? 0;

  if (offset >= totalCount) {
    await finalizeCampaign(campaignId, campaign.shortlist_size);
    return { done: true, scored: offset, total: totalCount };
  }

  const { data: vendors, error: vendorsError } = await supabaseAdmin
    .from("vendors")
    .select("*")
    .order("id", { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1);

  if (vendorsError) throw new Error(vendorsError.message);

  const weights = resolveWeights(cfg, camp.client_niche);

  const rowsToInsert = (vendors ?? []).map((vendorRow) => {
    const vendor = vendorRow as unknown as Vendor;
    const disqualifyReason = checkDisqualified(vendor, camp, cfg);

    if (disqualifyReason) {
      return {
        campaign_id: campaignId,
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
        disqualify_reason: disqualifyReason,
        rank_position: null,
      };
    }

    const { breakdown, total: score } = scoreVendor(vendor, camp, weights);
    return {
      campaign_id: campaignId,
      domain: vendor.domain,
      score,
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
      included: false,
      disqualified: false,
      disqualify_reason: null,
      rank_position: null,
    };
  });

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("campaign_results")
      .insert(rowsToInsert);
    if (insertError) throw new Error(insertError.message);
  }

  const newScored = offset + (vendors?.length ?? 0);
  const done = newScored >= totalCount;
  if (done) {
    await finalizeCampaign(campaignId, campaign.shortlist_size);
  }
  return { done, scored: newScored, total: totalCount };
}

export async function runCampaignScoringToCompletion(campaignId: string) {
  try {
    for (let i = 0; i < 1000; i++) {
      const result = await processScoringBatch(campaignId);
      if (result.done) return result;
    }
    throw new Error("Scoring loop exceeded safety limit");
  } catch (error) {
    console.error("Scoring failed", error);
    await supabaseAdmin
      .from("campaigns")
      .update({
        status: "error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);
    throw error;
  }
}

export const runScoringBatch = createServerFn({ method: "POST" })
  .middleware([requirePassword])
  .inputValidator((input) => z.object({ campaign_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    return processScoringBatch(data.campaign_id);
  });
