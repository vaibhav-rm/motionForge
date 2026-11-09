import { z } from "zod";
import { ProjectSchema } from "./scene.schema.js";
import { VideoPlanSchema } from "./plan.schema.js";

/**
 * Conversational edit instructions.
 *
 * The AI never rewrites the whole project for a targeted edit. It emits a
 * list of *operations* that are applied by deterministic code, which is how
 * the "preserve unrelated scenes" guarantee is enforced structurally rather
 * than by prompting.
 */

export const EditTargetSchema = z.enum([
  "project",
  "scene",
  "element",
  "selection",
]);
export type EditTarget = z.infer<typeof EditTargetSchema>;

export const EditOperationSchema = z.object({
  /**
   * The operation kind.
   * - `replaceScenes` replaces the full scene list.
   * - `updateScene` patches one scene.
   * - `addScene` inserts a scene at an index.
   * - `removeScene` deletes a scene by id.
   * - `reorderScenes` moves a scene to a new index.
   * - `updateStyle` patches the global style tokens.
   * - `updateElement` patches one element.
   * - `addElement` inserts an element into a scene.
   * - `removeElement` deletes an element.
   * - `setDuration` changes a scene duration.
   */
  op: z.enum([
    "replaceScenes",
    "updateScene",
    "addScene",
    "removeScene",
    "reorderScenes",
    "updateStyle",
    "updateElement",
    "addElement",
    "removeElement",
    "setDuration",
  ]),
  /** Scene id the operation applies to. */
  sceneId: z.string().nullable().default(null),
  /** Element id the operation applies to. */
  elementId: z.string().nullable().default(null),
  /** Insertion index for `addScene` / `addElement`. */
  index: z.number().int().min(0).max(10000).nullable().default(null),
  /** Partial scene patch. */
  scene: z.record(z.string(), z.any()).nullable().default(null),
  /** Partial element patch. */
  element: z.record(z.string(), z.any()).nullable().default(null),
  /** Partial style patch. */
  style: z.record(z.string(), z.any()).nullable().default(null),
  /** Replacement scene list for `replaceScenes`. */
  scenes: z.array(z.any()).nullable().default(null),
  /** Human readable description of the change. */
  note: z.string().default(""),
});
export type EditOperation = z.infer<typeof EditOperationSchema>;

/** A JSON-ish patch object. */
export type Patch = Record<string, unknown>;

/**
 * The construction-side shape of an operation.
 *
 * Every field except `op` has a default, so callers may omit them. This is
 * the type used when building an edit plan programmatically.
 */
export type EditOperationInput = z.input<typeof EditOperationSchema>;

export const EditPlanSchema = z.object({
  /** Short summary of the intent. */
  summary: z.string().default(""),
  operations: z.array(EditOperationSchema).default([]),
  /** When true, the operation list replaces the previous edit context. */
  reset: z.boolean().default(false),
});
export type EditPlan = z.infer<typeof EditPlanSchema>;

/** The construction-side shape of an edit plan. */
export type EditPlanInput = z.input<typeof EditPlanSchema>;

/**
 * A request envelope passed to the AI engine. Keeping request and response
 * shapes in the schema package lets the web app and the renderer share them.
 */
export const GenerationRequestSchema = z.object({
  /** The user's natural-language prompt. */
  prompt: z.string().min(1),
  /** Optional hard constraints extracted from the prompt. */
  targetDurationSeconds: z.number().min(1).max(600).nullable().default(null),
  targetWidth: z.number().int().min(16).max(7680).nullable().default(null),
  targetHeight: z.number().int().min(16).max(4320).nullable().default(null),
  targetFps: z.number().int().min(1).max(120).nullable().default(null),
  /** Assets available to the planner, by id. */
  availableAssets: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
      }),
    )
    .default([]),
});
export type GenerationRequest = z.infer<typeof GenerationRequestSchema>;

export const EditRequestSchema = z.object({
  /** The conversational instruction. */
  instruction: z.string().min(1),
  /** Current project state. */
  project: ProjectSchema,
  /** Scene the user has focused, if any. */
  focusedSceneId: z.string().nullable().default(null),
  /** Elements the user has selected, if any. */
  selectedElementIds: z.array(z.string()).default([]),
});
export type EditRequest = z.infer<typeof EditRequestSchema>;

export { ProjectSchema, VideoPlanSchema };
