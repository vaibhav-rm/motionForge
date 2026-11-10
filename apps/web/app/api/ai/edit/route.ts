import { NextRequest } from "next/server";
import { z } from "zod";
import { editProject } from "@motionforge/ai-engine";
import { addMessage, getProject, saveVersion } from "@motionforge/database";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { saveProject } from "@/lib/projects";
import { loadSettings, resolveAIConfig } from "@/lib/settings";

const schema = z.object({
  projectId: z.string().min(1),
  instruction: z.string().min(2).max(4000),
  focusedSceneId: z.string().nullable().optional(),
  selectedElementIds: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = await readJson(request, schema);
    if (!parsed.ok) return parsed.response;
    const { projectId, instruction, focusedSceneId, selectedElementIds } =
      parsed.data;

    const existing = await getProject(projectId, user.id);
    if (!existing) return jsonError("Project not found.", 404, "NOT_FOUND");

    await addMessage(projectId, "user", instruction, {
      kind: "edit",
      focusedSceneId,
    }).catch(() => {});

    const settings = await loadSettings();
    const result = await editProject(
      {
        instruction,
        project: existing,
        focusedSceneId: focusedSceneId ?? null,
        selectedElementIds: selectedElementIds ?? [],
      },
      {
        provider: resolveAIConfig(settings),
        temperature: settings.ai.temperature,
      },
    );

    // Preserve identity/metadata.
    const project = {
      ...result.project,
      id: existing.id,
      assets: existing.assets ?? [],
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveProject(user.id, project);
    if (result.changes.length > 0) {
      await saveVersion(saved.id, saved, `Edit: ${instruction.slice(0, 80)}`).catch(
        () => {},
      );
    }
    await addMessage(projectId, "assistant", result.summary, {
      kind: "edit",
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
