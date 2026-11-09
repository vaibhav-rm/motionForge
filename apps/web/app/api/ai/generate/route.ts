import { NextRequest } from "next/server";
import { z } from "zod";
import { generateProject } from "@motionforge/ai-engine";
import { addMessage, getProject, saveVersion } from "@motionforge/database";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { saveProject } from "@/lib/projects";

const schema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(3).max(8000),
  targetDurationSeconds: z.number().min(1).max(600).nullable().optional(),
  aspectRatio: z
    .enum(["16:9", "9:16", "1:1", "4:5"])
    .nullable()
    .optional(),
});

const ASPECT: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = await readJson(request, schema);
    if (!parsed.ok) return parsed.response;
    const { projectId, prompt, targetDurationSeconds, aspectRatio } = parsed.data;

    const existing = await getProject(projectId, user.id);
    if (!existing) return jsonError("Project not found.", 404, "NOT_FOUND");

    await addMessage(projectId, "user", prompt, { kind: "generate" }).catch(() => {});

    const dims = aspectRatio ? ASPECT[aspectRatio] : null;
    const result = await generateProject({
      prompt,
      targetDurationSeconds: targetDurationSeconds ?? null,
      targetWidth: dims?.width ?? existing.width,
      targetHeight: dims?.height ?? existing.height,
      targetFps: existing.fps,
      availableAssets: (existing.assets ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
      })),
    });

    // Preserve project identity and carry over assets.
    const project = {
      ...result.project,
      id: existing.id,
      name: result.project.name === "Untitled Project" ? existing.name : result.project.name,
      assets: existing.assets ?? [],
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveProject(user.id, project);
    await saveVersion(saved.id, saved, "AI generation").catch(() => {});
    await addMessage(projectId, "assistant", result.summary, {
      kind: "generate",
      changes: result.changes,
      provider: result.provider,
    }).catch(() => {});

    return jsonOk({
      project: saved,
      summary: result.summary,
      changes: result.changes,
      provider: result.provider,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
