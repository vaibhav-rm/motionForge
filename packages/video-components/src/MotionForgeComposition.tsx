import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Project, Scene } from "@motionforge/video-schema";
import { SceneRenderer, SceneTransitionOverlay } from "./SceneRenderer.js";

/**
 * The root composition.
 *
 * Scenes are laid out back-to-back on a single timeline. Each scene may
 * declare a transition that overlaps it with the *next* scene, which is how
 * cinematic cuts are produced without leaving Remotion's frame model.
 */

export interface MotionForgeCompositionProps {
  project: Project;
}

/** Layout result for one scene on the global timeline. */
export interface SceneLayout {
  scene: Scene;
  /** Global frame where the scene starts. */
  startFrame: number;
  /** Frames the scene occupies on the timeline (including overlap). */
  timelineDuration: number;
  /** Overlap with the following scene, in frames. */
  overlap: number;
}

/**
 * Compute the timeline layout for a project.
 *
 * A transition of D frames means the incoming scene starts D frames before
 * the outgoing scene ends, so the total project length is the sum of scene
 * durations minus the overlaps.
 */
export function computeSceneLayout(project: Project): SceneLayout[] {
  const layouts: SceneLayout[] = [];
  let cursor = 0;

  project.scenes.forEach((scene, index) => {
    const next = project.scenes[index + 1];
    const overlap =
      next && scene.transition.type !== "none"
        ? Math.min(scene.transition.durationInFrames, scene.durationInFrames)
        : 0;

    layouts.push({
      scene,
      startFrame: cursor,
      timelineDuration: scene.durationInFrames,
      overlap,
    });

    cursor += scene.durationInFrames - overlap;
  });

  return layouts;
}

/** Total project length in frames. */
export function computeDuration(project: Project): number {
  return computeSceneLayout(project).reduce(
    (max, layout) => Math.max(max, layout.startFrame + layout.timelineDuration),
    0,
  );
}

/**
 * A scene wrapper that renders the outgoing scene's exit motion during the
 * overlap window, so transitions feel like one continuous camera move.
 */
const SceneSlot: React.FC<{
  layout: SceneLayout;
  project: Project;
  resolveAsset: (assetId: string) => string | undefined;
}> = ({ layout, project, resolveAsset }) => {
  const frame = useCurrentFrame();
  const { scene, overlap } = layout;

  // Frames elapsed since the *transition* began (the scene's tail).
  const exitProgress =
    overlap > 0 && frame >= scene.durationInFrames - overlap
      ? interpolate(
          frame,
          [scene.durationInFrames - overlap, scene.durationInFrames],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 0;

  const outgoingStyle: React.CSSProperties = {
    opacity: 1,
    transform: "none",
  };

  if (exitProgress > 0) {
    const transition = scene.transition;
    switch (transition.type) {
      case "fade":
        outgoingStyle.opacity = 1 - exitProgress;
        break;
      case "slideLeft":
        outgoingStyle.transform = `translateX(${-exitProgress * 100}%)`;
        break;
      case "slideRight":
        outgoingStyle.transform = `translateX(${exitProgress * 100}%)`;
        break;
      case "slideUp":
        outgoingStyle.transform = `translateY(${-exitProgress * 100}%)`;
        break;
      case "wipeLeft":
      case "wipeRight":
      case "circle":
      case "clockWipe":
      case "zoomBlur":
        // These use the overlay treatment instead of a transform.
        break;
      default:
        break;
    }
  }

  return (
    <div style={{ ...outgoingStyle, width: "100%", height: "100%" }}>
      <SceneRenderer
        scene={scene}
        project={project}
        resolveAsset={resolveAsset}
      />
    </div>
  );
};

export const MotionForgeComposition: React.FC<MotionForgeCompositionProps> = ({
  project,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layouts = computeSceneLayout(project);

  const resolveAsset = React.useCallback(
    (assetId: string): string | undefined => {
      const asset = project.assets.find((candidate) => candidate.id === assetId);
      return asset?.url || undefined;
    },
    [project.assets],
  );

  const totalDuration = computeDuration(project);

  return (
    <AbsoluteFill style={{ backgroundColor: project.style.palette.background }}>
      {layouts.map((layout) => {
        const { scene, startFrame, overlap } = layout;
        const isLast = layout === layouts[layouts.length - 1];
        const transition = scene.transition;

        return (
          <React.Fragment key={scene.id}>
            <Sequence
              from={startFrame}
              durationInFrames={scene.durationInFrames}
              layout="none"
              name={scene.name}
            >
              <SceneSlot
                layout={layout}
                project={project}
                resolveAsset={resolveAsset}
              />
            </Sequence>

            {/* Transition overlay rendered above both scenes. */}
            {!isLast && overlap > 0 && transition.type !== "none" && (
              <Sequence
                from={startFrame + scene.durationInFrames - overlap}
                durationInFrames={overlap}
                layout="none"
                name={`${scene.name} transition`}
              >
                <TransitionOverlayFrame
                  transition={transition}
                  overlap={overlap}
                  color={project.style.palette.background}
                />
              </Sequence>
            )}
          </React.Fragment>
        );
      })}

      {/* Project-level audio spans the entire timeline. */}
      {project.audio.map((track) => {
        const src = resolveAsset(track.assetId);
        if (!src) return null;
        return (
          <Sequence
            key={`audio-${track.assetId}`}
            from={track.offsetInFrames}
            durationInFrames={
              track.durationInFrames ?? Math.max(1, totalDuration - track.offsetInFrames)
            }
          >
            <Audio
              src={src}
              volume={track.volume}
              loop={track.loop}
              trimBefore={undefined}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/** Computes transition progress from the local frame of the overlay sequence. */
const TransitionOverlayFrame: React.FC<{
  transition: Scene["transition"];
  overlap: number;
  color: string;
}> = ({ transition, overlap, color }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, Math.max(1, overlap - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <SceneTransitionOverlay
      transition={transition}
      progress={progress}
      color={color}
    />
  );
};
