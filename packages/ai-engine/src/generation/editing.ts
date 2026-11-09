import {
  ElementSchema,
  EditPlanSchema,
  normaliseSceneOrder,
  ProjectSchema,
  SceneSchema,
  type EditOperation,
  type EditPlanInput,
  type Element,
  type Project,
  type Scene,
} from "@motionforge/video-schema";

/**
 * Edit operation executor.
 *
 * Applies an edit plan to a project. Every operation is scoped: a scene
 * operation touches exactly one scene, an element operation touches exactly
 * one element. Scenes that are not named by an operation are carried over
 * byte-for-byte, which is what makes "preserve unrelated scenes" a
 * structural guarantee rather than a hope.
 */

export interface EditOutcome {
  project: Project;
  changes: string[];
}

/** Apply an edit plan, returning the updated project and a change list. */
export function applyEditPlan(
  project: Project,
  plan: EditPlanInput,
): EditOutcome {
  // Normalise the plan through the schema so every operation has a complete
  // shape before it is applied.
  const normalised = EditPlanSchema.parse(plan);

  let working: Project = structuredClone(project);
  const changes: string[] = [];

  for (const operation of normalised.operations) {
    const result = applyOperation(working, operation);
    working = result.project;
    if (result.note) changes.push(result.note);
  }

  working = ProjectSchema.parse({
    ...working,
    scenes: normaliseSceneOrder(working.scenes),
    updatedAt: new Date().toISOString(),
  });

  return { project: working, changes };
}

/** Apply a single operation. */
function applyOperation(
  project: Project,
  operation: EditOperation,
): { project: Project; note: string | null } {
  switch (operation.op) {
    case "replaceScenes": {
      if (!operation.scenes) return { project, note: null };
      const scenes = operation.scenes
        .map((raw) => SceneSchema.safeParse(raw))
        .filter((result) => result.success)
        .map((result) => result.data);
      if (scenes.length === 0) return { project, note: null };
      return {
        project: { ...project, scenes: normaliseSceneOrder(scenes) },
        note: operation.note || `Replaced the scene list with ${scenes.length} scenes.`,
      };
    }

    case "updateScene": {
      if (!operation.sceneId || !operation.scene) {
        return { project, note: null };
      }
      const patch = operation.scene as Record<string, unknown>;
      const scenes = project.scenes.map((scene) =>
        scene.id === operation.sceneId ? mergeScene(scene, patch) : scene,
      );
      return {
        project: { ...project, scenes },
        note:
          operation.note ||
          `Updated scene "${project.scenes.find((s) => s.id === operation.sceneId)?.name ?? operation.sceneId}".`,
      };
    }

    case "addScene": {
      const raw = operation.scene;
      if (!raw) return { project, note: null };
      const parsed = SceneSchema.safeParse(raw);
      if (!parsed.success) return { project, note: null };
      const scenes = [...project.scenes];
      const index =
        operation.index === null
          ? scenes.length
          : Math.max(0, Math.min(scenes.length, operation.index));
      scenes.splice(index, 0, parsed.data);
      return {
        project: { ...project, scenes: normaliseSceneOrder(scenes) },
        note: operation.note || `Added scene "${parsed.data.name}".`,
      };
    }

    case "removeScene": {
      if (!operation.sceneId) return { project, note: null };
      const target = project.scenes.find((s) => s.id === operation.sceneId);
      if (!target) return { project, note: null };
      const scenes = project.scenes.filter((s) => s.id !== operation.sceneId);
      if (scenes.length === 0) return { project, note: null };
      return {
        project: { ...project, scenes: normaliseSceneOrder(scenes) },
        note: operation.note || `Removed scene "${target.name}".`,
      };
    }

    case "reorderScenes": {
      if (!operation.sceneId || operation.index === null) {
        return { project, note: null };
      }
      const scenes = [...project.scenes];
      const fromIndex = scenes.findIndex((s) => s.id === operation.sceneId);
      if (fromIndex === -1) return { project, note: null };
      const [moved] = scenes.splice(fromIndex, 1);
      const toIndex = Math.max(0, Math.min(scenes.length, operation.index));
      scenes.splice(toIndex, 0, moved);
      return {
        project: { ...project, scenes: normaliseSceneOrder(scenes) },
        note: operation.note || `Moved "${moved.name}" to position ${toIndex + 1}.`,
      };
    }

    case "updateStyle": {
      if (!operation.style) return { project, note: null };
      const style = mergeDeep(
        project.style as unknown as Record<string, unknown>,
        operation.style as Record<string, unknown>,
      ) as unknown as Project["style"];
      return {
        project: { ...project, style },
        note: operation.note || "Updated the project style.",
      };
    }

    case "updateElement": {
      if (!operation.sceneId || !operation.elementId || !operation.element) {
        return { project, note: null };
      }
      const sceneId = operation.sceneId;
      const elementId = operation.elementId;
      const patch = operation.element as Record<string, unknown>;
      const scenes = project.scenes.map((scene) => {
        if (scene.id !== sceneId) return scene;
        return {
          ...scene,
          elements: scene.elements.map((element) =>
            element.id === elementId ? mergeElement(element, patch) : element,
          ),
        };
      });
      const scene = project.scenes.find((s) => s.id === operation.sceneId);
      const element = scene?.elements.find((e) => e.id === operation.elementId);
      return {
        project: { ...project, scenes },
        note:
          operation.note ||
          `Updated "${element?.name ?? operation.elementId}" in "${scene?.name ?? operation.sceneId}".`,
      };
    }

    case "addElement": {
      if (!operation.sceneId || !operation.element) {
        return { project, note: null };
      }
      const parsed = ElementSchema.safeParse(operation.element);
      if (!parsed.success) return { project, note: null };
      const scenes = project.scenes.map((scene) => {
        if (scene.id !== operation.sceneId) return scene;
        const elements = [...scene.elements];
        const index =
          operation.index === null
            ? elements.length
            : Math.max(0, Math.min(elements.length, operation.index));
        elements.splice(index, 0, parsed.data);
        return { ...scene, elements };
      });
      return {
        project: { ...project, scenes },
        note: operation.note || `Added "${parsed.data.name}".`,
      };
    }

    case "removeElement": {
      if (!operation.sceneId || !operation.elementId) {
        return { project, note: null };
      }
      const scenes = project.scenes.map((scene) =>
        scene.id === operation.sceneId
          ? {
              ...scene,
              elements: scene.elements.filter(
                (element) => element.id !== operation.elementId,
              ),
            }
          : scene,
      );
      return {
        project: { ...project, scenes },
        note: operation.note || "Removed the element.",
      };
    }

    case "setDuration": {
      if (!operation.sceneId || !operation.scene) return { project, note: null };
      const patch = operation.scene as { durationInFrames?: number };
      if (
        typeof patch.durationInFrames !== "number" ||
        !Number.isFinite(patch.durationInFrames)
      ) {
        return { project, note: null };
      }
      const frames = Math.max(1, Math.round(patch.durationInFrames));
      const scenes = project.scenes.map((scene) =>
        scene.id === operation.sceneId
          ? { ...scene, durationInFrames: frames }
          : scene,
      );
      const target = project.scenes.find((s) => s.id === operation.sceneId);
      return {
        project: { ...project, scenes },
        note:
          operation.note ||
          `Set "${target?.name ?? operation.sceneId}" to ${Math.round(
            (frames / project.fps) * 10,
          ) / 10}s.`,
      };
    }

    default:
      return { project, note: null };
  }
}

