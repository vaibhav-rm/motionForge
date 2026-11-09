import { z } from "zod";
import {
  BackgroundSchema,
  ElementSchema,
  VisualStyleSchema,
} from "./element.schema.js";
import { CameraMoveSchema, TransitionSchema } from "./animation.schema.js";

/**
 * A single scene in the project. Scenes are the atomic unit of editing:
 * changing one scene must never mutate another, which is enforced by the
 * deep-clone-on-write helpers in `packages/shared`.
 */

/** Audio attached to a scene. */
export const SceneAudioSchema = z.object({
  assetId: z.string().min(1),
  /** Scene-relative start offset in frames. */
  offsetInFrames: z.number().int().min(0).max(100000).default(0),
  /** Trim length in frames; null = full asset. */
  durationInFrames: z.number().int().min(1).max(100000).nullable().default(null),
  volume: z.number().min(0).max(2).default(1),
  fadeInInFrames: z.number().int().min(0).max(300).default(0),
  fadeOutInFrames: z.number().int().min(0).max(300).default(0),
});
export type SceneAudio = z.infer<typeof SceneAudioSchema>;

export const SceneSchema = z.object({
  id: z.string().min(1),
  /** Display name, e.g. "Opening". */
  name: z.string().min(1).default("Scene"),
  /** Position in the project; kept contiguous and zero-based. */
  order: z.number().int().min(0).max(10000).default(0),
  /** Scene length in frames. */
  durationInFrames: z.number().int().min(1).max(100000).default(150),
  /** Optional short description shown in the timeline. */
  description: z.string().default(""),
  background: BackgroundSchema.default(BackgroundSchema.parse({})),
  camera: CameraMoveSchema.default(CameraMoveSchema.parse({})),
  /** Transition into the *next* scene. */
  transition: TransitionSchema.default(TransitionSchema.parse({})),
  elements: z.array(ElementSchema).default([]),
  audio: z.array(SceneAudioSchema).default([]),
  /** Free-form notes captured from the AI assistant. */
  notes: z.string().default(""),
});
export type Scene = z.infer<typeof SceneSchema>;

/**
 * An asset reference embedded in the project.
 *
 * The URL is resolved by the host application (web preview or renderer) so
 * the same project document works against local files or object storage.
 */
export const ProjectAssetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** `image` | `video` | `audio` | `other`. */
  type: z.enum(["image", "video", "audio", "other"]).default("other"),
  /** MIME type when known. */
  mimeType: z.string().default(""),
  /** Resolved URL for playback. */
  url: z.string().default(""),
  /** Intrinsic size for images. */
  width: z.number().int().min(0).nullable().default(null),
  height: z.number().int().min(0).nullable().default(null),
  /** Duration in frames for audio/video. */
  durationInFrames: z.number().int().min(0).nullable().default(null),
  /** Size in bytes. */
  size: z.number().int().min(0).default(0),
});
export type ProjectAsset = z.infer<typeof ProjectAssetSchema>;

/**
 * Project-level audio (music beds, voiceover) that spans the whole video.
 */
export const ProjectAudioSchema = z.object({
  assetId: z.string().min(1),
  name: z.string().default("Track"),
  volume: z.number().min(0).max(2).default(0.6),
  /** Start offset relative to project start, in frames. */
  offsetInFrames: z.number().int().min(0).max(100000).default(0),
  durationInFrames: z.number().int().min(1).max(100000).nullable().default(null),
  fadeInInFrames: z.number().int().min(0).max(300).default(0),
  fadeOutInFrames: z.number().int().min(0).max(300).default(0),
  /** Loop the track for the full project duration. */
  loop: z.boolean().default(false),
});
export type ProjectAudio = z.infer<typeof ProjectAudioSchema>;

/**
 * The complete, editable description of a video. This object is the single
 * source of truth: the preview, the renderer, the timeline and the inspector
 * all read from it, and the AI only ever produces validated instances of it.
 */
export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).default("Untitled Project"),
  description: z.string().default(""),
  /** Canvas frame rate. */
  fps: z.number().int().min(1).max(120).default(30),
  /** Canvas width in pixels. */
  width: z.number().int().min(16).max(7680).default(1920),
  /** Canvas height in pixels. */
  height: z.number().int().min(16).max(4320).default(1080),
  /** Global visual style tokens. */
  style: VisualStyleSchema.default(VisualStyleSchema.parse({})),
  scenes: z.array(SceneSchema).default([]),
  /** Assets available to this project, resolved to playable URLs. */
  assets: z.array(ProjectAssetSchema).default([]),
  /** Project-level audio that spans the whole video. */
  audio: z.array(ProjectAudioSchema).default([]),
  /** Schema version, used to migrate older projects forward. */
  schemaVersion: z.number().int().min(1).default(1),
  /** ISO timestamp of creation. */
  createdAt: z.string().default(""),
  /** ISO timestamp of the last modification. */
  updatedAt: z.string().default(""),
});
export type Project = z.infer<typeof ProjectSchema>;
