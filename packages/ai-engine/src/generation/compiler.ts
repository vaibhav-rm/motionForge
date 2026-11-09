import type {
  CameraMove,
  Element,
  Project,
  Scene,
  ScenePlan,
  Transition,
  VideoPlan,
} from "@motionforge/video-schema";
import {
  createId,
  normaliseSceneOrder,
  ProjectSchema,
} from "@motionforge/video-schema";
import { createRandom } from "@motionforge/shared";

/**
 * Plan → Project compiler.
 *
 * This is the deterministic half of the generation pipeline. The AI decides
 * *what* the video should contain; this code decides *how* each visual is
 * built — which elements, which entrance animations, which camera move.
 *
 * Keeping this separate is what makes the output reliable: the same plan
 * always compiles to the same project, and the AI never has to emit
 * coordinates, z-orders or animation frame counts.
 */

/** Aspect ratio → canvas dimensions. */
const ASPECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

export interface CompileOptions {
  plan: VideoPlan;
  fps: number;
  aspectRatio: string | null;
  width?: number;
  height?: number;
  projectId?: string;
  projectName?: string;
}

/**
 * Compile a validated plan into a complete, editable project.
 */
export function compilePlan(options: CompileOptions): Project {
  const { plan } = options;
  const dimensions = options.aspectRatio
    ? ASPECT_DIMENSIONS[options.aspectRatio]
    : undefined;

  const width = options.width ?? dimensions?.width ?? 1920;
  const height = options.height ?? dimensions?.height ?? 1080;

  const scenes = plan.scenes.map((scenePlan, index) =>
    compileScene(scenePlan, index, plan, options.fps, width, height),
  );

  const project = {
    id: options.projectId ?? createId("prj"),
    name: options.projectName ?? deriveProjectName(plan),
    description: plan.prompt,
    fps: options.fps,
    width,
    height,
    style: {
      name: plan.styleName,
      description: plan.styleDescription,
      mood: plan.mood,
      palette: plan.palette,
      typography: buildTypography(plan),
      grain: plan.grain,
      vignette: plan.vignette,
      glow: plan.glow,
      ambientBackground: true,
    },
    scenes: normaliseSceneOrder(scenes),
    assets: [],
    audio: [],
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
  };

  // Parse through the schema so the compiler can never emit an invalid
  // project — a failure here is a bug, not a user error.
  return ProjectSchema.parse(project);
}

/** Derive a project name from the title in the plan. */
function deriveProjectName(plan: VideoPlan): string {
  if (plan.title && plan.title.trim()) return plan.title.trim();
  return "Untitled Project";
}

/** Typography tokens derived from the style. */
function buildTypography(plan: VideoPlan) {
  const isMonochrome = plan.palette.background.toLowerCase() === "#0a0a0a";
  const isLight = plan.palette.background.startsWith("#f") ||
    plan.palette.background.startsWith("#e");

  if (plan.styleName === "Typography") {
    return {
      displayFont:
        "'Inter Tight', 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      bodyFont:
        "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      monoFont: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
      baseFontSize: 32,
      displayScale: 3.2,
      displayTracking: -0.04,
      uppercaseDisplay: true,
    };
  }

  if (plan.styleName === "Editorial") {
    return {
      displayFont:
        "'Playfair Display', 'Georgia', 'Times New Roman', serif",
      bodyFont:
        "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      monoFont: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
      baseFontSize: 30,
      displayScale: 2.9,
      displayTracking: -0.01,
      uppercaseDisplay: false,
    };
  }

  return {
    displayFont:
      plan.styleName === "Documentary"
        ? "'Playfair Display', Georgia, 'Times New Roman', serif"
        : "'Inter Tight', 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    bodyFont: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    monoFont: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
    baseFontSize: isLight ? 30 : 32,
    displayScale: plan.styleName === "Minimalist" ? 2.2 : 2.7,
    displayTracking: isMonochrome ? -0.03 : -0.02,
    uppercaseDisplay: plan.styleName === "Typography",
  };
}

