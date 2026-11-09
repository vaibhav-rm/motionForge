import { NextRequest } from "next/server";
import { z } from "zod";
import { ProjectSchema } from "@motionforge/video-schema";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import {
  deleteProject,
  getProject,
  renameProject,
  saveProject,
  setArchived,
} from "@/lib/projects";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await getProject(id, user.id);
    if (!project) return jsonError("Project not found.", 404, "NOT_FOUND");
    return jsonOk({ project });
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  project: ProjectSchema.optional(),
  name: z.string().max(120).optional(),
  archived: z.boolean().optional(),
  snapshot: z.boolean().optional(),
  note: z.string().max(500).optional(),
});

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const parsed = await readJson(request, patchSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    if (body.project) {
      if (body.project.id !== id) {
        return jsonError("Project ID mismatch.", 400, "ID_MISMATCH");
      }
      const saved = await saveProject(user.id, body.project, {
        snapshot: body.snapshot,
        note: body.note,
      });
      return jsonOk({ project: saved });
    }

    if (typeof body.name === "string") {
      await renameProject(id, user.id, body.name.trim() || "Untitled Project");
    }
    if (typeof body.archived === "boolean") {
      await setArchived(id, user.id, body.archived);
    }

    const project = await getProject(id, user.id);
    if (!project) return jsonError("Project not found.", 404, "NOT_FOUND");
    return jsonOk({ project });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const removed = await deleteProject(id, user.id);
    if (!removed) return jsonError("Project not found.", 404, "NOT_FOUND");
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
