import React from "react";
import { Composition } from "remotion";
import { MotionForgeComposition } from "@motionforge/video-components";
import {
  createProject,
  type Project,
} from "@motionforge/video-schema";

/**
 * Composition registry.
 *
 * A single dynamic composition renders every project. Remotion's
 * `calculateMetadata` derives the dimensions, frame rate and duration from
 * the project document supplied as input props.
 */

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MotionForge"
        component={MotionForgeComposition as React.FC<Record<string, unknown>>}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ project: createProject() }}
        calculateMetadata={({ props }) => {
          const project = props.project as Project | undefined;
          if (!project) {
            return { durationInFrames: 300, fps: 30, width: 1920, height: 1080 };
          }
          return {
            durationInFrames: Math.max(
              1,
              project.scenes.reduce(
                (total, scene) => total + scene.durationInFrames,
                0,
              ),
            ),
            fps: project.fps,
            width: project.width,
            height: project.height,
          };
        }}
      />
    </>
  );
};
