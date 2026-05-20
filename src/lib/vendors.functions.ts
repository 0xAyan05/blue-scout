import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePassword } from "./require-password";

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

export const getInventoryStatus = createServerFn({ method: "GET" })
  .middleware([requirePassword])
  .handler(async () => {
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
  });

function toInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(/[,\s]/g, "");
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(/[,$\s]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export const uploadInventory = createServerFn({ method: "POST" })
  .middleware([requirePassword])
  .inputValidator((input) => z.object({ csv: z.string().min(1).max(50_000_000) }).parse(input))
  .handler(async ({ data }) => {
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(data.csv, { type: "string", raw: true });
    } catch {
      return { ok: false as const, code: "UPLOAD_PARSE_ERROR", error: "Could not parse CSV." };
    }
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { ok: false as const, code: "UPLOAD_PARSE_ERROR", error: "Empty file." };

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (rows.length === 0)
      return { ok: false as const, code: "UPLOAD_PARSE_ERROR", error: "No data rows found." };

    // Case-insensitive header map
    const firstRow = rows[0];
    const headerMap: Record<string, string> = {};
    for (const key of Object.keys(firstRow)) {
      headerMap[key.toLowerCase().trim()] = key;
    }
    const missing = REQUIRED_COLS.filter((c) => !(c in headerMap));
    if (missing.length > 0) {
      return {
        ok: false as const,
        code: "UPLOAD_MISSING_COLUMNS",
        error: `Missing required columns: ${missing.join(", ")}`,
        missing,
      };
    }

    let skipped = 0;
    const toInsert: Array<Record<string, unknown>> = [];
    for (const row of rows) {
      const domain = toStr(row[headerMap.domain]);
      const dr = toInt(row[headerMap.dr]);
      const traffic = toInt(row[headerMap.traffic]);
      if (!domain || dr == null || traffic == null) {
        skipped++;
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

    // Truncate + bulk insert
    const { error: delErr } = await supabaseAdmin.from("vendors").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) throw new Error(delErr.message);

    // Insert in chunks to stay under Worker time/payload limits
    const CHUNK = 500;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const { error } = await supabaseAdmin.from("vendors").insert(toInsert.slice(i, i + CHUNK));
      if (error) throw new Error(error.message);
    }

    return { ok: true as const, imported: toInsert.length, skipped };
  });
