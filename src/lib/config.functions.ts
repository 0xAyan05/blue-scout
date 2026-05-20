import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePassword } from "./require-password";

export const getActiveConfig = createServerFn({ method: "GET" })
  .middleware([requirePassword])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("scoring_config")
      .select("*")
      .eq("is_active", true)
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

export const listConfigs = createServerFn({ method: "GET" })
  .middleware([requirePassword])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("scoring_config")
      .select("*")
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const WeightsSchema = z.object({
  niche_match: z.number().min(0).max(100),
  domain_rating: z.number().min(0).max(100),
  traffic: z.number().min(0).max(100),
  price_efficiency: z.number().min(0).max(100),
  ranking_bonus: z.number().min(0).max(100),
  geo_match: z.number().min(0).max(100),
  no_red_flags: z.number().min(0).max(100),
});

export const saveNewConfig = createServerFn({ method: "POST" })
  .middleware([requirePassword])
  .inputValidator((input) =>
    z
      .object({
        label: z.string().min(1).max(255),
        weights: WeightsSchema,
        niche_prompt: z.string().max(5000).nullable().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const sum = Object.values(data.weights).reduce((a, b) => a + b, 0);
    if (sum !== 100) throw new Error(`Weights must sum to 100 (got ${sum})`);

    // Pull current disqualifiers/overrides so they persist
    const { data: current } = await supabaseAdmin
      .from("scoring_config")
      .select("disqualifiers, overrides")
      .eq("is_active", true)
      .single();

    await supabaseAdmin.from("scoring_config").update({ is_active: false }).eq("is_active", true);

    const { data: inserted, error } = await supabaseAdmin
      .from("scoring_config")
      .insert({
        label: data.label,
        weights: data.weights,
        disqualifiers: current?.disqualifiers ?? { ranking_excluded: ["Poor", "Bad"] },
        overrides: current?.overrides ?? {},
        niche_prompt: data.niche_prompt || null,
        is_active: true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const restoreConfig = createServerFn({ method: "POST" })
  .middleware([requirePassword])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await supabaseAdmin.from("scoring_config").update({ is_active: false }).eq("is_active", true);
    const { error } = await supabaseAdmin
      .from("scoring_config")
      .update({ is_active: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
