import { NextResponse } from "next/server";
import { configSaveSchema, getActiveConfig, listConfigs, saveNewConfig } from "@/lib/domain-selector";
import { jsonError } from "@/lib/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [active, history] = await Promise.all([getActiveConfig(), listConfigs()]);
    return NextResponse.json(
      { active, history },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    return jsonError(error, "Could not load config.", "CONFIG_LOAD_FAILED");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config = await saveNewConfig(configSaveSchema.parse(body));
    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    return jsonError(error, "Could not save config.", "CONFIG_SAVE_FAILED");
  }
}
