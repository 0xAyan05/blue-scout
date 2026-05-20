import { createFileRoute } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function jsonError(message: string, code: string, status: number) {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/export/$campaignId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const id = params.campaignId;
          if (!/^[0-9a-f-]{36}$/i.test(id)) {
            return jsonError("Invalid campaign id.", "INVALID_CAMPAIGN_ID", 400);
          }

          const { data: campaign, error: campaignError } = await supabaseAdmin
            .from("campaigns")
            .select("*")
            .eq("id", id)
            .single();
          if (campaignError || !campaign) {
            return jsonError("Campaign not found.", "CAMPAIGN_NOT_FOUND", 404);
          }

          const { data: results, error: resultsError } = await supabaseAdmin
            .from("campaign_results")
            .select("*")
            .eq("campaign_id", id)
            .eq("included", true)
            .eq("disqualified", false)
            .order("rank_position", { ascending: true });
          if (resultsError) {
            console.error(resultsError);
            return jsonError("Export failed. Please try again.", "EXPORT_FAILED", 500);
          }

          const targetPages =
            (campaign.target_pages as Array<{ url: string; keyword: string }>) ?? [];
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
            campaign.status,
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

          const fileBuffer = XLSX.write(workbook, {
            type: "buffer",
            bookType: "xlsx",
          }) as Buffer;

          const { error: exportInsertError } = await supabaseAdmin
            .from("campaign_exports")
            .insert({
              campaign_id: id,
              file_data: fileBuffer,
            });
          if (exportInsertError) {
            console.error(exportInsertError);
          }

          await supabaseAdmin
            .from("campaigns")
            .update({
              status: "exported",
              updated_at: new Date().toISOString(),
            })
            .eq("id", id);

          const safeClientName = campaign.client_name.replace(/[^a-z0-9_-]+/gi, "_");
          const filename = `${safeClientName}_campaign_${today}.xlsx`;

          return new Response(new Uint8Array(fileBuffer), {
            status: 200,
            headers: {
              "Content-Type":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Content-Disposition": `attachment; filename="${filename}"`,
              "Cache-Control": "no-store",
            },
          });
        } catch (error) {
          console.error(error);
          return jsonError("Export failed. Please try again.", "EXPORT_FAILED", 500);
        }
      },
    },
  },
});