/**
 * Merge a partial patch into a scene.
 *
 * Nested objects (background, camera, transition, animation) are merged one
 * level deep so a patch like `{ camera: { zoomFrom: 1.2 } }` does not wipe
 * out the other camera values.
 */
function mergeScene(
  scene: Scene,
  patch: Record<string, unknown>,
): Scene {
  const merged: Record<string, unknown> = { ...scene, ...patch };

  for (const key of ["background", "camera", "transition"] as const) {
    const patchValue = patch[key];
    if (patchValue && typeof patchValue === "object" && !Array.isArray(patchValue)) {
      merged[key] = {
        ...(scene[key] as unknown as Record<string, unknown>),
        ...(patchValue as Record<string, unknown>),
      };
    }
  }

  return SceneSchema.parse(merged);
}

/** Merge a partial patch into an element. */
function mergeElement(
  element: Element,
  patch: Record<string, unknown>,
): Element {
  const merged: Record<string, unknown> = { ...element, ...patch };

  if (patch.animation && typeof patch.animation === "object") {
    const animation = patch.animation as Record<string, unknown>;
    merged.animation = {
      ...element.animation,
      ...animation,
      ...(animation.entrance && typeof animation.entrance === "object"
        ? {
            entrance: {
              ...element.animation.entrance,
              ...(animation.entrance as Record<string, unknown>),
            },
          }
        : {}),
      ...(animation.exit && typeof animation.exit === "object"
        ? {
            exit: {
              ...element.animation.exit,
              ...(animation.exit as Record<string, unknown>),
            },
          }
        : {}),
      ...(animation.loop && typeof animation.loop === "object"
        ? {
            loop: {
              ...element.animation.loop,
              ...(animation.loop as Record<string, unknown>),
            },
          }
        : {}),
    };
  }

  return ElementSchema.parse(merged);
}

/** Recursive merge used for style patches. */
function mergeDeep(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === "object" &&
      !Array.isArray(base[key])
    ) {
      result[key] = mergeDeep(
        base[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}