/** Compile one scene plan into a scene. */
function compileScene(
  plan: ScenePlan,
  index: number,
  videoPlan: VideoPlan,
  fps: number,
  width: number,
  height: number,
): Scene {
  const durationInFrames = Math.max(
    fps,
    Math.round(plan.durationSeconds * fps),
  );

  const elements: Element[] = [];
  const palette = videoPlan.palette;

  // Background is expressed as a scene-level property.
  const background = compileBackground(plan, palette, index);

  // The primary beat supplies the copy.
  const primaryBeat = plan.beats[0];

  switch (plan.visual) {
    case "title":
      elements.push(
        ...compileTitleScene(plan, videoPlan, fps, width, height),
      );
      break;
    case "statement":
      elements.push(...compileStatementScene(plan, videoPlan, fps));
      break;
    case "quote":
      elements.push(...compileQuoteScene(plan, videoPlan, fps));
      break;
    case "network":
      elements.push(...compileNetworkScene(plan, videoPlan, fps, width, height));
      break;
    case "diagram":
    case "process":
      elements.push(...compileDiagramScene(plan, videoPlan, fps, width, height));
      break;
    case "chart":
      elements.push(...compileChartScene(plan, videoPlan, fps, width, height));
      break;
    case "particles":
      elements.push(...compileParticlesScene(plan, videoPlan, fps, width, height));
      break;
    case "abstractShapes":
      elements.push(...compileAbstractScene(plan, videoPlan, fps, width, height));
      break;
    case "code":
      elements.push(...compileCodeScene(plan, videoPlan, fps, width, height));
      break;
    case "countdown":
      elements.push(...compileCountdownScene(plan, videoPlan, fps));
      break;
    case "comparison":
      elements.push(...compileStatementScene(plan, videoPlan, fps));
      break;
    default:
      elements.push(...compileStatementScene(plan, videoPlan, fps));
      break;
  }

  // A subtle particle field behind every scene adds depth without noise.
  if (
    videoPlan.styleName !== "Minimalist" &&
    videoPlan.styleName !== "Editorial" &&
    plan.visual !== "particles" &&
    plan.visual !== "chart"
  ) {
    elements.push({
      id: createId("el"),
      type: "particles",
      name: "Ambient Particles",
      visible: true,
      locked: false,
      x: 50,
      y: 50,
      width,
      height,
      scale: 1,
      rotation: 0,
      opacity: 0.5,
      zIndex: -10,
      offsetInFrames: 0,
      durationInFrames: null,
      animation: {
        entrance: {
          type: "fade",
          durationInFrames: Math.round(fps * 0.8),
          delayInFrames: 0,
          staggerInFrames: 0,
          easing: "easeOut",
          distance: 0,
        },
        exit: {
          type: "fade",
          durationInFrames: Math.round(fps * 0.4),
          delayInFrames: 0,
          easing: "easeIn",
          distance: 0,
        },
        loop: {
          type: "none",
          periodInFrames: 120,
          amplitude: 0,
        },
      },
      count: 55,
      color: palette.primary,
      size: 1.8,
      speed: 0.6,
      motion: "drift",
      particleOpacity: 0.42,
      connect: false,
      connectDistance: 150,
    });
  }

  return {
    id: createId("sc"),
    name: plan.name,
    order: index,
    durationInFrames,
    description: plan.summary,
    background,
    camera: compileCamera(plan.camera, fps),
    transition: compileTransition(plan.transition, fps),
    elements,
    audio: [],
    notes: primaryBeat?.intent ?? plan.summary,
  };
}

/** Background configuration from the plan. */
function compileBackground(
  plan: ScenePlan,
  palette: VideoPlan["palette"],
  index: number,
) {
  const isLast = index > 0;

  return {
    type: plan.background,
    color: palette.background,
    color2: palette.surface,
    angle: 120 + index * 40,
    assetId: null,
    gridSize: 72,
    opacity: 1,
    animated: true,
  };
}

