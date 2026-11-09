import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { Project, Scene } from "@motionforge/video-schema";
import { evaluateCamera } from "./animations/camera.js";
import { BackgroundRenderer, NoiseOverlay } from "./backgrounds/BackgroundRenderer.js";
import { ElementRenderer } from "./elements/ElementRenderer.js";

/**
 * Scene renderer.
 *
 * A scene is composed of: background → camera rig → elements → atmosphere
 * (grain, vignette, light sweeps). The camera rig wraps everything so a
 * camera move genuinely moves the scene rather than nudging elements.
 */

export interface SceneRendererProps {
  scene: Scene;
  project: Project;
  resolveAsset: (assetId: string) => string | undefined;
  /** Extra light sweep overlays, added by the transition system. */
  showAtmosphere?: boolean;
}

export const SceneRenderer: React.FC<SceneRendererProps> = ({
  scene,
  project,
  resolveAsset,
  showAtmosphere = true,
}) => {
  const frame = useCurrentFrame();
  const camera = evaluateCamera(scene.camera, frame, scene.durationInFrames);
  const palette = project.style.palette;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <BackgroundRenderer
        background={scene.background}
        durationInFrames={scene.durationInFrames}
        palette={palette}
      />

      {/* Camera rig. Slight over-scale avoids exposing the canvas edges. */}
      <AbsoluteFill
        style={{
          transform: `scale(${camera.scale}) translate(${camera.translateX}px, ${camera.translateY}px) rotate(${camera.rotation}deg)`,
          transformOrigin: "center center",
        }}
      >
        {scene.elements
          .filter((element) => element.visible)
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((element) => (
            <ElementRenderer
              key={element.id}
              element={element}
              project={project}
              resolveAsset={resolveAsset}
            />
          ))}
      </AbsoluteFill>

      {showAtmosphere && (
        <>
          {project.style.grain > 0 && (
            <NoiseOverlay opacity={project.style.grain} />
          )}
          {project.style.vignette > 0 && (
            <AbsoluteFill
              style={{
                background: `radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,${project.style.vignette}) 100%)`,
                pointerEvents: "none",
              }}
            />
          )}
        </>
      )}
    </AbsoluteFill>
  );
};

/**
 * Scene transition overlay.
 *
 * Rendered on top of the outgoing scene during the overlap window so the
 * transition reads as a deliberate cinematic cut rather than a crossfade.
 */
export const SceneTransitionOverlay: React.FC<{
  transition: Scene["transition"];
  /** Progress through the transition, 0..1. */
  progress: number;
  color: string;
}> = ({ transition, progress, color }) => {
  if (transition.type === "none" || progress <= 0 || progress >= 1) return null;

  const eased = interpolate(progress, [0, 1], [0, 1], {
    easing: (t) => t * t * (3 - 2 * t),
  });

  switch (transition.type) {
    case "fade":
      return (
        <AbsoluteFill
          style={{
            backgroundColor: color,
            opacity: Math.sin(eased * Math.PI) * 0.85,
            pointerEvents: "none",
          }}
        />
      );
    case "circle":
      return (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <AbsoluteFill
            style={{
              backgroundColor: color,
              clipPath: `circle(${eased * 75}% at 50% 50%)`,
            }}
          />
        </AbsoluteFill>
      );
    case "clockWipe":
      return (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <AbsoluteFill
            style={{
              backgroundColor: color,
              clipPath: `polygon(50% 50%, 50% 50%, ${50 + eased * 50}% 50%, 50% ${
                50 + eased * 50
              }%, 50% 50%)`,
            }}
          />
        </AbsoluteFill>
      );
    case "wipeLeft":
      return (
        <AbsoluteFill
          style={{
            backgroundColor: color,
            clipPath: `inset(0 ${(1 - eased) * 100}% 0 0)`,
            pointerEvents: "none",
          }}
        />
      );
    case "wipeRight":
      return (
        <AbsoluteFill
          style={{
            backgroundColor: color,
            clipPath: `inset(0 0 0 ${(1 - eased) * 100}%)`,
            pointerEvents: "none",
          }}
        />
      );
    case "zoomBlur":
      return (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            background: `radial-gradient(circle at 50% 50%, transparent ${
              eased * 70
            }%, ${color} 100%)`,
            opacity: 0.9,
          }}
        />
      );
    case "slideLeft":
    case "slideRight":
    case "slideUp":
    default:
      return null;
  }
};
