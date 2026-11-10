import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonOk, readJson } from "@/lib/api";
import {
  loadSettings,
  publicSettings,
  saveSettings,
  SettingsUpdateSchema,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const settings = await loadSettings();
    return jsonOk({ settings: publicSettings(settings) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireUser();
    const parsed = await readJson(request, SettingsUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const saved = await saveSettings(parsed.data);
    return jsonOk({ settings: publicSettings(saved) });
  } catch (error) {
    return handleApiError(error);
  }
}
