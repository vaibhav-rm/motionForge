import { z } from "zod";
import { ProjectSchema } from "./scene.schema.js";
import { VideoPlanSchema } from "./plan.schema.js";

/**
 * Validation helpers.
 *
 * All AI output passes through these functions before it can reach the
 * renderer. Nothing unvalidated is ever composed.
 */

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T; issues: [] }
  | { ok: false; value: null; issues: ValidationIssue[] };

const formatIssues = (error: z.ZodError): ValidationIssue[] =>
  error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));

/** Validate an AI-produced plan. */
export function validatePlan(
  input: unknown,
): ValidationResult<z.infer<typeof VideoPlanSchema>> {
  const result = VideoPlanSchema.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data, issues: [] };
  }
  return { ok: false, value: null, issues: formatIssues(result.error) };
}

/** Validate a full project before it is persisted or rendered. */
export function validateProject(
  input: unknown,
): ValidationResult<z.infer<typeof ProjectSchema>> {
  const result = ProjectSchema.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data, issues: [] };
  }
  return { ok: false, value: null, issues: formatIssues(result.error) };
}

/**
 * Structural checks that a plain schema cannot express.
 * Returns a list of human-readable problems; an empty list means the project
 * is safe to render.
 */
export function inspectProject(project: z.infer<typeof ProjectSchema>): string[] {
  const problems: string[] = [];

  if (project.scenes.length === 0) {
    problems.push("Project has no scenes.");
    return problems;
  }

  const seenIds = new Set<string>();
  for (const scene of project.scenes) {
    if (seenIds.has(scene.id)) {
      problems.push(`Duplicate scene id "${scene.id}".`);
    }
    seenIds.add(scene.id);

    if (scene.durationInFrames <= 0) {
      problems.push(`Scene "${scene.name}" has a non-positive duration.`);
    }

    if (scene.transition.durationInFrames >= scene.durationInFrames) {
      problems.push(
        `Scene "${scene.name}" transition is longer than the scene itself.`,
      );
    }

    const elementIds = new Set<string>();
    for (const element of scene.elements) {
      if (elementIds.has(element.id)) {
        problems.push(
          `Duplicate element id "${element.id}" in scene "${scene.name}".`,
        );
      }
      elementIds.add(element.id);

      if (
        (element.type === "image" || element.type === "video") &&
        !element.assetId
      ) {
        problems.push(
          `Element "${element.name}" in scene "${scene.name}" is missing an asset reference.`,
        );
      }
    }
  }

  const orders = project.scenes.map((scene) => scene.order);
  const sorted = [...orders].sort((a, b) => a - b);
  if (sorted.some((value, index) => value !== index)) {
    problems.push("Scene order values are not contiguous.");
  }

  return problems;
}

/** Total project length in frames. */
export function projectDurationInFrames(
  project: z.infer<typeof ProjectSchema>,
): number {
  return project.scenes.reduce(
    (total, scene) => total + scene.durationInFrames,
    0,
  );
}

/** Total project length in seconds. */
export function projectDurationInSeconds(
  project: z.infer<typeof ProjectSchema>,
): number {
  return projectDurationInFrames(project) / project.fps;
}
