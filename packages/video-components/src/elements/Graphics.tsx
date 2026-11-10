import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type {
  ChartElement,
  DiagramElement,
  NetworkElement,
  ParticlesElement,
  ShapeElement,
} from "@motionforge/video-schema";
import { createRandom } from "@motionforge/shared";

/**
 * Graphic element renderers: shapes, charts, networks, diagrams and particle
 * fields. Each one is a self-contained motion-design primitive that consumes
 * the frame number directly.
 */

/** --------------------------------------------------------------------- */
/* Shapes                                                                 */
/** --------------------------------------------------------------------- */

export interface ShapeRendererProps {
  element: ShapeElement;
  width: number;
  height: number;
}

export const ShapeRenderer: React.FC<ShapeRendererProps> = ({
  element,
  width,
  height,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const random = createRandom(
    element.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 7),
  );

  // Organic blobs wobble using two offset sine waves so the motion reads as
  // hand-drawn rather than mechanical.
  const wobble = Math.sin(frame / 14) * 6 + Math.cos(frame / 23) * 4;

  const common: React.CSSProperties = {
    width,
    height,
    background: element.stroke
      ? "transparent"
      : `radial-gradient(circle at 35% 30%, ${element.fill}ee, ${element.fill}88)`,
    border: element.stroke
      ? `${element.strokeWidth}px solid ${element.stroke}`
      : undefined,
    boxShadow: element.glow
      ? `0 0 ${element.glow}px ${element.fill}99, inset 0 0 ${element.glow / 2}px ${element.fill}44`
      : undefined,
  };

  switch (element.shape) {
    case "circle":
      return (
        <div
          style={{
            ...common,
            borderRadius: "50%",
            transform: `scale(${1 + Math.sin(frame / 20) * 0.02})`,
          }}
        />
      );
    case "triangle":
      return (
        <div
          style={{
            ...common,
            clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
            transform: `rotate(${Math.sin(frame / 40) * 4}deg)`,
          }}
        />
      );
    case "line":
      return (
        <div
          style={{
            width,
            height: Math.max(2, element.strokeWidth || 4),
            background: element.stroke ?? element.fill,
            borderRadius: 999,
            boxShadow: common.boxShadow,
          }}
        />
      );
    case "ring":
      return (
        <div
          style={{
            width,
            height,
            borderRadius: "50%",
            border: `${Math.max(2, element.strokeWidth || 6)}px solid ${
              element.stroke ?? element.fill
            }`,
            boxShadow: common.boxShadow,
            transform: `rotate(${frame * 0.4}deg)`,
          }}
        />
      );
    case "blob": {
      const points = 8;
      const path = Array.from({ length: points }, (_, index) => {
        const angle = (index / points) * Math.PI * 2;
        const radius =
          0.42 + random() * 0.12 + Math.sin(frame / 12 + index) * 0.04;
        return `${50 + Math.cos(angle) * radius * 100}%, ${
          50 + Math.sin(angle) * radius * 100
        }%`;
      }).join(", ");
      return (
        <div
          style={{
            width,
            height,
            background: `radial-gradient(circle at 35% 30%, ${element.fill}ee, ${element.fill}88)`,
            borderRadius: "46% 54% 58% 42% / 48% 42% 58% 52%",
            transform: `rotate(${wobble * 0.6}deg)`,
            boxShadow: common.boxShadow,
          }}
        />
      );
    }
    case "polygon": {
      const sides = element.sides;
      const points = Array.from({ length: sides }, (_, index) => {
        const angle = (index / sides) * Math.PI * 2 - Math.PI / 2;
        return `${50 + Math.cos(angle) * 48}%, ${50 + Math.sin(angle) * 48}%`;
      }).join(", ");
      return (
        <div
          style={{
            ...common,
            clipPath: `polygon(${points})`,
            transform: `rotate(${frame * 0.25}deg)`,
          }}
        />
      );
    }
    case "rect":
    default:
      return (
        <div
          style={{
            ...common,
            borderRadius: element.radius,
            transform: `perspective(800px) rotateX(${
              Math.sin(frame / 30) * 4
            }deg) rotateY(${Math.cos(frame / 38) * 5}deg)`,
          }}
        />
      );
  }
};

/** --------------------------------------------------------------------- */
/* Charts                                                                 */
/** --------------------------------------------------------------------- */

export interface ChartRendererProps {
  element: ChartElement;
  width: number;
  height: number;
}

