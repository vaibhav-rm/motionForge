import { NextRequest } from "next/server";
import { addMessage, getProject, listMessages } from "@motionforge/database";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await getProject(id, user.id);
    if (!project) return jsonError("Project not found.", 404, "NOT_FOUND");
    const messages = await listMessages(id, 200);
    return jsonOk({ messages });
  } catch (error) {
    return handleApiError(error);
  }
}
