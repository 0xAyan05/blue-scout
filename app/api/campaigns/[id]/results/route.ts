import { NextResponse } from "next/server";
import { getCampaignResults } from "@/lib/domain-selector";
import { jsonError } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const results = await getCampaignResults(params.id);
    return NextResponse.json(results);
  } catch (error) {
    return jsonError(error, "Could not load campaign results.", "CAMPAIGN_RESULTS_FAILED");
  }
}