export const ChartRenderer: React.FC<ChartRendererProps> = ({
  element,
  width,
  height,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const maxValue =
    element.maxValue ?? Math.max(1, ...element.series.map((s) => Math.abs(s.value)));

  const reveal = interpolate(frame, [0, Math.max(12, fps * 0.7)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (element.chartType === "donut" || element.chartType === "progress") {
    const total = element.series.reduce((sum, s) => sum + Math.abs(s.value), 0) || 1;
    const progress =
      element.chartType === "progress"
        ? Math.max(0, Math.min(1, (element.series[0]?.value ?? 0) / maxValue)) * reveal
        : reveal;
    const radius = Math.min(width, height) / 2 - 14;
    const circumference = 2 * Math.PI * radius;

    let accumulated = 0;
    const segments = element.series.map((series) => {
      const fraction = Math.abs(series.value) / total;
      const segmentProgress = Math.max(
        0,
        Math.min(1, (progress * total - accumulated) / (Math.abs(series.value) || 1)),
      );
      accumulated += Math.abs(series.value);
      return { series, fraction, segmentProgress };
    });

    return (
      <div style={{ position: "relative", width, height }}>
        <svg width={width} height={height} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill="none"
            stroke="rgba(148,163,184,0.18)"
            strokeWidth={Math.max(14, radius * 0.16)}
          />
          {segments.map(({ series, segmentProgress }) => (
            <circle
              key={series.label}
              cx={width / 2}
              cy={height / 2}
              r={radius}
              fill="none"
              stroke={series.color}
              strokeWidth={Math.max(14, radius * 0.16)}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - segmentProgress)}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        {element.showValues && element.series[0] && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#f8fafc",
              fontSize: Math.max(18, radius * 0.32),
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {Math.round(
              (element.chartType === "progress"
                ? (element.series[0]?.value ?? 0)
                : progress * total) * reveal
            )}
            <span style={{ fontSize: Math.max(11, radius * 0.16), opacity: 0.6 }}>
              {element.series[0]?.label}
            </span>
          </div>
        )}
      </div>
    );
  }

  const slotWidth = width / Math.max(1, element.series.length);
  const barWidth = slotWidth * (1 - element.barGap);

  if (element.chartType === "line" || element.chartType === "area") {
    const points = element.series.map((series, index) => {
      const x =
        element.series.length === 1
          ? width / 2
          : (index / (element.series.length - 1)) * width;
      const y = height - (series.value / maxValue) * height * reveal;
      return { x, y, series };
    });

    const path = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
      .join(" ");

    return (
      <div style={{ position: "relative", width, height }}>
        <svg width={width} height={height}>
          {element.showAxis && (
            <line
              x1={0}
              y1={height}
              x2={width}
              y2={height}
              stroke="rgba(148,163,184,0.3)"
              strokeWidth={1.5}
            />
          )}
          {element.chartType === "area" && (
            <path
              d={`${path} L${width},${height} L0,${height} Z`}
              fill={`${element.series[0]?.color ?? "#5eead4"}22`}
            />
          )}
          <path
            d={path}
            fill="none"
            stroke={element.series[0]?.color ?? "#5eead4"}
            strokeWidth={element.lineWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={element.lineWidth * 1.4}
              fill="#0b0f18"
              stroke={point.series.color}
              strokeWidth={element.lineWidth * 0.7}
            />
          ))}
        </svg>
      </div>
    );
  }

  // Bar chart
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        gap: slotWidth * element.barGap,
        width,
        height,
      }}
    >
      {element.series.map((series, index) => {
        const barHeight = Math.max(2, (Math.abs(series.value) / maxValue) * height * reveal);
        const delay = index * 3;
        const localReveal = interpolate(
          frame - delay,
          [0, Math.max(10, fps * 0.5)],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return (
          <div
            key={`${series.label}-${index}`}
            style={{
              width: barWidth,
              height: barHeight * localReveal,
              background: `linear-gradient(180deg, ${series.color}, ${series.color}77)`,
              borderRadius: Math.min(10, barWidth * 0.16),
              boxShadow: `0 0 26px ${series.color}44`,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {element.showValues && (
              <span
                style={{
                  position: "absolute",
                  top: -30,
                  color: "#e2e8f0",
                  fontSize: 18,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {Math.round(series.value * localReveal)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** --------------------------------------------------------------------- */
/* Network graph                                                          */
/** --------------------------------------------------------------------- */

export interface NetworkRendererProps {
  element: NetworkElement;
  width: number;
  height: number;
}

interface GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export const NetworkRenderer: React.FC<NetworkRendererProps> = ({
  element,
  width,
  height,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Layout is computed once from a deterministic seed so the graph is stable
  // across frames but still looks organically scattered.
  const nodes = React.useMemo<GraphNode[]>(() => {
    const seed = element.id
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 31);
    const random = createRandom(seed);
    const count = element.nodeCount;
    const result: GraphNode[] = [];

    if (element.layout === "radial") {
      const rings = Math.max(1, Math.ceil(count / 6));
      for (let index = 0; index < count; index += 1) {
        const ring = Math.floor(index / 6);
        const positionInRing = index % 6;
        const ringCount = ring === 0 ? 1 : 6;
        const angle =
          (positionInRing / ringCount) * Math.PI * 2 +
          (ring % 2 === 0 ? 0 : Math.PI / ringCount) +
          random() * 0.25;
        const radius = ((ring + 1) / rings) * Math.min(width, height) * 0.42;
        result.push({
          x: width / 2 + Math.cos(angle) * radius,
          y: height / 2 + Math.sin(angle) * radius,
          vx: random(),
          vy: random(),
        });
      }
    } else if (element.layout === "grid") {
      const columns = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / columns);
      for (let index = 0; index < count; index += 1) {
        const column = index % columns;
        const row = Math.floor(index / columns);
        result.push({
          x: ((column + 0.5) / columns) * width,
          y: ((row + 0.5) / rows) * height,
          vx: random(),
          vy: random(),
        });
      }
    } else if (element.layout === "spiral") {
      for (let index = 0; index < count; index += 1) {
        const angle = index * 0.7;
        const radius = (index / count) * Math.min(width, height) * 0.46;
        result.push({
          x: width / 2 + Math.cos(angle) * radius,
          y: height / 2 + Math.sin(angle) * radius,
          vx: random(),
          vy: random(),
        });
      }
    } else {
      for (let index = 0; index < count; index += 1) {
        result.push({
          x: 0.08 * width + random() * 0.84 * width,
          y: 0.08 * height + random() * 0.84 * height,
          vx: random(),
          vy: random(),
        });
      }
    }
    return result;
  }, [element.id, element.nodeCount, element.layout, width, height]);

  // Build edges deterministically.
  const edges = React.useMemo(() => {
    const result: Array<{ a: number; b: number }> = [];
    const seed = element.id
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 97);
    const random = createRandom(seed);
    for (let a = 0; a < nodes.length; a += 1) {
      for (let b = a + 1; b < nodes.length; b += 1) {
        if (random() < element.density) result.push({ a, b });
      }
    }
    return result;
  }, [element.id, element.density, nodes.length]);

  const spin = element.spin + frame * 0.08;
  const revealProgress = element.staggered
    ? interpolate(frame, [0, Math.max(20, fps * 1.2)], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  return (
    <svg
      width={width}
      height={height}
      style={{ overflow: "visible", transform: `rotate(${spin}deg)` }}
    >
      <g>
        {edges.map((edge, index) => {
          const from = nodes[edge.a];
          const to = nodes[edge.b];
          const edgeReveal = element.staggered
            ? Math.max(
                0,
                Math.min(
                  1,
                  revealProgress * edges.length - index * 0.35,
                ),
              )
            : 1;
          if (edgeReveal <= 0) return null;
          return (
            <line
              key={index}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={element.edgeColor}
              strokeWidth={element.edgeWidth}
              opacity={edgeReveal * 0.85}
              strokeDasharray={undefined}
            />
          );
        })}
      </g>
      {nodes.map((node, index) => {
        const nodeReveal = element.staggered
          ? Math.max(0, Math.min(1, revealProgress * nodes.length - index * 0.6))
          : 1;
        if (nodeReveal <= 0) return null;
        const pulse = element.pulse
          ? 1 + Math.sin(frame / 9 + index * 0.7) * 0.12
          : 1;
        return (
          <circle
            key={index}
            cx={node.x}
            cy={node.y}
            r={element.nodeRadius * pulse * nodeReveal}
            fill={element.nodeColor}
            opacity={nodeReveal}
          />
        );
      })}
    </svg>
  );
};

/** --------------------------------------------------------------------- */
/* Particle field                                                          */
/** --------------------------------------------------------------------- */

export interface ParticlesRendererProps {
  element: ParticlesElement;
  width: number;
  height: number;
}

export const ParticlesRenderer: React.FC<ParticlesRendererProps> = ({
  element,
  width,
  height,
}) => {
  const frame = useCurrentFrame();

  const particles = React.useMemo(() => {
    const seed = element.id
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 13);
    const random = createRandom(seed);
    return Array.from({ length: element.count }, () => ({
      x: random(),
      y: random(),
      size: 0.4 + random() * 1.4,
      phase: random() * Math.PI * 2,
      drift: 0.4 + random() * 1.2,
    }));
  }, [element.id, element.count]);

  const positions = particles.map((particle) => {
    const t = frame / 60;
    switch (element.motion) {
      case "rise":
        return {
          x: particle.x * width,
          y: ((particle.y - t * 0.02 * element.speed * particle.drift) % 1 + 1) % 1 * height,
        };
      case "rain":
        return {
          x: particle.x * width,
          y: ((particle.y + t * 0.16 * element.speed * particle.drift) % 1) * height,
        };
      case "orbit":
        return {
          x:
            width / 2 +
            Math.cos(particle.phase + t * element.speed * 0.4) *
              (0.1 + particle.x * 0.4) *
              width,
          y:
            height / 2 +
            Math.sin(particle.phase + t * element.speed * 0.4) *
              (0.1 + particle.y * 0.4) *
              height,
        };
      case "scatter":
        return {
          x:
            width / 2 +
            Math.cos(particle.phase + t * element.speed * 0.2) *
              (particle.x - 0.5) *
              width *
              1.2,
          y:
            height / 2 +
            Math.sin(particle.phase * 1.3 + t * element.speed * 0.2) *
              (particle.y - 0.5) *
              height *
              1.2,
        };
      case "drift":
      default:
        return {
          x:
            (particle.x * width +
              Math.sin(t * 0.4 * element.speed + particle.phase) * 34 * particle.drift) %
            width,
          y:
            (particle.y * height +
              Math.cos(t * 0.3 * element.speed + particle.phase) * 26 * particle.drift) %
            height,
        };
    }
  });

  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  if (element.connect) {
    for (let a = 0; a < positions.length; a += 1) {
      for (let b = a + 1; b < positions.length; b += 1) {
        const dx = positions[a].x - positions[b].x;
        const dy = positions[a].y - positions[b].y;
        const distance = Math.hypot(dx, dy);
        if (distance < element.connectDistance) {
          lines.push({
            x1: positions[a].x,
            y1: positions[a].y,
            x2: positions[b].x,
            y2: positions[b].y,
          });
        }
      }
    }
  }

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      {lines.map((line, index) => (
        <line
          key={index}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={element.color}
          strokeWidth={0.7}
          opacity={0.22 * element.particleOpacity}
        />
      ))}
      {positions.map((position, index) => (
        <circle
          key={index}
          cx={position.x}
          cy={position.y}
          r={element.size * particles[index].size}
          fill={element.color}
          opacity={element.particleOpacity}
        />
      ))}
    </svg>
  );
};

/** --------------------------------------------------------------------- */
/* Diagram                                                                */
/** --------------------------------------------------------------------- */

export interface DiagramRendererProps {
  element: DiagramElement;
  width: number;
  height: number;
}

export const DiagramRenderer: React.FC<DiagramRendererProps> = ({
  element,
  width,
  height,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = interpolate(frame, [0, Math.max(20, fps * 1.4)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      {element.connectors &&
        element.nodes.slice(0, -1).map((node, index) => {
          const next = element.nodes[index + 1];
          const drawProgress = Math.max(
            0,
            Math.min(1, reveal * (element.nodes.length - 1) - index),
          );
          if (drawProgress <= 0) return null;
          const x1 = node.x * width;
          const y1 = node.y * height;
          const x2 = next.x * width;
          const y2 = next.y * height;
          return (
            <g key={`connector-${node.id}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={element.connectorColor}
                strokeWidth={2}
                strokeDasharray="8 10"
                opacity={drawProgress}
              >
                {element.animatedConnectors && (
                  <animate
                    attributeName="stroke-dashoffset"
                    from="36"
                    to="0"
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                )}
              </line>
              <circle
                cx={x2}
                cy={y2}
                r={4}
                fill={element.connectorColor}
                opacity={drawProgress}
              />
            </g>
          );
        })}
      {element.nodes.map((node, index) => {
        const nodeReveal = element.staggered
          ? Math.max(0, Math.min(1, reveal * element.nodes.length - index))
          : 1;
        if (nodeReveal <= 0) return null;
        const nodeWidth = node.width * width;
        const nodeHeight = node.height * height;
        return (
          <g
            key={node.id}
            opacity={nodeReveal}
            transform={`translate(${node.x * width - nodeWidth / 2}, ${
              node.y * height - nodeHeight / 2
            })`}
          >
            <rect
              width={nodeWidth}
              height={nodeHeight}
              rx={Math.min(14, nodeHeight * 0.28)}
              fill="rgba(15,23,42,0.88)"
              stroke={node.color}
              strokeWidth={2}
            />
            <rect
              width={nodeWidth}
              height={nodeHeight}
              rx={Math.min(14, nodeHeight * 0.28)}
              fill={node.color}
              opacity={0.14}
            />
            {element.showLabels && (
              <>
                <text
                  x={nodeWidth / 2}
                  y={node.sublabel ? nodeHeight / 2 - 2 : nodeHeight / 2 + 6}
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize={Math.max(13, nodeHeight * 0.3)}
                  fontWeight={600}
                  fontFamily="Inter, sans-serif"
                >
                  {node.label}
                </text>
                {node.sublabel && (
                  <text
                    x={nodeWidth / 2}
                    y={nodeHeight / 2 + 18}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize={Math.max(10, nodeHeight * 0.19)}
                    fontFamily="Inter, sans-serif"
                  >
                    {node.sublabel}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
};
