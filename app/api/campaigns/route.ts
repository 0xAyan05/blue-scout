import { NextResponse } from "next/server";
import { listCampaigns } from "@/lib/domain-selector";
import { jsonError } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const campaigns = await listCampaigns();
    return NextResponse.json(campaigns, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    return jsonError(error, "Could not load campaigns.", "CAMPAIGNS_LIST_FAILED");
  }
}
