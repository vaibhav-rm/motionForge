import { z } from "zod";

/**
 * Animation primitives.
 *
 * Every animated property in MotionForge is expressed with these shared
 * primitives so that the renderer, the preview and the AI planner all agree
 * on how motion is described. Animations are *frame-based* and deterministic:
 * the same frame always yields the same output, which is a hard requirement
 * for reproducible rendering.
 */

export const EasingSchema = z.enum([
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
  "expoOut",
  "cubicOut",
  "backOut",
  "spring",
]);
export type Easing = z.infer<typeof EasingSchema>;

/** How an element enters the frame. */
export const EntranceSchema = z.object({
  /** Motion archetype. `spring` adds a little overshoot, `slide` travels in. */
  type: z.enum([
    "none",
    "fade",
    "slideUp",
    "slideDown",
    "slideLeft",
    "slideRight",
    "scale",
    "scaleUp",
    "pop",
    "blur",
    "wipeLeft",
    "wipeRight",
    "maskUp",
    "maskLeft",
    "letterStagger",
    "wordStagger",
    "typewriter",
  ]).default("fade"),
  /** Duration in frames. */
  durationInFrames: z.number().int().min(1).max(300).default(20),
  /** Delay before the entrance begins, in frames. */
  delayInFrames: z.number().int().min(0).max(600).default(0),
  /** Per-element stagger used by `letterStagger` / `wordStagger`. */
  staggerInFrames: z.number().min(0).max(60).default(2),
  easing: EasingSchema.default("easeOut"),
  /** Optional travelling distance for slide entrances, in pixels. */
  distance: z.number().min(0).max(4000).default(80),
});
export type Entrance = z.infer<typeof EntranceSchema>;

/** How an element leaves the frame. */
export const ExitSchema = z.object({
  type: z.enum([
    "none",
    "fade",
    "scaleDown",
    "slideDown",
    "slideUp",
    "blur",
    "maskDown",
  ]).default("fade"),
  durationInFrames: z.number().int().min(1).max(300).default(16),
  delayInFrames: z.number().int().min(0).max(600).default(0),
  easing: EasingSchema.default("easeIn"),
  distance: z.number().min(0).max(4000).default(60),
});
export type Exit = z.infer<typeof ExitSchema>;

/** A looping, continuously animated behaviour. */
export const LoopSchema = z.object({
  type: z.enum([
    "none",
    "float",
    "rotate",
    "pulse",
    "orbit",
    "flicker",
    "breathe",
    "scroll",
    "dash",
  ]).default("none"),
  /** Seconds for one full cycle. */
  periodInFrames: z.number().int().min(2).max(1200).default(60),
  /** Amplitude of the motion, interpreted per loop type. */
  amplitude: z.number().min(0).max(1000).default(12),
});
export type Loop = z.infer<typeof LoopSchema>;

export const AnimationSchema = z.object({
  entrance: EntranceSchema.default(EntranceSchema.parse({})),
  exit: ExitSchema.default(ExitSchema.parse({})),
  loop: LoopSchema.default(LoopSchema.parse({})),
});
export type Animation = z.infer<typeof AnimationSchema>;

/**
 * A camera move applied to a whole scene. Values are *offsets* from the
 * scene's base framing so the scene composition stays authored in absolute
 * coordinates.
 */
export const CameraMoveSchema = z.object({
  /** Zoom factor at scene start and end. */
  zoomFrom: z.number().min(0.2).max(6).default(1),
  zoomTo: z.number().min(0.2).max(6).default(1),
  /** Horizontal travel in pixels (positive = right). */
  panXFrom: z.number().min(-4000).max(4000).default(0),
  panXTo: z.number().min(-4000).max(4000).default(0),
  /** Vertical travel in pixels (positive = down). */
  panYFrom: z.number().min(-4000).max(4000).default(0),
  panYTo: z.number().min(-4000).max(4000).default(0),
  /** Rotation in degrees. */
  rotateFrom: z.number().min(-360).max(360).default(0),
  rotateTo: z.number().min(-360).max(360).default(0),
  easing: EasingSchema.default("easeInOut"),
});
export type CameraMove = z.infer<typeof CameraMoveSchema>;

/**
 * Scene-to-scene transition. `durationInFrames` is shared by the outgoing
 * and incoming scene, matching the behaviour of Remotion's `TransitionSeries`.
 */
export const TransitionSchema = z.object({
  type: z.enum([
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
  durationInFrames: z.number().int().min(0).max(120).default(18),
  easing: EasingSchema.default("easeInOut"),
});
export type Transition = z.infer<typeof TransitionSchema>;
