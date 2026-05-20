import { NextResponse } from "next/server";
import { campaignCreateSchema, createCampaign } from "@/lib/domain-selector";
import { jsonError } from "@/lib/route-handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const campaign = await createCampaign(campaignCreateSchema.parse(body));
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    return jsonError(error, "Could not create campaign.", "CAMPAIGN_CREATE_FAILED");
  }
}