/** Camera move from the plan's camera hint. */
function compileCamera(camera: ScenePlan["camera"], fps: number): CameraMove {
  const long = Math.round(fps * 3);
  switch (camera) {
    case "zoomIn":
      return {
        zoomFrom: 1.06,
        zoomTo: 1,
        panXFrom: 0,
        panXTo: 0,
        panYFrom: 0,
        panYTo: 0,
        rotateFrom: 0,
        rotateTo: 0,
        easing: "easeInOut",
      };
    case "zoomOut":
      return {
        zoomFrom: 1,
        zoomTo: 1.08,
        panXFrom: 0,
        panXTo: 0,
        panYFrom: 0,
        panYTo: 0,
        rotateFrom: 0,
        rotateTo: 0,
        easing: "easeInOut",
      };
    case "panLeft":
      return {
        zoomFrom: 1.1,
        zoomTo: 1.1,
        panXFrom: 70,
        panXTo: -70,
        panYFrom: 0,
        panYTo: 0,
        rotateFrom: 0,
        rotateTo: 0,
        easing: "easeInOut",
      };
    case "panRight":
      return {
        zoomFrom: 1.1,
        zoomTo: 1.1,
        panXFrom: -70,
        panXTo: 70,
        panYFrom: 0,
        panYTo: 0,
        rotateFrom: 0,
        rotateTo: 0,
        easing: "easeInOut",
      };
    case "drift":
    default:
      return {
        zoomFrom: 1.04,
        zoomTo: 1.1,
        panXFrom: -22,
        panXTo: 22,
        panYFrom: 14,
        panYTo: -14,
        rotateFrom: -0.6,
        rotateTo: 0.6,
        easing: "easeInOut",
      };
  }
}

/** Transition configuration from the plan. */
function compileTransition(
  transition: ScenePlan["transition"],
  fps: number,
): Transition {
  return {
    type: transition,
    durationInFrames:
      transition === "none" ? 0 : Math.max(6, Math.round(fps * 0.55)),
    easing: "easeInOut",
  };
}

/** Base animation helpers keep entrance timings consistent across scenes. */
function entrance(
  type:
    | "none"
    | "fade"
    | "slideUp"
    | "slideDown"
    | "slideLeft"
    | "slideRight"
    | "scale"
    | "scaleUp"
    | "pop"
    | "blur"
    | "wipeLeft"
    | "wipeRight"
    | "maskUp"
    | "maskLeft"
    | "letterStagger"
    | "wordStagger"
    | "typewriter",
  fps: number,
  seconds = 0.6,
  delaySeconds = 0,
) {
  return {
    type,
    durationInFrames: Math.round(fps * seconds),
    delayInFrames: Math.round(fps * delaySeconds),
    staggerInFrames: Math.max(1, Math.round(fps * 0.035)),
    easing: "easeOut" as const,
    distance: 90,
  };
}

function exit(seconds = 0.4) {
  return {
    type: "fade" as const,
    durationInFrames: Math.round(30 * seconds),
    delayInFrames: 0,
    easing: "easeIn" as const,
    distance: 50,
  };
}

function loop(type: "none" | "float" | "rotate" | "pulse" | "orbit" | "breathe" = "none", period = 90, amplitude = 10) {
  return { type, periodInFrames: period, amplitude };
}

/** Shared element defaults. */
function base(
  overrides: Partial<Element> & { type: Element["type"] },
): Element {
  return {
    id: createId("el"),
    name: "Layer",
    visible: true,
    locked: false,
    x: 50,
    y: 50,
    width: null,
    height: null,
    scale: 1,
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    offsetInFrames: 0,
    durationInFrames: null,
    animation: {
      entrance: entrance("fade", 30),
      exit: exit(),
      loop: loop(),
    },
    ...overrides,
  } as Element;
}

/** --------------------------------------------------------------------- */
/* Scene compilers                                                         */
/** --------------------------------------------------------------------- */

