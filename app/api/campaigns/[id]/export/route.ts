import { NextResponse } from "next/server";
import { buildCampaignExport } from "@/lib/domain-selector";
import { jsonError } from "@/lib/route-handler";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { buffer, filename } = await buildCampaignExport(params.id);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error, "Export failed. Please try again.", "EXPORT_FAILED");
  }
}
