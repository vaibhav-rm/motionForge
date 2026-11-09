import { interpolate, spring, Easing } from "remotion";
import type { Easing as EasingName, Entrance, Exit, Loop } from "@motionforge/video-schema";

/**
 * Motion primitives.
 *
 * Every animation in MotionForge is frame-based and deterministic: the value
 * for a given frame never depends on wall-clock time or previous frames.
 * That property is what makes preview and final render identical.
 */

/** Remotion's built-in easing functions keyed by our schema names. */
export const EASING_FUNCTIONS: Record<EasingName, (t: number) => number> = {
  linear: Easing.linear,
  easeIn: Easing.in(Easing.cubic),
  easeOut: Easing.out(Easing.cubic),
  easeInOut: Easing.inOut(Easing.cubic),
  expoOut: Easing.out(Easing.exp),
  cubicOut: Easing.out(Easing.cubic),
  backOut: Easing.out(Easing.back(1.7)),
  spring: Easing.out(Easing.cubic),
};

export function easingFunction(name: EasingName): (t: number) => number {
  return EASING_FUNCTIONS[name] ?? EASING_FUNCTIONS.easeOut;
}

/**
 * Evaluate an entrance animation at a given frame.
 *
 * Returns the transform + opacity to apply to the element at `frame`
 * (relative to the element's own start).
 */
export interface EntranceState {
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;
  blur: number;
  /** 0..1 progress used for wipe / mask reveals. */
  reveal: number;
  /** Per-character / per-word reveal counts. */
  staggerProgress: number;
}

export function evaluateEntrance(
  entrance: Entrance,
  frame: number,
  fps: number,
): EntranceState {
  const state: EntranceState = {
    opacity: 1,
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotation: 0,
    blur: 0,
    reveal: 1,
    staggerProgress: 1,
  };

  if (entrance.type === "none") return state;

  const local = frame - entrance.delayInFrames;
  const duration = Math.max(1, entrance.durationInFrames);
  const raw = interpolate(local, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = easingFunction(entrance.easing)(raw);

  switch (entrance.type) {
    case "fade":
      state.opacity = eased;
      break;
    case "slideUp":
      state.translateY = (1 - eased) * entrance.distance;
      state.opacity = Math.min(1, eased * 1.6);
      break;
    case "slideDown":
      state.translateY = -(1 - eased) * entrance.distance;
      state.opacity = Math.min(1, eased * 1.6);
      break;
    case "slideLeft":
      state.translateX = (1 - eased) * entrance.distance;
      state.opacity = Math.min(1, eased * 1.6);
      break;
    case "slideRight":
      state.translateX = -(1 - eased) * entrance.distance;
      state.opacity = Math.min(1, eased * 1.6);
      break;
    case "scale":
      state.scale = 0.6 + eased * 0.4;
      state.opacity = eased;
      break;
    case "scaleUp":
      state.scale = 0.72 + eased * 0.28;
      state.opacity = eased;
      break;
    case "pop": {
      // Springy overshoot: scale past 1 then settle.
      const springValue = spring({
        frame: Math.max(0, local),
        fps,
        config: { damping: 12, stiffness: 180, mass: 0.6 },
      });
      state.scale = 0.55 + springValue * 0.45;
      state.opacity = Math.min(1, springValue * 1.4);
      break;
    }
    case "blur":
      state.blur = (1 - eased) * 18;
      state.opacity = eased;
      break;
    case "wipeLeft":
    case "wipeRight":
      state.reveal = eased;
      state.opacity = eased;
      break;
    case "maskUp":
    case "maskLeft":
      state.reveal = eased;
      state.opacity = Math.min(1, eased * 2);
      break;
    case "letterStagger":
    case "wordStagger":
      state.staggerProgress = eased;
      state.opacity = 1;
      break;
    case "typewriter":
      state.staggerProgress = eased;
      state.opacity = 1;
      break;
    default:
      break;
  }

  return state;
}

/** Evaluate an exit animation relative to the element's end frame. */
export interface ExitState {
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  blur: number;
  reveal: number;
}

export function evaluateExit(
  exit: Exit,
  /** Frames elapsed since the exit began. */
  framesSinceStart: number,
): ExitState {
  const state: ExitState = {
    opacity: 1,
    translateX: 0,
    translateY: 0,
    scale: 1,
    blur: 0,
    reveal: 1,
  };

  if (exit.type === "none") return state;

  const duration = Math.max(1, exit.durationInFrames);
  const raw = interpolate(framesSinceStart, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = easingFunction(exit.easing)(raw);

  switch (exit.type) {
    case "fade":
      state.opacity = 1 - eased;
      break;
    case "scaleDown":
      state.scale = 1 - eased * 0.35;
      state.opacity = 1 - eased;
      break;
    case "slideDown":
      state.translateY = eased * exit.distance;
      state.opacity = 1 - eased;
      break;
    case "slideUp":
      state.translateY = -eased * exit.distance;
      state.opacity = 1 - eased;
      break;
    case "blur":
      state.blur = eased * 16;
      state.opacity = 1 - eased;
      break;
    case "maskDown":
      state.reveal = 1 - eased;
      state.opacity = 1 - eased;
      break;
    default:
      break;
  }

  return state;
}

/** Evaluate a looping animation at a given frame. */
export interface LoopState {
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export function evaluateLoop(loop: Loop, frame: number): LoopState {
  const state: LoopState = {
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
  };

  if (loop.type === "none") return state;

  const period = Math.max(2, loop.periodInFrames);
  const phase = (frame % period) / period;
  const wave = Math.sin(phase * Math.PI * 2);

  switch (loop.type) {
    case "float":
      state.translateY = wave * loop.amplitude;
      break;
    case "rotate":
      state.rotation = (phase * 360) % 360;
      break;
    case "pulse":
      state.scale = 1 + wave * 0.08 * (loop.amplitude / 12);
      state.opacity = 1 + wave * 0.12 * (loop.amplitude / 12);
      break;
    case "orbit":
      state.translateX = Math.cos(phase * Math.PI * 2) * loop.amplitude;
      state.translateY = Math.sin(phase * Math.PI * 2) * loop.amplitude;
      break;
    case "flicker":
      // Deterministic pseudo-flicker: a fast hash of the frame index.
      state.opacity = 0.72 + 0.28 * ((Math.sin(frame * 12.9898) * 43758.5453) % 1);
      break;
    case "breathe":
      state.scale = 1 + (wave * 0.5 + 0.5) * 0.06 * (loop.amplitude / 12);
      break;
    case "scroll":
      state.translateY = -((frame / period) % 1) * loop.amplitude;
      break;
    case "dash":
      // Handled by consumers via `dashOffset`.
      break;
    default:
      break;
  }

  return state;
}

/**
 * CSS transform string builder shared by all animated layers.
 *
 * Returns an empty string when there is nothing to transform. Returning
 * `"none"` would be invalid inside a transform list (for example
 * `translate(-50%, -50%) none`), which browsers discard entirely — taking
 * the centring transform with it.
 */
export function buildTransform(options: {
  translateX?: number;
  translateY?: number;
  scale?: number;
  rotation?: number;
}): string {
  const parts: string[] = [];
  if (options.translateX || options.translateY) {
    parts.push(
      `translate(${options.translateX ?? 0}px, ${options.translateY ?? 0}px)`,
    );
  }
  if (options.scale && options.scale !== 1) {
    parts.push(`scale(${options.scale})`);
  }
  if (options.rotation) {
    parts.push(`rotate(${options.rotation}deg)`);
  }
  return parts.join(" ");
}