/** Opening scene: a strong title with supporting copy. */
function compileTitleScene(
  plan: ScenePlan,
  videoPlan: VideoPlan,
  fps: number,
  width: number,
  height: number,
): Element[] {
  const palette = videoPlan.palette;
  const elements: Element[] = [];

  // A horizontal rule anchors the title.
  elements.push(
    base({
      type: "shape",
      name: "Title Rule",
      shape: "line",
      x: 50,
      y: videoPlan.subtitle ? 33 : 38,
      width: Math.round(width * 0.16),
      height: 3,
      fill: palette.primary,
      stroke: palette.primary,
      strokeWidth: 3,
      zIndex: 1,
      animation: {
        entrance: entrance("wipeRight", fps, 0.7),
        exit: exit(),
        loop: loop(),
      },
    }),
  );

  elements.push(
    base({
      type: "text",
      name: "Title",
      text: plan.beats[0]?.onScreenText || videoPlan.title,
      variant: "display",
      color: palette.text,
      fontFamily: "display",
      align: "center",
      letterSpacing:
        videoPlan.styleName === "Typography" ? -0.04 : -0.025,
      uppercase: videoPlan.styleName === "Typography",
      accentColor: palette.primary,
      shadow: 0.4,
      maxWidth: Math.round(width * 0.82),
      x: 50,
      y: videoPlan.subtitle ? 44 : 47,
      zIndex: 2,
      animation: {
        entrance: entrance(
          videoPlan.styleName === "Typography" ? "letterStagger" : "maskUp",
          fps,
          0.9,
          0.15,
        ),
        exit: exit(),
        loop: loop(),
      },
    }),
  );

  if (videoPlan.subtitle) {
    elements.push(
      base({
        type: "text",
        name: "Subtitle",
        text: videoPlan.subtitle,
        variant: "subheading",
        color: palette.muted,
        fontFamily: "body",
        align: "center",
        letterSpacing: 0.02,
        shadow: 0.2,
        maxWidth: Math.round(width * 0.7),
        x: 50,
        y: 56,
        zIndex: 2,
        animation: {
          entrance: entrance("slideUp", fps, 0.7, 0.5),
          exit: exit(),
          loop: loop(),
        },
      }),
    );
  }

  return elements;
}

/** Statement scene: one strong line of copy. */
function compileStatementScene(
  plan: ScenePlan,
  videoPlan: VideoPlan,
  fps: number,
): Element[] {
  const palette = videoPlan.palette;
  const beat = plan.beats[0];
  const text = beat?.onScreenText || beat?.intent || plan.summary;

  const elements: Element[] = [
    base({
      type: "text",
      name: "Statement",
      text,
      variant: "heading",
      color: palette.text,
      fontFamily: "display",
      align: "center",
      letterSpacing: -0.02,
      shadow: 0.35,
      maxWidth: 1000,
      x: 50,
      y: 50,
      zIndex: 2,
      animation: {
        entrance: entrance("wordStagger", fps, 0.85),
        exit: exit(),
        loop: loop(),
      },
    }),
  ];

  // A thin accent mark under the statement.
  elements.push(
    base({
      type: "shape",
      name: "Accent Mark",
      shape: "line",
      x: 50,
      y: 62,
      width: 120,
      height: 3,
      fill: palette.primary,
      stroke: palette.primary,
      strokeWidth: 3,
      zIndex: 1,
      animation: {
        entrance: entrance("wipeRight", fps, 0.6, 0.4),
        exit: exit(),
        loop: loop(),
      },
    }),
  );

  if (beat?.supportingText) {
    elements.push(
      base({
        type: "text",
        name: "Supporting Text",
        text: beat.supportingText,
        variant: "body",
        color: palette.muted,
        fontFamily: "body",
        align: "center",
        maxWidth: 900,
        x: 50,
        y: 70,
        zIndex: 2,
        animation: {
          entrance: entrance("fade", fps, 0.6, 0.6),
          exit: exit(),
          loop: loop(),
        },
      }),
    );
  }

  return elements;
}

