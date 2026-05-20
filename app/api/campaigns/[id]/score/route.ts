import { NextResponse } from "next/server";
import { runCampaignScoringToCompletion } from "@/lib/domain-selector";
import { jsonError } from "@/lib/route-handler";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const result = await runCampaignScoringToCompletion(params.id);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Scoring failed. Check the server logs.", "SCORING_FAILED");
  }
}
