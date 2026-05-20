import { NextResponse } from "next/server";
import { AppError, uploadInventoryCsv } from "@/lib/domain-selector";
import { jsonError } from "@/lib/route-handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("No CSV file provided.", "UPLOAD_PARSE_ERROR", 400);
    }

    const result = await uploadInventoryCsv(await file.text());
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return jsonError(error, "Upload failed.", "UPLOAD_FAILED");
  }
}
