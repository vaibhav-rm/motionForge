import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonOk, readJson } from "@/lib/api";
import {
  createBlankProject,
  listProjects,
  duplicateProject,
} from "@/lib/projects";

export async function GET() {
  try {
    const user = await requireUser();
    const projects = await listProjects(user.id);
    return jsonOk({ projects });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  duplicateFrom: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = await readJson(request, createSchema);
    if (!parsed.ok) return parsed.response;
    const { name, description, duplicateFrom } = parsed.data;

    if (duplicateFrom) {
      const copy = await duplicateProject(duplicateFrom, user.id);
      if (!copy) return jsonOk({ project: null }, 404);
      return jsonOk({ project: copy }, 201);
    }

    const project = await createBlankProject(user.id, { name, description });
    return jsonOk({ project }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
