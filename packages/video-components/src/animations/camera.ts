import { interpolate } from "remotion";
import type { CameraMove } from "@motionforge/video-schema";
import { easingFunction } from "./motion.js";

/**
 * Camera rig.
 *
 * A scene's camera move is expressed as start/end values that are
 * interpolated across the scene duration. The rig wraps the scene contents
 * so a camera move affects everything inside it, including backgrounds that
 * are marked as "parallax".
 */

export interface CameraState {
  scale: number;
  translateX: number;
  translateY: number;
  rotation: number;
}

export function evaluateCamera(
  camera: CameraMove,
  frame: number,
  durationInFrames: number,
): CameraState {
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = easingFunction(camera.easing)(progress);

  return {
    scale: camera.zoomFrom + (camera.zoomTo - camera.zoomFrom) * eased,
    translateX: camera.panXFrom + (camera.panXTo - camera.panXFrom) * eased,
    translateY: camera.panYFrom + (camera.panYTo - camera.panYFrom) * eased,
    rotation: camera.rotateFrom + (camera.rotateTo - camera.rotateFrom) * eased,
  };
}
