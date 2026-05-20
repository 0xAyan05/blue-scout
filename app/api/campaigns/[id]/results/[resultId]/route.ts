import { NextResponse } from "next/server";
import { z } from "zod";
import { toggleResultIncluded } from "@/lib/domain-selector";
import { jsonError } from "@/lib/route-handler";

export const runtime = "nodejs";

const bodySchema = z.object({
  included: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; resultId: string } },
) {
  try {
    const body = bodySchema.parse(await request.json());
    const result = await toggleResultIncluded(params.id, params.resultId, body.included);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Could not update result.", "RESULT_UPDATE_FAILED");
  }
}
