import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePassword } from "./require-password";

const TargetPageSchema = z.object({
  url: z.string().url().max(2000),
  keyword: z.string().min(1).max(500),
});

const CreateCampaignSchema = z.object({
  client_name: z.string().min(1).max(255),
  client_niche: z.string().min(1).max(500),
  target_pages: z.array(TargetPageSchema).min(1).max(50),
  budget_per_link: z.number().min(1).max(100000),
  link_count_goal: z.number().int().min(1).max(10000),
  min_dr: z.number().int().min(0).max(100),
  min_traffic: z.number().int().min(0),
  geo_focus: z.array(z.string().min(1).max(20)).min(1).max(20),
  link_preference: z.enum(["dofollow", "either"]),
  shortlist_size: z.union([z.literal(25), z.literal(50), z.literal(100)]),
});

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requirePassword])
  .inputValidator((input) => CreateCampaignSchema.parse(input))
  .handler(async ({ data }) => {
    const { count } = await supabaseAdmin
      .from("vendors")
      .select("*", { count: "exact", head: true });
    if (!count || count === 0) {
      return { ok: false as const, code: "VENDOR_EMPTY", error: "No vendor inventory found." };
    }
    const { data: cfg } = await supabaseAdmin
      .from("scoring_config")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();
    if (!cfg) {
      return { ok: false as const, code: "CONFIG_MISSING", error: "No active scoring config." };
    }
    const { data: c, error } = await supabaseAdmin
      .from("campaigns")
      .insert({
        client_name: data.client_name,
        client_niche: data.client_niche,
        target_pages: data.target_pages,
        budget_per_link: data.budget_per_link,
        link_count_goal: data.link_count_goal,
        min_dr: data.min_dr,
        min_traffic: data.min_traffic,
        geo_focus: data.geo_focus,
        link_preference: data.link_preference,
        shortlist_size: data.shortlist_size,
        scoring_config_id: cfg.id,
        status: "scoring",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: c.id };
  });

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requirePassword])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Get include counts
    const ids = (data ?? []).map((c) => c.id);
    let counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: rows } = await supabaseAdmin
        .from("campaign_results")
        .select("campaign_id")
        .in("campaign_id", ids)
        .eq("included", true)
        .eq("disqualified", false);
      counts = (rows ?? []).reduce<Record<string, number>>((acc, r) => {
        acc[r.campaign_id] = (acc[r.campaign_id] ?? 0) + 1;
        return acc;
      }, {});
    }
    return (data ?? []).map((c) => ({ ...c, included_count: counts[c.id] ?? 0 }));
  });

export const getCampaign = createServerFn({ method: "GET" })
  .middleware([requirePassword])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: c, error } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return c;
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requirePassword])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCampaignResults = createServerFn({ method: "GET" })
  .middleware([requirePassword])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("campaign_results")
      .select("*")
      .eq("campaign_id", data.id)
      .order("rank_position", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const toggleResultIncluded = createServerFn({ method: "POST" })
  .middleware([requirePassword])
  .inputValidator((input) =>
    z
      .object({ campaign_id: z.string().uuid(), result_id: z.string().uuid(), included: z.boolean() })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("campaign_results")
      .update({ included: data.included })
      .eq("id", data.result_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("campaigns")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.campaign_id);
    return { ok: true };
  });

export const getCampaignStatus = createServerFn({ method: "GET" })
  .middleware([requirePassword])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: c } = await supabaseAdmin
      .from("campaigns")
      .select("status")
      .eq("id", data.id)
      .single();
    const { count: scored } = await supabaseAdmin
      .from("campaign_results")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", data.id);
    const { count: total } = await supabaseAdmin
      .from("vendors")
      .select("*", { count: "exact", head: true });
    return { status: c?.status ?? "unknown", scored: scored ?? 0, total: total ?? 0 };
  });

export const resetCampaign = createServerFn({ method: "POST" })
  .middleware([requirePassword])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await supabaseAdmin.from("campaign_results").delete().eq("campaign_id", data.id);
    await supabaseAdmin.from("campaigns").update({ status: "scoring" }).eq("id", data.id);
    return { ok: true };
  });
