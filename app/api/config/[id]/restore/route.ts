import { NextResponse } from "next/server";
import { restoreConfig } from "@/lib/domain-selector";
import { jsonError } from "@/lib/route-handler";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const result = await restoreConfig(params.id);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Could not restore config.", "CONFIG_RESTORE_FAILED");
  }
}
