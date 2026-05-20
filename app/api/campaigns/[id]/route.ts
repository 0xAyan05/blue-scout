import { NextResponse } from "next/server";
import { deleteCampaign, getCampaign } from "@/lib/domain-selector";
import { jsonError } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const campaign = await getCampaign(params.id);
    return NextResponse.json(campaign);
  } catch (error) {
    return jsonError(error, "Could not load campaign.", "CAMPAIGN_NOT_FOUND");
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteCampaign(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error, "Could not delete campaign.", "CAMPAIGN_DELETE_FAILED");
  }
}
