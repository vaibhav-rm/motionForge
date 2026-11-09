import { z } from "zod";
import { ProjectSchema } from "./scene.schema.js";

/**
 * The *plan* is what the AI produces. It is deliberately smaller and more
 * semantic than the full project: it describes intent (beats, emphasis,
 * pacing) rather than pixel coordinates. A deterministic compiler then
 * expands a plan into a concrete `Project`.
 *
 * This separation is the core safety property of MotionForge: the model
 * never emits executable code, only data that passes through a validator.
 */

/** A beat inside a scene: the thing the viewer should be looking at. */
export const BeatSchema = z.object({
  /** What the beat communicates, in plain language. */
  intent: z.string().min(1),
  /** Optional short on-screen copy. */
  onScreenText: z.string().default(""),
  /** Optional secondary line (caption, subhead). */
  supportingText: z.string().default(""),
  /** Emphasis level drives scale + motion intensity. */
  emphasis: z.enum(["low", "medium", "high"]).default("medium"),
  /** Recommended dwell time in seconds. */
  durationSeconds: z.number().min(0.2).max(60).default(3),
});
export type Beat = z.infer<typeof BeatSchema>;

/** The visual idea for a scene. */
export const ScenePlanSchema = z.object({
  /** Short scene name, e.g. "Node Bloom". */
  name: z.string().min(1),
  /** What happens in the scene. */
  summary: z.string().min(1),
  /** Recommended scene length in seconds. */
  durationSeconds: z.number().min(0.5).max(120).default(4),
  /** Background treatment for this scene. */
  background: z.enum([
    "solid",
    "linearGradient",
    "radialGradient",
    "mesh",
    "grid",
    "dots",
    "noise",
  ]).default("linearGradient"),
  /** Primary content archetype rendered in this scene. */
  visual: z.enum([
    "title",
    "statement",
    "network",
    "diagram",
    "chart",
    "particles",
    "abstractShapes",
    "code",
    "process",
    "quote",
    "countdown",
    "comparison",
  ]).default("statement"),
  /** Content data for chart / diagram visuals. */
  data: z
    .object({
      series: z
        .array(
          z.object({
            label: z.string().default(""),
            value: z.number().default(0),
          }),
        )
        .default([]),
      nodes: z
        .array(
          z.object({
            label: z.string().default(""),
            sublabel: z.string().default(""),
          }),
        )
        .default([]),
      /** Free-form lines of code for the `code` visual. */
      lines: z.array(z.string()).default([]),
    })
    .default({ series: [], nodes: [], lines: [] }),
  /** Beats inside the scene. */
  beats: z.array(BeatSchema).default([]),
  /** Suggested transition into the next scene. */
  transition: z.enum([
    "none",
    "fade",
    "slideLeft",
    "slideRight",
    "slideUp",
    "wipeLeft",
    "wipeRight",
    "circle",
    "clockWipe",
    "zoomBlur",
  ]).default("fade"),
  /** Optional camera direction: how the frame should move. */
  camera: z
    .enum(["static", "zoomIn", "zoomOut", "panLeft", "panRight", "drift"])
    .default("static"),
});
export type ScenePlan = z.infer<typeof ScenePlanSchema>;

/** Palette choice for a plan, expressed as semantic tokens. */
export const PlanPaletteSchema = z.object({
  background: z.string().default("#07090f"),
  surface: z.string().default("#11151f"),
  primary: z.string().default("#5eead4"),
  secondary: z.string().default("#818cf8"),
  text: z.string().default("#f8fafc"),
  muted: z.string().default("#64748b"),
});
export type PlanPalette = z.infer<typeof PlanPaletteSchema>;

export const VideoPlanSchema = z.object({
  /** The user's original prompt, retained for provenance. */
  prompt: z.string().default(""),
  /** Title card copy. */
  title: z.string().default(""),
  /** Optional subtitle / kicker. */
  subtitle: z.string().default(""),
  /** Visual style name. */
  styleName: z.string().default("Cinematic Dark"),
  /** One-line style description. */
  styleDescription: z.string().default(""),
  /** Mood keywords that influence pacing and audio suggestions. */
  mood: z.array(z.string()).default([]),
  palette: PlanPaletteSchema.default(PlanPaletteSchema.parse({})),
  /** Global grain/vignette/glow intent. */
  grain: z.number().min(0).max(1).default(0.06),
  vignette: z.number().min(0).max(1).default(0.35),
  glow: z.number().min(0).max(1).default(0.4),
  scenes: z.array(ScenePlanSchema).min(1).max(60),
  /** Optional project-level audio direction. */
  musicDirection: z.string().default(""),
  /** Sound effect suggestions keyed by scene index. */
  soundEffects: z.array(z.string()).default([]),
});
export type VideoPlan = z.infer<typeof VideoPlanSchema>;

/**
 * The result of a generation or edit operation. `project` is the new full
 * project; `changes` explains what moved so the UI can surface a diff.
 */
export const GenerationResultSchema = z.object({
  project: ProjectSchema,
  /** Human-readable summary of the changes that were applied. */
  summary: z.string().default(""),
  /** Individual change notes for the activity feed. */
  changes: z.array(z.string()).default([]),
  /** Which provider produced this result. */
  provider: z.string().default("local"),
});
export type GenerationResult = z.infer<typeof GenerationResultSchema>;
