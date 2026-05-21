import { NextResponse } from "next/server";
import { getInventoryStatus } from "@/lib/domain-selector";
import { jsonError } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getInventoryStatus();
    return NextResponse.json(status, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    return jsonError(error, "Could not load inventory status.", "INVENTORY_STATUS_FAILED");
  }
}
