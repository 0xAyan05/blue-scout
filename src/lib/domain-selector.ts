import * as XLSX from "xlsx";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TablesInsert } from "@/integrations/supabase/types";

export class AppError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const campaignCreateSchema = z.object({
  client_name: z.string().min(1).max(255),
  client_niche: z.string().min(1).max(500),
  target_pages: z
    .array(
      z.object({
        url: z.string().url().max(2000),
        keyword: z.string().min(1).max(500),
      }),
    )
    .min(1)
    .max(50),
  budget_per_link: z.number().min(1).max(100000),
  link_count_goal: z.number().int().min(1).max(10000),
  min_dr: z.number().int().min(0).max(100),
  min_traffic: z.number().int().min(0),
  geo_focus: z.array(z.string().min(1).max(20)).min(1).max(20),
  link_preference: z.enum(["dofollow", "either"]),
  shortlist_size: z.union([z.literal(25), z.literal(50), z.literal(100)]),
});

const weightsSchema = z.object({
  niche_match: z.number().min(0).max(100),
  domain_rating: z.number().min(0).max(100),
  traffic: z.number().min(0).max(100),
  price_efficiency: z.number().min(0).max(100),
  ranking_bonus: z.number().min(0).max(100),
  geo_match: z.number().min(0).max(100),
  no_red_flags: z.number().min(0).max(100),
});

export const configSaveSchema = z.object({
  label: z.string().min(1).max(255),
  weights: weightsSchema,
  niche_prompt: z.string().max(5000).nullable().optional(),
});

type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;
type Weights = z.infer<typeof weightsSchema>;

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
  scoring_config_id: string | null;
  status: string;
};

type Config = {
  id: string;
  version: number;
  label: string | null;
  weights: Weights;
  disqualifiers: { ranking_excluded?: string[] };
  overrides: Record<string, Partial<Weights>>;
  niche_prompt: string | null;
};

const REQUIRED_COLS = [
  "domain",
  "main_niche",
  "complementary_niche",
  "indirect_niche",
  "dr",
  "traffic",
  "price",
  "geo",
  "link_type",
  "tat",
  "ranking",
  "red_flags",
  "contact_email",
] as const;

const BATCH_SIZE = 200;

function toInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const normalized = String(value).replace(/[,\s]/g, "");
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const normalized = String(value).replace(/[,$\s]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStr(value: unknown): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function resolveWeights(config: Config, clientNiche: string): Weights {
  const weights: Weights = { ...config.weights };
  for (const [industry, override] of Object.entries(config.overrides ?? {})) {
    if (clientNiche.toLowerCase().includes(industry.toLowerCase())) {
      Object.assign(weights, override);
    }
  }
  return weights;
}

function checkDisqualified(vendor: Vendor, campaign: Campaign, config: Config): string | null {
  if (vendor.dr == null || vendor.dr < campaign.min_dr) {
    return `DR ${vendor.dr ?? 0} — below minimum ${campaign.min_dr}`;
  }
  if (vendor.traffic == null || vendor.traffic < campaign.min_traffic) {
    return `Traffic ${vendor.traffic ?? 0} — below minimum ${campaign.min_traffic}`;
  }
  if (
    campaign.link_preference === "dofollow" &&
    (vendor.link_type ?? "").toLowerCase() === "nofollow"
  ) {
    return "Nofollow link — campaign requires dofollow";
  }
  const excluded = config.disqualifiers?.ranking_excluded ?? [];
  if (vendor.ranking && excluded.includes(vendor.ranking)) {
    return `Ranking: ${vendor.ranking} — excluded by config`;
  }
  return null;
}

function scoreVendor(vendor: Vendor, campaign: Campaign, weights: Weights) {
  const breakdown: Record<string, number> = {};
  const clientTerms = [
    ...campaign.client_niche.split(",").map((segment) => segment.trim().toLowerCase()).filter(Boolean),
    ...campaign.target_pages.flatMap((page) =>
      page.keyword.toLowerCase().split(/\s+/).filter(Boolean),
    ),
  ];
  const domainTerms = [
    ...(vendor.main_niche ?? "").toLowerCase().split(/[\s,]+/),
    ...(vendor.complementary_niche ?? "").toLowerCase().split(/[\s,]+/),
    ...(vendor.indirect_niche ?? "").toLowerCase().split(/[\s,]+/),
  ].filter(Boolean);
  const matchCount = clientTerms.filter((term) =>
    domainTerms.some((domainTerm) => domainTerm.includes(term) || term.includes(domainTerm)),
  ).length;
  const nicheRaw = Math.min(matchCount / Math.max(clientTerms.length, 1), 1);
  breakdown.niche_match = Math.round(nicheRaw * weights.niche_match);

  const drCap = 90;
  const drRange = drCap - campaign.min_dr;
  const drScore =
    drRange <= 0 ? 1 : Math.min(Math.max(((vendor.dr ?? 0) - campaign.min_dr) / drRange, 0), 1);
  breakdown.domain_rating = Math.round(drScore * weights.domain_rating);

  const trafficScore = Math.min(
    Math.log(Math.max((vendor.traffic ?? 0) / Math.max(campaign.min_traffic, 1), 1)) / Math.log(100),
    1,
  );
  breakdown.traffic = Math.round(Math.max(trafficScore, 0) * weights.traffic);

  const priceScore =
    (vendor.price ?? Number.POSITIVE_INFINITY) <= campaign.budget_per_link
      ? 1 - (vendor.price ?? 0) / campaign.budget_per_link
      : 0;
  breakdown.price_efficiency = Math.round(
    Math.max(priceScore, 0) * weights.price_efficiency,
  );

  const rankingMap: Record<string, number> = { Good: 1, Okay: 0.5 };
  breakdown.ranking_bonus = Math.round(
    (rankingMap[vendor.ranking ?? ""] ?? 0) * weights.ranking_bonus,
  );

  const clientGeos = campaign.geo_focus.map((geo) => geo.toLowerCase());
  const domainGeo = (vendor.geo ?? "").toLowerCase();
  const geoMatch =
    clientGeos.includes("global") ||
    domainGeo === "global" ||
    clientGeos.includes(domainGeo);
  breakdown.geo_match = geoMatch ? weights.geo_match : 0;

  breakdown.no_red_flags =
    !vendor.red_flags || vendor.red_flags.trim() === "" ? weights.no_red_flags : 0;

  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { breakdown, total };
}

function generateReasoning(
  breakdown: Record<string, number>,
  vendor: Vendor,
  campaign: Campaign,
) {
  const dims = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const top = dims[0]?.[0];
  const second = dims[1]?.[0];
  const phrases: Record<string, string> = {
    niche_match: `Strong niche alignment with ${campaign.client_niche}.`,
    domain_rating: `DR ${vendor.dr} well above the minimum of ${campaign.min_dr}.`,
    traffic: `High organic traffic (${(vendor.traffic ?? 0).toLocaleString()}/mo).`,
    price_efficiency: `Price $${vendor.price} is efficient within the $${campaign.budget_per_link} budget.`,
    ranking_bonus: `Quality rated ${vendor.ranking} by editorial team.`,
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

  for (let index = 0; index < updates.length; index += 100) {
    const chunk = updates.slice(index, index + 100);
    await Promise.all(
      chunk.map((update) =>
        supabaseAdmin
          .from("campaign_results")
          .update({
            rank_position: update.rank_position,
            included: update.included,
          })
          .eq("id", update.id),
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

async function ensureCampaignFinalized(campaignId: string) {
  const { data: campaignRow, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .select("id, status, shortlist_size")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaignRow) {
    throw new AppError("Campaign not found.", "CAMPAIGN_NOT_FOUND", 404);
  }

  if (campaignRow.status !== "scoring") {
    return campaignRow.status;
  }

  const [{ count: scored }, { count: total }] = await Promise.all([
    supabaseAdmin
      .from("campaign_results")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId),
    supabaseAdmin.from("vendors").select("*", { count: "exact", head: true }),
  ]);

  const scoredCount = scored ?? 0;
  const totalCount = total ?? 0;

  if (totalCount > 0 && scoredCount >= totalCount) {
    await finalizeCampaign(campaignId, campaignRow.shortlist_size ?? 50);
    return "in_progress";
  }

  return campaignRow.status;
}

export async function processScoringBatch(campaignId: string) {
  const { data: campaignRow, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (campaignError || !campaignRow) {
    throw new AppError("Campaign not found.", "CAMPAIGN_NOT_FOUND", 404);
  }

  const campaign = campaignRow as unknown as Campaign;
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

  const { data: configRow, error: configError } = await supabaseAdmin
    .from("scoring_config")
    .select("*")
    .eq("id", campaign.scoring_config_id ?? "")
    .maybeSingle();

  if (configError || !configRow) {
    await supabaseAdmin
      .from("campaigns")
      .update({
        status: "error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);
    throw new AppError(
      "No active scoring configuration found. Contact your admin.",
      "CONFIG_MISSING",
      500,
    );
  }

  const config = configRow as unknown as Config;
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
  if (vendorsError) throw new AppError(vendorsError.message, "SCORING_FAILED", 500);

  const weights = resolveWeights(config, campaign.client_niche);
  const rowsToInsert = (vendors ?? []).map((row) => {
    const vendor = row as unknown as Vendor;
    const disqualifyReason = checkDisqualified(vendor, campaign, config);
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

    const { breakdown, total: score } = scoreVendor(vendor, campaign, weights);
    return {
      campaign_id: campaignId,
      domain: vendor.domain,
      score,
      score_breakdown: breakdown,
      reasoning: generateReasoning(breakdown, vendor, campaign),
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
    if (insertError) throw new AppError(insertError.message, "SCORING_FAILED", 500);
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
    for (let index = 0; index < 1000; index += 1) {
      const result = await processScoringBatch(campaignId);
      if (result.done) return result;
    }
    throw new AppError("Scoring loop exceeded safety limit.", "SCORING_FAILED", 500);
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

export function startScoringInBackground(campaignId: string) {
  queueMicrotask(() => {
    void runCampaignScoringToCompletion(campaignId).catch((error) => {
      console.error("Background scoring failed", error);
    });
  });
}

export async function getInventoryStatus() {
  const { count } = await supabaseAdmin
    .from("vendors")
    .select("*", { count: "exact", head: true });
  const { data: latest } = await supabaseAdmin
    .from("vendors")
    .select("uploaded_at")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { count: count ?? 0, lastUploadedAt: latest?.uploaded_at ?? null };
}

export async function uploadInventoryCsv(csv: string) {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(csv, { type: "string", raw: true });
  } catch (error) {
    console.error(error);
    throw new AppError(
      "Could not read this file. Ensure it is a valid CSV.",
      "UPLOAD_PARSE_ERROR",
      400,
    );
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new AppError(
      "Could not read this file. Ensure it is a valid CSV.",
      "UPLOAD_PARSE_ERROR",
      400,
    );
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rows.length === 0) {
    throw new AppError(
      "Could not read this file. Ensure it is a valid CSV.",
      "UPLOAD_PARSE_ERROR",
      400,
    );
  }

  const headerMap: Record<string, string> = {};
  Object.keys(rows[0]).forEach((key) => {
    headerMap[key.toLowerCase().trim()] = key;
  });

  const missing = REQUIRED_COLS.filter((column) => !(column in headerMap));
  if (missing.length > 0) {
    throw new AppError(
      `Missing required columns: ${missing.join(", ")}`,
      "UPLOAD_MISSING_COLUMNS",
      400,
      { missing },
    );
  }

  let skipped = 0;
  const toInsert: TablesInsert<"vendors">[] = [];
  for (const row of rows) {
    const domain = toStr(row[headerMap.domain]);
    const dr = toInt(row[headerMap.dr]);
    const traffic = toInt(row[headerMap.traffic]);
    if (!domain || dr == null || traffic == null) {
      skipped += 1;
      continue;
    }
    toInsert.push({
      domain,
      main_niche: toStr(row[headerMap.main_niche]),
      complementary_niche: toStr(row[headerMap.complementary_niche]),
      indirect_niche: toStr(row[headerMap.indirect_niche]),
      dr,
      traffic,
      price: toNum(row[headerMap.price]),
      geo: toStr(row[headerMap.geo]),
      link_type: toStr(row[headerMap.link_type])?.toLowerCase() ?? null,
      tat: toInt(row[headerMap.tat]),
      ranking: toStr(row[headerMap.ranking]),
      red_flags: toStr(row[headerMap.red_flags]),
      contact_email: toStr(row[headerMap.contact_email]),
    });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("vendors")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteError) throw new AppError(deleteError.message, "UPLOAD_FAILED", 500);

  for (let index = 0; index < toInsert.length; index += 500) {
    const { error } = await supabaseAdmin.from("vendors").insert(toInsert.slice(index, index + 500));
    if (error) throw new AppError(error.message, "UPLOAD_FAILED", 500);
  }

  return { imported: toInsert.length, skipped };
}

export async function getActiveConfig() {
  const { data, error } = await supabaseAdmin
    .from("scoring_config")
    .select("*")
    .eq("is_active", true)
    .single();
  if (error || !data) {
    throw new AppError(
      "No active scoring configuration found. Contact your admin.",
      "CONFIG_MISSING",
      404,
    );
  }
  return data;
}

export async function listConfigs() {
  const { data, error } = await supabaseAdmin
    .from("scoring_config")
    .select("*")
    .order("version", { ascending: false });
  if (error) throw new AppError(error.message, "CONFIG_LIST_FAILED", 500);
  return data ?? [];
}

export async function saveNewConfig(input: z.infer<typeof configSaveSchema>) {
  const parsed = configSaveSchema.parse(input);
  const total = Object.values(parsed.weights).reduce((sum, value) => sum + value, 0);
  if (total !== 100) {
    throw new AppError("Weights must total 100.", "CONFIG_INVALID", 400);
  }

  const { data: current } = await supabaseAdmin
    .from("scoring_config")
    .select("disqualifiers, overrides")
    .eq("is_active", true)
    .single();

  await supabaseAdmin.from("scoring_config").update({ is_active: false }).eq("is_active", true);

  const { data, error } = await supabaseAdmin
    .from("scoring_config")
    .insert({
      label: parsed.label,
      weights: parsed.weights,
      disqualifiers: current?.disqualifiers ?? { ranking_excluded: ["Poor", "Bad"] },
      overrides: current?.overrides ?? {},
      niche_prompt: parsed.niche_prompt || null,
      is_active: true,
    })
    .select()
    .single();
  if (error || !data) throw new AppError(error?.message ?? "Config save failed", "CONFIG_SAVE_FAILED", 500);
  return data;
}

export async function restoreConfig(id: string) {
  await supabaseAdmin.from("scoring_config").update({ is_active: false }).eq("is_active", true);
  const { error } = await supabaseAdmin
    .from("scoring_config")
    .update({ is_active: true })
    .eq("id", id);
  if (error) throw new AppError(error.message, "CONFIG_RESTORE_FAILED", 500);
  return { ok: true };
}

export async function listCampaigns() {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new AppError(error.message, "CAMPAIGNS_LIST_FAILED", 500);

  const ids = (data ?? []).map((campaign) => campaign.id);
  let counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: rows } = await supabaseAdmin
      .from("campaign_results")
      .select("campaign_id")
      .in("campaign_id", ids)
      .eq("included", true)
      .eq("disqualified", false);
    counts = (rows ?? []).reduce<Record<string, number>>((acc, row) => {
      acc[row.campaign_id] = (acc[row.campaign_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  return (data ?? []).map((campaign) => ({
    ...campaign,
    included_count: counts[campaign.id] ?? 0,
  }));
}

export async function getCampaign(id: string) {
  const { data: campaign, error } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !campaign) {
    throw new AppError("Campaign not found.", "CAMPAIGN_NOT_FOUND", 404);
  }

  const [{ data: config }, { count: inventoryCount }, { data: latestVendor }] = await Promise.all([
    supabaseAdmin
      .from("scoring_config")
      .select("id, version, label, weights")
      .eq("id", campaign.scoring_config_id ?? "")
      .maybeSingle(),
    supabaseAdmin.from("vendors").select("*", { count: "exact", head: true }),
    supabaseAdmin
      .from("vendors")
      .select("uploaded_at")
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    ...campaign,
    scoring_config_meta: config ?? null,
    inventory_status: {
      count: inventoryCount ?? 0,
      uploaded_at: latestVendor?.uploaded_at ?? null,
    },
  };
}

export async function getCampaignResults(id: string) {
  const { data, error } = await supabaseAdmin
    .from("campaign_results")
    .select("*")
    .eq("campaign_id", id)
    .order("rank_position", { ascending: true, nullsFirst: false });
  if (error) throw new AppError(error.message, "CAMPAIGN_RESULTS_FAILED", 500);
  return data ?? [];
}

export async function getCampaignStatus(id: string) {
  const healedStatus = await ensureCampaignFinalized(id);
  const { count: scored } = await supabaseAdmin
    .from("campaign_results")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", id);
  const { count: total } = await supabaseAdmin
    .from("vendors")
    .select("*", { count: "exact", head: true });

  return { status: healedStatus ?? "unknown", scored: scored ?? 0, total: total ?? 0 };
}

export async function createCampaign(input: CampaignCreateInput) {
  const parsed = campaignCreateSchema.parse(input);

  const { count: vendorCount } = await supabaseAdmin
    .from("vendors")
    .select("*", { count: "exact", head: true });
  if (!vendorCount || vendorCount === 0) {
    throw new AppError(
      "No vendor inventory found. Please upload your vendor CSV before creating a campaign.",
      "VENDOR_EMPTY",
      400,
    );
  }

  const { data: latestVendor } = await supabaseAdmin
    .from("vendors")
    .select("uploaded_at")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: config } = await supabaseAdmin
    .from("scoring_config")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!config) {
    throw new AppError(
      "No active scoring configuration found. Contact your admin.",
      "CONFIG_MISSING",
      400,
    );
  }

  const vendorSnapshot = `${vendorCount} domains | uploaded ${latestVendor?.uploaded_at ?? "unknown"}`;
  const { data: campaign, error } = await supabaseAdmin
    .from("campaigns")
    .insert({
      client_name: parsed.client_name,
      client_niche: parsed.client_niche,
      target_pages: parsed.target_pages,
      budget_per_link: parsed.budget_per_link,
      link_count_goal: parsed.link_count_goal,
      min_dr: parsed.min_dr,
      min_traffic: parsed.min_traffic,
      geo_focus: parsed.geo_focus,
      link_preference: parsed.link_preference,
      shortlist_size: parsed.shortlist_size,
      scoring_config_id: config.id,
      vendor_snapshot: vendorSnapshot,
      status: "scoring",
    })
    .select()
    .single();
  if (error || !campaign) {
    console.error(error);
    throw new AppError("Could not create campaign.", "CAMPAIGN_CREATE_FAILED", 500);
  }

  startScoringInBackground(campaign.id);
  return { id: campaign.id };
}

export async function toggleResultIncluded(
  campaignId: string,
  resultId: string,
  included: boolean,
) {
  const { error } = await supabaseAdmin
    .from("campaign_results")
    .update({ included })
    .eq("id", resultId);
  if (error) throw new AppError(error.message, "RESULT_UPDATE_FAILED", 500);

  await supabaseAdmin
    .from("campaigns")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", campaignId);
  return { ok: true };
}

export async function deleteCampaign(id: string) {
  const { error } = await supabaseAdmin.from("campaigns").delete().eq("id", id);
  if (error) throw new AppError(error.message, "CAMPAIGN_DELETE_FAILED", 500);
  return { ok: true };
}

export async function restartCampaign(id: string) {
  await supabaseAdmin.from("campaign_results").delete().eq("campaign_id", id);
  await supabaseAdmin
    .from("campaigns")
    .update({ status: "scoring", updated_at: new Date().toISOString() })
    .eq("id", id);
  startScoringInBackground(id);
  return { ok: true };
}

export async function buildCampaignExport(campaignId: string) {
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (campaignError || !campaign) {
    throw new AppError("Campaign not found.", "CAMPAIGN_NOT_FOUND", 404);
  }

  await supabaseAdmin
    .from("campaigns")
    .update({
      status: "exported",
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  const { data: results, error: resultsError } = await supabaseAdmin
    .from("campaign_results")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("included", true)
    .eq("disqualified", false)
    .order("rank_position", { ascending: true });
  if (resultsError) throw new AppError(resultsError.message, "EXPORT_FAILED", 500);

  const targetPages = (campaign.target_pages as Array<{ url: string; keyword: string }>) ?? [];
  const firstUrl = targetPages[0]?.url ?? "";
  const firstKeyword = targetPages[0]?.keyword ?? "";
  const workbook = XLSX.utils.book_new();

  const clientInfoHeaders = [
    "Client Name",
    "Client Niche",
    "Budget Per Link",
    "Link Count Goal",
    "Min DR",
    "Min Traffic",
    "Geo Focus",
    "Link Preference",
    "Shortlist Size",
    "Campaign Date",
    "Status",
    "Template 1",
    "Template 2",
    "Template 3",
    "Template 4",
    "Template 5",
    "Template 6",
    "Template 7",
    "Template 8",
    "Template 9",
  ];

  const clientInfoRow = [
    campaign.client_name,
    campaign.client_niche,
    campaign.budget_per_link,
    campaign.link_count_goal,
    campaign.min_dr,
    campaign.min_traffic,
    (campaign.geo_focus as string[]).join(", "),
    campaign.link_preference,
    campaign.shortlist_size,
    new Date(campaign.created_at ?? Date.now()).toISOString().slice(0, 10),
    "exported",
    ...Array(9).fill(""),
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([clientInfoHeaders, clientInfoRow]),
    "Client Info",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Target URL", "Primary Keyword", "Notes"],
      ...targetPages.map((page) => [page.url, page.keyword, ""]),
    ]),
    "Target Pages",
  );

  const campaignManagementHeaders = [
    "Period",
    "Order Number",
    "Placement Domain",
    "DR",
    "Traffic",
    "Order Price",
    "DB Price",
    "TAT",
    "Target URL",
    "Anchor Text",
    "Link Type",
    "Budget",
    "Profit",
    "Status",
    "Contact Email",
    "Team",
    "Review Status",
    "GP Doc",
    "Content Status",
    "Payment 1",
    "Payment 2",
    "Payment 3",
    "Payment 4",
    "Hash",
    "Extra 1",
    "Extra 2",
    "Extra 3",
    "Extra 4",
    "Extra 5",
    "Extra 6",
    "Extra 7",
    "Extra 8",
  ];

  const period = new Date().toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });

  const campaignManagementRows: (string | number)[][] = [campaignManagementHeaders];
  (results ?? []).forEach((row, index) => {
    const sheetRow = index + 2;
    campaignManagementRows.push([
      period,
      index + 1,
      row.domain,
      row.dr ?? "",
      row.traffic ?? "",
      row.price ?? "",
      "",
      row.tat ?? "",
      firstUrl,
      firstKeyword,
      row.link_type ?? "",
      campaign.budget_per_link,
      `=L${sheetRow}-F${sheetRow}`,
      "Pending",
      row.contact_email ?? "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  });

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(campaignManagementRows),
    "Campaign Management",
  );

  const today = new Date().toISOString().slice(0, 10);
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [
        "Domain",
        "DR",
        "Traffic",
        "Geo",
        "Link Type",
        "Price",
        "TAT",
        "Ranking",
        "Red Flags",
        "Contact Email",
        "Score",
        "Rank",
        "Included Since",
      ],
      ...(results ?? []).map((row) => [
        row.domain,
        row.dr ?? "",
        row.traffic ?? "",
        row.geo ?? "",
        row.link_type ?? "",
        row.price ?? "",
        row.tat ?? "",
        row.ranking ?? "",
        row.red_flags ?? "",
        row.contact_email ?? "",
        row.score ?? "",
        row.rank_position ?? "",
        today,
      ]),
    ]),
    "Referring Domains",
  );

  const fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const { error: exportInsertError } = await supabaseAdmin.from("campaign_exports").insert({
    campaign_id: campaignId,
    file_data: fileBuffer as unknown as string,
  });
  if (exportInsertError) console.error(exportInsertError);

  const safeClientName = campaign.client_name.replace(/[^a-z0-9_-]+/gi, "_");
  const filename = `${safeClientName}_campaign_${today}.xlsx`;
  return { buffer: fileBuffer, filename };
}