/** Quote scene: large serif quote with attribution. */
function compileQuoteScene(
  plan: ScenePlan,
  videoPlan: VideoPlan,
  fps: number,
): Element[] {
  const palette = videoPlan.palette;
  const beat = plan.beats[0];
  const quote = beat?.onScreenText || beat?.intent || plan.summary;

  return [
    base({
      type: "text",
      name: "Quote Mark",
      text: "“",
      variant: "display",
      color: palette.primary,
      fontFamily: "display",
      align: "center",
      opacity: 0.45,
      x: 50,
      y: 32,
      zIndex: 1,
      animation: {
        entrance: entrance("scale", fps, 0.7),
        exit: exit(),
        loop: loop(),
      },
    }),
    base({
      type: "text",
      name: "Quote",
      text: quote,
      variant: "heading",
      color: palette.text,
      fontFamily: "display",
      align: "center",
      lineHeight: 1.25,
      shadow: 0.3,
      maxWidth: 1100,
      x: 50,
      y: 48,
      zIndex: 2,
      animation: {
        entrance: entrance("maskUp", fps, 0.9),
        exit: exit(),
        loop: loop(),
      },
    }),
    base({
      type: "shape",
      name: "Quote Rule",
      shape: "line",
      x: 50,
      y: 68,
      width: 90,
      height: 2,
      fill: palette.primary,
      stroke: palette.primary,
      strokeWidth: 2,
      zIndex: 1,
      animation: {
        entrance: entrance("wipeRight", fps, 0.5, 0.5),
        exit: exit(),
        loop: loop(),
      },
    }),
  ];
}

/** Network scene: an animated graph with a headline. */
function compileNetworkScene(
  plan: ScenePlan,
  videoPlan: VideoPlan,
  fps: number,
  width: number,
  height: number,
): Element[] {
  const palette = videoPlan.palette;
  const random = createRandom(plan.name.length * 977);

  const elements: Element[] = [
    base({
      type: "network",
      name: "Network Graph",
      x: 50,
      y: 54,
      width: Math.round(width * 0.68),
      height: Math.round(height * 0.62),
      nodeCount: 16,
      density: 0.24,
      layout: random() > 0.5 ? "radial" : "spiral",
      nodeColor: palette.primary,
      edgeColor: `${palette.secondary}88`,
      nodeRadius: 7,
      edgeWidth: 1.4,
      pulse: true,
      staggered: true,
      spin: 0,
      zIndex: 1,
      animation: {
        entrance: entrance("scale", fps, 1.2),
        exit: exit(),
        loop: loop("rotate", 900, 360),
      },
    }),
  ];

  const beat = plan.beats[0];
  if (beat?.onScreenText || beat?.intent) {
    elements.push(
      base({
        type: "text",
        name: "Network Headline",
        text: beat.onScreenText || beat.intent,
        variant: "heading",
        color: palette.text,
        fontFamily: "display",
        align: "center",
        maxWidth: 760,
        x: 50,
        y: 18,
        zIndex: 2,
        animation: {
          entrance: entrance("slideUp", fps, 0.7),
          exit: exit(),
          loop: loop(),
        },
      }),
    );
  }

  return elements;
}

/** Diagram scene: labelled boxes connected in a flow. */
function compileDiagramScene(
  plan: ScenePlan,
  videoPlan: VideoPlan,
  fps: number,
  width: number,
  height: number,
): Element[] {
  const palette = videoPlan.palette;
  const nodeData = plan.data.nodes.length
    ? plan.data.nodes
    : [
        { label: "Input", sublabel: "source" },
        { label: "Process", sublabel: "transform" },
        { label: "Output", sublabel: "result" },
      ];

  const columns = nodeData.length <= 3 ? nodeData.length : Math.ceil(nodeData.length / 2);
  const rows = Math.ceil(nodeData.length / columns);

  const nodes = nodeData.map((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      id: createId("node"),
      label: node.label,
      sublabel: node.sublabel,
      color: index === nodeData.length - 1 ? palette.primary : palette.secondary,
      x: columns === 1 ? 0.5 : 0.16 + (column / (columns - 1)) * 0.68,
      y: rows === 1 ? 0.5 : 0.32 + (row / Math.max(1, rows - 1)) * 0.36,
      width: 0.24,
      height: 0.18,
    };
  });

  const elements: Element[] = [
    base({
      type: "diagram",
      name: "Diagram",
      x: 50,
      y: 54,
      width: Math.round(width * 0.78),
      height: Math.round(height * 0.5),
      nodes,
      connectors: true,
      connectorColor: `${palette.muted}99`,
      animatedConnectors: true,
      showLabels: true,
      staggered: true,
      zIndex: 1,
      animation: {
        entrance: entrance("fade", fps, 0.5),
        exit: exit(),
        loop: loop(),
      },
    }),
  ];

  const beat = plan.beats[0];
  elements.push(
    base({
      type: "text",
      name: "Diagram Headline",
      text: beat?.onScreenText || beat?.intent || plan.summary,
      variant: "heading",
      color: palette.text,
      fontFamily: "display",
      align: "center",
      maxWidth: 900,
      x: 50,
      y: 20,
      zIndex: 2,
      animation: {
        entrance: entrance("slideUp", fps, 0.7),
        exit: exit(),
        loop: loop(),
      },
    }),
  );

  return elements;
}

