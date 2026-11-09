import type { z } from "zod";
import {
  BackgroundSchema,
  ElementBaseSchema,
  ElementSchema,
  TextElementSchema,
  VisualStyleSchema,
} from "./element.schema.js";
import {
  AnimationSchema,
  CameraMoveSchema,
  TransitionSchema,
} from "./animation.schema.js";
import type { Element } from "./element.schema.js";
import type { Project, Scene } from "./scene.schema.js";
import { ProjectSchema, SceneSchema } from "./scene.schema.js";

/**
 * Factory helpers and defaults.
 *
 * Centralising defaults here keeps the AI planner, the editor and the
 * renderer producing byte-identical structures for the same intent.
 */

let idCounter = 0;

/**
 * Generate a short, collision-resistant id.
 * Uses `crypto.randomUUID` when available and falls back to a counter.
 */
export function createId(prefix = "id"): string {
  const globalCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return `${prefix}_${globalCrypto.randomUUID().slice(0, 8)}`;
  }
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

/** Default visual style used when nothing else is specified. */
export function defaultStyle(): z.infer<typeof VisualStyleSchema> {
  return VisualStyleSchema.parse({});
}

/** Default background for a scene. */
export function defaultBackground(): z.infer<typeof BackgroundSchema> {
  return BackgroundSchema.parse({});
}

/** Default camera move (static). */
export function defaultCamera(): z.infer<typeof CameraMoveSchema> {
  return CameraMoveSchema.parse({});
}

/** Default transition. */
export function defaultTransition(): z.infer<typeof TransitionSchema> {
  return TransitionSchema.parse({});
}

/** Default animation block. */
export function defaultAnimation(): z.infer<typeof AnimationSchema> {
  return AnimationSchema.parse({});
}

/** Base element fields with sensible overrides. */
export function defaultElementBase(
  overrides: Partial<z.infer<typeof ElementBaseSchema>> = {},
): z.infer<typeof ElementBaseSchema> {
  return ElementBaseSchema.parse(overrides);
}

/** Create a text element with defaults applied. */
export function createTextElement(
  text: string,
  overrides: Partial<z.infer<typeof TextElementSchema>> = {},
): Element {
  return TextElementSchema.parse({
    id: createId("el"),
    type: "text",
    name: text.slice(0, 32) || "Text",
    text,
    ...overrides,
  });
}

/** Create a blank scene. */
export function createScene(
  overrides: Partial<z.infer<typeof SceneSchema>> = {},
): Scene {
  return SceneSchema.parse({
    id: createId("sc"),
    name: "New Scene",
    durationInFrames: 150,
    ...overrides,
  });
}

/** Create a blank project. */
export function createProject(
  overrides: Partial<z.infer<typeof ProjectSchema>> = {},
): Project {
  return ProjectSchema.parse({
    id: createId("prj"),
    name: "Untitled Project",
    width: 1920,
    height: 1080,
    fps: 30,
    scenes: [],
    ...overrides,
  });
}

/** Re-index scene order values to be contiguous and match array order. */
export function normaliseSceneOrder(scenes: Scene[]): Scene[] {
  return scenes.map((scene, index) => ({ ...scene, order: index }));
}

/**
 * Deep clone a project. Used before mutations so that undo/redo snapshots
 * and "preserve unrelated scenes" both hold.
 */
export function cloneProject(project: Project): Project {
  return structuredClone(project);
}

/** Deep clone a scene. */
export function cloneScene(scene: Scene): Scene {
  return structuredClone(scene);
}

/** Deep clone an element. */
export function cloneElement(element: Element): Element {
  return structuredClone(element);
}

/**
 * Parse arbitrary (possibly AI-generated) input into a valid element.
 * Returns `null` when the input cannot be coerced into a known element type.
 */
export function coerceElement(input: unknown): Element | null {
  const result = ElementSchema.safeParse(input);
  return result.success ? result.data : null;
}

export {
  BackgroundSchema,
  ElementBaseSchema,
  ElementSchema,
  TextElementSchema,
  VisualStyleSchema,
};
