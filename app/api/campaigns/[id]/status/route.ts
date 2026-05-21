import { NextResponse } from "next/server";
import { getCampaignStatus } from "@/lib/domain-selector";
import { jsonError } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const status = await getCampaignStatus(params.id);
    return NextResponse.json(status, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    return jsonError(error, "Could not load campaign status.", "CAMPAIGN_STATUS_FAILED");
  }
}
