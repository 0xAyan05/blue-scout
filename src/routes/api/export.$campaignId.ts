import { createFileRoute } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySessionCookieHeader } from "@/lib/auth.server";

export const Route = createFileRoute("/api/export/$campaignId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!verifySessionCookieHeader(request.headers.get("cookie"))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const id = params.campaignId;
        if (!/^[0-9a-f-]{36}$/i.test(id)) {
          return new Response("Bad id", { status: 400 });
        }

        const { data: campaign, error: cErr } = await supabaseAdmin
          .from("campaigns")
          .select("*")
          .eq("id", id)
          .single();
        if (cErr || !campaign) return new Response("Not found", { status: 404 });

        const { data: results } = await supabaseAdmin
          .from("campaign_results")
          .select("*")
          .eq("campaign_id", id)
          .eq("included", true)
          .eq("disqualified", false)
          .order("rank_position", { ascending: true });

        const targetPages =
          (campaign.target_pages as Array<{ url: string; keyword: string }>) ?? [];
        const firstUrl = targetPages[0]?.url ?? "";
        const firstKw = targetPages[0]?.keyword ?? "";

        const wb = XLSX.utils.book_new();

        // Tab 1 - Client Info
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
          "Notes 1",
          "Notes 2",
          "Notes 3",
          "Notes 4",
          "Notes 5",
          "Notes 6",
          "Notes 7",
          "Notes 8",
          "Notes 9",
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
          campaign.status,
          ...Array(9).fill(""),
        ];
        const ws1 = XLSX.utils.aoa_to_sheet([clientInfoHeaders, clientInfoRow]);
        XLSX.utils.book_append_sheet(wb, ws1, "Client Info");

        // Tab 2 - Target Pages
        const tp = [
          ["Target URL", "Primary Keyword", "Notes"],
          ...targetPages.map((p) => [p.url, p.keyword, ""]),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tp), "Target Pages");

        // Tab 3 - Campaign Management (32 cols)
        const cmHeaders = [
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
        const period = new Date().toLocaleString("en-US", { month: "short", year: "numeric" });
        const cmRows: (string | number)[][] = [cmHeaders];
        (results ?? []).forEach((r, idx) => {
          const row = idx + 2; // sheet row (1=header)
          cmRows.push([
            period,
            idx + 1,
            r.domain,
            r.dr ?? "",
            r.traffic ?? "",
            r.price ?? "",
            "",
            r.tat ?? "",
            firstUrl,
            firstKw,
            r.link_type ?? "",
            campaign.budget_per_link,
            // Profit formula: Budget (L) - Order Price (F)
            `=L${row}-F${row}` as unknown as string,
            "Pending",
            r.contact_email ?? "",
            ...Array(17).fill(""),
          ]);
        });
        const ws3 = XLSX.utils.aoa_to_sheet(cmRows);
        XLSX.utils.book_append_sheet(wb, ws3, "Campaign Management");

        // Tab 4 - Referring Domains
        const today = new Date().toISOString().slice(0, 10);
        const rdRows: (string | number)[][] = [
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
          ...(results ?? []).map((r) => [
            r.domain,
            r.dr ?? "",
            r.traffic ?? "",
            r.geo ?? "",
            r.link_type ?? "",
            r.price ?? "",
            r.tat ?? "",
            r.ranking ?? "",
            r.red_flags ?? "",
            r.contact_email ?? "",
            r.score ?? "",
            r.rank_position ?? "",
            today,
          ]),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rdRows), "Referring Domains");

        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

        // Mark campaign as exported (we regenerate on each download)
        await supabaseAdmin
          .from("campaigns")
          .update({ status: "exported", updated_at: new Date().toISOString() })
          .eq("id", id);

        const safeName = campaign.client_name.replace(/[^a-z0-9_-]+/gi, "_");
        const filename = `${safeName}_campaign_${today}.xlsx`;

        return new Response(new Uint8Array(buf), {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
