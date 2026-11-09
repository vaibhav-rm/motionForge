import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { duplicateProject } from "@/lib/projects";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await duplicateProject(id, user.id);
    if (!project) return jsonError("Project not found.", 404, "NOT_FOUND");
    return jsonOk({ project }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
