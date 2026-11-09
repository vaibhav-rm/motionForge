import { ProjectSchema } from "@motionforge/video-schema";
import type { Project } from "@motionforge/video-schema";

/**
 * Project loading helpers shared by the preview and the renderer.
 *
 * Both need to accept a project from different sources (API payload, JSON
 * file, database column) and produce a *validated* project before any
 * component touches it.
 */

/** Parse and validate an unknown value into a project. */
export function parseProject(input: unknown): Project {
  return ProjectSchema.parse(input);
}

/** Parse a project, returning `null` instead of throwing. */
export function safeParseProject(input: unknown): Project | null {
  const result = ProjectSchema.safeParse(input);
  return result.success ? result.data : null;
}

/**
 * Remotion `calculateMetadata` implementation.
 *
 * The composition length and dimensions are derived from the project so a
 * single composition id can render any project.
 */
export function projectMetadata(project: Project): {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
} {
  return {
    width: project.width,
    height: project.height,
    fps: project.fps,
    durationInFrames: Math.max(
      1,
      project.scenes.reduce((total, scene) => total + scene.durationInFrames, 0),
    ),
  };
}