/** Chart scene: animated bars with labels. */
function compileChartScene(
  plan: ScenePlan,
  videoPlan: VideoPlan,
  fps: number,
  width: number,
  height: number,
): Element[] {
  const palette = videoPlan.palette;
  const series = plan.data.series.length
    ? plan.data.series.map((item, index) => ({
        label: item.label,
        value: item.value,
        color:
          index === 0
            ? palette.primary
            : index === 1
              ? palette.secondary
              : `${palette.primary}${index % 2 === 0 ? "cc" : "99"}`,
      }))
    : [
        { label: "Signal", value: 42, color: palette.primary },
        { label: "Noise", value: 18, color: palette.secondary },
        { label: "Growth", value: 67, color: `${palette.primary}bb` },
      ];

  const elements: Element[] = [
    base({
      type: "chart",
      name: "Data Chart",
      chartType: "bar",
      series,
      maxValue: null,
      showValues: true,
      showAxis: true,
      barGap: 0.4,
      lineWidth: 4,
      x: 50,
      y: 56,
      width: Math.round(width * 0.6),
      height: Math.round(height * 0.46),
      zIndex: 1,
      animation: {
        entrance: entrance("fade", fps, 0.4),
        exit: exit(),
        loop: loop(),
      },
    }),
  ];

  const beat = plan.beats[0];
  elements.push(
    base({
      type: "text",
      name: "Chart Headline",
      text: beat?.onScreenText || beat?.intent || plan.summary,
      variant: "heading",
      color: palette.text,
      fontFamily: "display",
      align: "center",
      maxWidth: 800,
      x: 50,
      y: 22,
      zIndex: 2,
      animation: {
        entrance: entrance("slideUp", fps, 0.7),
        exit: exit(),
        loop: loop(),
      },
    }),
  );

  return elements;
}

/** Particle scene: a drifting field with a headline. */
function compileParticlesScene(
  plan: ScenePlan,
  videoPlan: VideoPlan,
  fps: number,
  width: number,
  height: number,
): Element[] {
  const palette = videoPlan.palette;

  const elements: Element[] = [
    base({
      type: "particles",
      name: "Particle Field",
      x: 50,
      y: 50,
      width,
      height,
      count: 140,
      color: palette.primary,
      size: 2.6,
      speed: 0.85,
      motion: "drift",
      particleOpacity: 0.6,
      connect: true,
      connectDistance: 140,
      zIndex: 0,
      animation: {
        entrance: entrance("fade", fps, 1),
        exit: exit(),
        loop: loop(),
      },
    }),
  ];

  const beat = plan.beats[0];
  if (beat?.onScreenText || beat?.intent) {
    elements.push(
      base({
        type: "text",
        name: "Field Headline",
        text: beat.onScreenText || beat.intent,
        variant: "heading",
        color: palette.text,
        fontFamily: "display",
        align: "center",
        maxWidth: 820,
        x: 50,
        y: 50,
        zIndex: 2,
        animation: {
          entrance: entrance("maskUp", fps, 0.9),
          exit: exit(),
          loop: loop(),
        },
      }),
    );
  }

  return elements;
}

