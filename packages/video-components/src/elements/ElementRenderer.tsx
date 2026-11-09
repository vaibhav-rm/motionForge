import React from "react";
import { Img, Video, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type {
  Element,
  ImageElement,
  Project,
  VideoElement,
} from "@motionforge/video-schema";
import {
  buildTransform,
  evaluateEntrance,
  evaluateExit,
  evaluateLoop,
} from "../animations/motion.js";
import { AnimatedText } from "./AnimatedText.js";
import {
  ChartRenderer,
  DiagramRenderer,
  NetworkRenderer,
  ParticlesRenderer,
  ShapeRenderer,
} from "./Graphics.js";
import { Icon } from "../icons.js";

/**
 * Element dispatcher.
 *
 * Every element type resolves to exactly one renderer. The dispatcher owns
 * the shared concerns — positioning, entrance/exit/loop motion, opacity and
 * z-order — so individual renderers only describe *what* they draw.
 */

export interface ElementRendererProps {
  element: Element;
  project: Project;
  /** Resolves an asset id to a playable URL. */
  resolveAsset: (assetId: string) => string | undefined;
  /** Whether the preview should show selection affordances. */
  debug?: boolean;
}

export const ElementRenderer: React.FC<ElementRendererProps> = ({
  element,
  project,
  resolveAsset,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // The element's own clock starts after its offset within the scene.
  const localFrame = frame - element.offsetInFrames;
  const lifetime = element.durationInFrames ?? Number.MAX_SAFE_INTEGER;

  if (!element.visible) return null;

  // --- Exit ------------------------------------------------------------
  let exitState = {
    opacity: 1,
    translateX: 0,
    translateY: 0,
    scale: 1,
    blur: 0,
    reveal: 1,
  };
  const exit = element.animation.exit;
  if (exit.type !== "none" && localFrame > lifetime - exit.durationInFrames - exit.delayInFrames) {
    exitState = evaluateExit(
      exit,
      localFrame - (lifetime - exit.durationInFrames - exit.delayInFrames),
    );
  }

  // --- Entrance --------------------------------------------------------
  const entrance = element.animation.entrance;
  const entranceState = evaluateEntrance(entrance, localFrame, fps);

  // --- Loop ------------------------------------------------------------
  const loopState = evaluateLoop(element.animation.loop, localFrame);

  const scale = entranceState.scale * exitState.scale * loopState.scale * element.scale;
  const translateX =
    entranceState.translateX + exitState.translateX + loopState.translateX;
  const translateY =
    entranceState.translateY + exitState.translateY + loopState.translateY;
  const rotation = entranceState.rotation + loopState.rotation + element.rotation;
  const opacity =
    entranceState.opacity *
    exitState.opacity *
    loopState.opacity *
    element.opacity;
  const blur = entranceState.blur + exitState.blur;

  // --- Layout ----------------------------------------------------------
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${element.x}%`,
    top: `${element.y}%`,
    // `max-content` keeps the box at its natural size so the -50% centring
    // translate is measured against the real width. A plain `auto` width
    // would shrink-to-fit the space to the right of `left: 50%`, which
    // pushes wide elements off the right edge of the canvas.
    width: element.width ?? "max-content",
    maxWidth: "92%",
    height: element.height ?? undefined,
    transform: `translate(-50%, -50%) ${buildTransform({
      translateX,
      translateY,
      scale,
      rotation,
    })}`.trim(),
    opacity,
    zIndex: element.zIndex,
    filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
    pointerEvents: "none",
  };

  const palette = project.style.palette;
  const typography = project.style.typography;
  const fontFamily =
    element.type === "text" && element.fontFamily === "mono"
      ? typography.monoFont
      : element.type === "text" && element.fontFamily === "body"
        ? typography.bodyFont
        : typography.displayFont;

  const content = renderElementContent({
    element,
    project,
    resolveAsset,
    fontFamily,
    entranceState,
  });

  return <div style={style}>{content}</div>;
};

function renderElementContent({
  element,
  project,
  resolveAsset,
  fontFamily,
  entranceState,
}: {
  element: Element;
  project: Project;
  resolveAsset: (assetId: string) => string | undefined;
  fontFamily: string;
  entranceState: ReturnType<typeof evaluateEntrance>;
}): React.ReactNode {
  switch (element.type) {
    case "text":
      return (
        <AnimatedText
          element={element}
          state={entranceState}
          accentColor={element.accentColor || project.style.palette.primary}
          fontFamily={fontFamily}
          displayScale={project.style.typography.displayScale}
          baseFontSize={project.style.typography.baseFontSize}
        />
      );

    case "shape": {
      const size = element.width ?? 220;
      return (
        <ShapeRenderer
          element={element}
          width={size}
          height={element.height ?? size}
        />
      );
    }

    case "image": {
      const src = resolveAsset(element.assetId);
      if (!src) return <MissingAsset label={element.name} />;
      return (
        <ImageRenderer element={element} src={src} project={project} />
      );
    }

    case "video": {
      const src = resolveAsset(element.assetId);
      if (!src) return <MissingAsset label={element.name} />;
      return (
        <VideoRenderer element={element} src={src} project={project} />
      );
    }

    case "icon":
      return (
        <Icon
          name={element.icon}
          color={element.color || project.style.palette.primary}
          size={element.width ?? 72}
          strokeWidth={element.strokeWidth}
          filled={element.filled}
        />
      );

    case "chart":
      return (
        <ChartRenderer
          element={element}
          width={element.width ?? 640}
          height={element.height ?? 360}
        />
      );

    case "network":
      return (
        <NetworkRenderer
          element={element}
          width={element.width ?? 720}
          height={element.height ?? 520}
        />
      );

    case "particles":
      return (
        <ParticlesRenderer
          element={element}
          width={element.width ?? project.width}
          height={element.height ?? project.height}
        />
      );

    case "diagram":
      return (
        <DiagramRenderer
          element={element}
          width={element.width ?? 760}
          height={element.height ?? 420}
        />
      );

    case "group":
    default:
      return null;
  }
}

/** Image with cover/contain fit, masking and colour grading. */
const ImageRenderer: React.FC<{
  element: ImageElement;
  src: string;
  project: Project;
}> = ({ element, src, project }) => {
  return (
    <div
      style={{
        width: element.width ?? 480,
        height: element.height ?? 320,
        overflow: "hidden",
        borderRadius:
          element.mask === "circle"
            ? "50%"
            : element.mask === "rounded"
              ? element.radius || 18
              : element.radius || 0,
        boxShadow: `0 30px 80px rgba(0,0,0,0.45)`,
        position: "relative",
      }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: element.fit,
          display: "block",
        }}
      />
      {element.tint && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: element.tint,
            opacity: element.tintOpacity,
            mixBlendMode: "overlay",
          }}
        />
      )}
    </div>
  );
};

/** Video element with trimming. */
const VideoRenderer: React.FC<{
  element: VideoElement;
  src: string;
  project: Project;
}> = ({ element, src }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const trimStart = Math.floor(element.offsetInFrames / fps);

  return (
    <div
      style={{
        width: element.width ?? 640,
        height: element.height ?? 360,
        overflow: "hidden",
        borderRadius: 12,
        boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
      }}
    >
      <Video
        src={src}
        startFrom={trimStart}
        muted={element.muted}
        volume={element.volume}
        style={{ width: "100%", height: "100%", objectFit: element.fit }}
      />
    </div>
  );
};

/** Placeholder shown when an asset reference cannot be resolved. */
const MissingAsset: React.FC<{ label: string }> = ({ label }) => {
  return (
    <div
      style={{
        width: 320,
        height: 180,
        border: "2px dashed rgba(148,163,184,0.45)",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#94a3b8",
        fontSize: 18,
        fontFamily: "Inter, sans-serif",
        background: "rgba(15,23,42,0.6)",
      }}
    >
      Missing asset · {label}
    </div>
  );
};

/** A directional light sweep used to add a cinematic "reveal" feel. */
export const LightSweep: React.FC<{
  color?: string;
  durationInFrames?: number;
  delayInFrames?: number;
  angle?: number;
}> = ({
  color = "rgba(255,255,255,0.22)",
  durationInFrames = 45,
  delayInFrames = 0,
  angle = 18,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - delayInFrames, [0, durationInFrames], [-0.6, 1.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: "-20%",
        pointerEvents: "none",
        background: `linear-gradient(${angle}deg, transparent 42%, ${color} 50%, transparent 58%)`,
        transform: `translateX(${(progress - 0.5) * 160}%)`,
        mixBlendMode: "screen",
      }}
    />
  );
};
