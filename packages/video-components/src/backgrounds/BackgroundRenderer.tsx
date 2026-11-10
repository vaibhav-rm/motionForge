import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { Background } from "@motionforge/video-schema";

/**
 * Background renderers.
 *
 * Backgrounds establish depth and atmosphere. They are deliberately richer
 * than a flat fill: gradients drift, grids breathe, noise adds grain, and
 * mesh gradients produce the soft colour fields used by cinematic styles.
 */

export interface BackgroundProps {
  background: Background;
  /** Scene duration, used to derive looping motion. */
  durationInFrames: number;
  /** Style palette for colour tokens when the background has no explicit colour. */
  palette: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    muted: string;
  };
}

export const BackgroundRenderer: React.FC<BackgroundProps> = ({
  background,
  durationInFrames,
  palette,
}) => {
  const frame = useCurrentFrame();

  switch (background.type) {
    case "solid":
      return (
        <AbsoluteFill
          style={{ backgroundColor: background.color || palette.background, opacity: background.opacity }}
        />
      );

    case "linearGradient": {
      const drift = background.animated
        ? interpolate(
            frame,
            [0, Math.max(1, durationInFrames)],
            [background.angle - 8, background.angle + 8],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        : background.angle;
      return (
        <AbsoluteFill
          style={{
            background: `linear-gradient(${drift}deg, ${background.color}, ${background.color2})`,
            opacity: background.opacity,
          }}
        />
      );
    }

    case "radialGradient": {
      const scale = background.animated
        ? interpolate(frame, [0, Math.max(1, durationInFrames)], [0.9, 1.12], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        : 1;
      return (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 45%, ${background.color2} 0%, ${background.color} 62%)`,
            opacity: background.opacity,
            transform: `scale(${scale})`,
          }}
        />
      );
    }

    case "mesh":
      return <MeshBackground background={background} palette={palette} frame={frame} />;

    case "grid":
      // Legacy projects may still carry a `grid` background. Render it as a
      // soft colour field: literal 1px grid lines read as rendering artifacts
      // once the video is encoded, so they are intentionally gone.
      return (
        <GridBackground background={background} palette={palette} />
      );

    case "dots":
      return (
        <DotsBackground background={background} palette={palette} frame={frame} />
      );

    case "noise":
      return (
        <AbsoluteFill
          style={{
            backgroundColor: background.color || palette.background,
            opacity: background.opacity,
          }}
        >
          <NoiseOverlay opacity={0.35} />
        </AbsoluteFill>
      );

    case "image":
    case "video":
      // Media backgrounds are resolved by the scene renderer which has access
      // to the asset URL resolver; rendered here as a colour field fallback.
      return (
        <AbsoluteFill
          style={{
            background: `linear-gradient(140deg, ${palette.background}, ${palette.surface})`,
            opacity: background.opacity,
          }}
        />
      );

    default:
      return <AbsoluteFill style={{ backgroundColor: palette.background }} />;
  }
};

/** Soft, multi-stop colour field used by the mesh gradient style. */
const MeshBackground: React.FC<{
  background: Background;
  palette: BackgroundProps["palette"];
  frame: number;
}> = ({ background, palette, frame }) => {
  const t = (frame % 600) / 600;
  const x1 = 20 + Math.sin(t * Math.PI * 2) * 12;
  const y1 = 25 + Math.cos(t * Math.PI * 2) * 10;
  const x2 = 78 + Math.cos(t * Math.PI * 2 + 1) * 10;
  const y2 = 70 + Math.sin(t * Math.PI * 2 + 2) * 12;

  return (
    <AbsoluteFill style={{ backgroundColor: background.color, opacity: background.opacity }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${x1}% ${y1}%, ${palette.primary}55 0%, transparent 45%),
                       radial-gradient(circle at ${x2}% ${y2}%, ${palette.secondary}44 0%, transparent 48%),
                       radial-gradient(circle at 50% 110%, ${background.color2} 0%, transparent 60%)`,
          filter: "blur(24px)",
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Legacy `grid` background.
 *
 * Older projects were planned with a scrolling 1px grid. That pattern moirés
 * and shows visible line artifacts after H.264 encoding, so the type now
 * resolves to a smooth two-stop colour field with no line work at all.
 */
const GridBackground: React.FC<{
  background: Background;
  palette: BackgroundProps["palette"];
}> = ({ background, palette }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: background.color, opacity: background.opacity }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 30% 30%, ${palette.primary}26 0%, transparent 58%),
                       radial-gradient(circle at 78% 72%, ${palette.secondary}1f 0%, transparent 60%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Evenly spaced dots with a gentle drift. */
const DotsBackground: React.FC<{
  background: Background;
  palette: BackgroundProps["palette"];
  frame: number;
}> = ({ background, palette, frame }) => {
  const offset = background.animated ? (frame * 0.18) % background.gridSize : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: background.color, opacity: background.opacity }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle, rgba(148,163,184,0.35) 1.5px, transparent 1.5px)`,
          backgroundSize: `${background.gridSize}px ${background.gridSize}px`,
          backgroundPosition: `${offset}px ${offset}px`,
          maskImage: "linear-gradient(to bottom, transparent, black 35%, black 70%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 35%, black 70%, transparent)",
          opacity: 0.7,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${palette.primary}14 0%, transparent 55%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Film-grain style noise overlay.
 *
 * Uses a deterministic SVG turbulence filter so the grain is identical on
 * every frame and in every render — never random per frame.
 */
export const NoiseOverlay: React.FC<{ opacity?: number }> = ({ opacity = 0.06 }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%" style={{ display: "block" }}>
        <filter id="motionforge-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.82"
            numOctaves="3"
            stitchTiles="stitch"
            seed="7"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#motionforge-grain)" />
      </svg>
    </AbsoluteFill>
  );
};