/** Abstract scene: layered geometric forms in motion. */
function compileAbstractScene(
  plan: ScenePlan,
  videoPlan: VideoPlan,
  fps: number,
  width: number,
  height: number,
): Element[] {
  const palette = videoPlan.palette;
  const random = createRandom(plan.summary.length * 313 + plan.name.length);

  const elements: Element[] = [];

  // Three overlapping shapes establish depth through scale + opacity.
  const shapeSpecs = [
    { shape: "circle" as const, size: 0.36, x: 32, y: 40, color: palette.primary, opacity: 0.32, z: 0 },
    { shape: "blob" as const, size: 0.3, x: 64, y: 55, color: palette.secondary, opacity: 0.28, z: 1 },
    { shape: "polygon" as const, size: 0.24, x: 50, y: 34, color: palette.primary, opacity: 0.22, z: 2 },
  ];

  shapeSpecs.forEach((spec, index) => {
    elements.push(
      base({
        type: "shape",
        name: `Form ${index + 1}`,
        shape: spec.shape,
        x: spec.x,
        y: spec.y,
        width: Math.round(width * spec.size),
        height: Math.round(width * spec.size),
        fill: spec.color,
        stroke: null,
        strokeWidth: 0,
        radius: 0,
        sides: 6,
        glow: 40,
        opacity: spec.opacity,
        zIndex: spec.z,
        animation: {
          entrance: entrance("scale", fps, 1.1, index * 0.12),
          exit: exit(),
          loop: loop("float", 120 + index * 30, 26 + index * 10),
        },
      }),
    );
  });

  const beat = plan.beats[0];
  if (beat?.onScreenText || beat?.intent) {
    elements.push(
      base({
        type: "text",
        name: "Abstract Headline",
        text: beat.onScreenText || beat.intent,
        variant: "heading",
        color: palette.text,
        fontFamily: "display",
        align: "center",
        maxWidth: 840,
        x: 50,
        y: 72,
        zIndex: 5,
        animation: {
          entrance: entrance("fade", fps, 0.8, 0.5),
          exit: exit(),
          loop: loop(),
        },
      }),
    );
  }

  return elements;
}

/** Code scene: a monospace block revealed line by line. */
function compileCodeScene(
  plan: ScenePlan,
  videoPlan: VideoPlan,
  fps: number,
  width: number,
  height: number,
): Element[] {
  const palette = videoPlan.palette;
  const lines = plan.data.lines.length
    ? plan.data.lines
    : ["const result = await run(input);", "return result;"];

  return [
    base({
      type: "text",
      name: "Code Block",
      text: lines.join("\n"),
      variant: "body",
      color: palette.text,
      fontFamily: "mono",
      align: "left",
      lineHeight: 1.6,
      letterSpacing: 0,
      shadow: 0.2,
      x: 50,
      y: 50,
      maxWidth: Math.round(width * 0.62),
      zIndex: 2,
      animation: {
        entrance: entrance("typewriter", fps, 2.2),
        exit: exit(),
        loop: loop(),
      },
    }),
    base({
      type: "shape",
      name: "Code Frame",
      shape: "rect",
      x: 50,
      y: 50,
      width: Math.round(width * 0.68),
      height: Math.round(height * 0.52),
      fill: "transparent",
      stroke: `${palette.muted}55`,
      strokeWidth: 2,
      radius: 18,
      sides: 6,
      glow: 0,
      opacity: 0.7,
      zIndex: 1,
      animation: {
        entrance: entrance("fade", fps, 0.6),
        exit: exit(),
        loop: loop(),
      },
    }),
  ];
}

/** Countdown scene: large numerals that tick down. */
function compileCountdownScene(
  plan: ScenePlan,
  videoPlan: VideoPlan,
  fps: number,
): Element[] {
  const palette = videoPlan.palette;
  const beat = plan.beats[0];

  return [
    base({
      type: "text",
      name: "Countdown",
      text: beat?.onScreenText || beat?.intent || "3 · 2 · 1",
      variant: "display",
      color: palette.primary,
      fontFamily: "display",
      align: "center",
      shadow: 0.5,
      x: 50,
      y: 48,
      zIndex: 2,
      animation: {
        entrance: entrance("pop", fps, 0.6),
        exit: exit(),
        loop: loop("pulse", 40, 12),
      },
    }),
  ];
}
