import { z } from "zod";
import { AnimationSchema } from "./animation.schema.js";

/**
 * Visual style tokens.
 *
 * The AI planner picks a palette + typography combination per project and the
 * renderer uses it as a single source of truth. Keeping this in the project
 * (rather than hardcoding colours in elements) is what allows a whole-project
 * "style transformation" to be a one-object mutation.
 */

export const PaletteSchema = z.object({
  /** Deepest background colour. */
  background: z.string().min(1).default("#07090f"),
  /** Slightly raised background used for panels/cards. */
  surface: z.string().min(1).default("#11151f"),
  /** Primary brand / accent hue. */
  primary: z.string().min(1).default("#5eead4"),
  /** Secondary accent used for supporting elements. */
  secondary: z.string().min(1).default("#818cf8"),
  /** Foreground text colour. */
  text: z.string().min(1).default("#f8fafc"),
  /** De-emphasised text / hairlines. */
  muted: z.string().min(1).default("#64748b"),
});
export type Palette = z.infer<typeof PaletteSchema>;

export const TypographySchema = z.object({
  /** Display face used for titles and hero copy. */
  displayFont: z
    .string()
    .min(1)
    .default("Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"),
  /** Body face used for supporting copy. */
  bodyFont: z
    .string()
    .min(1)
    .default("Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"),
  /** Monospace face used for code and technical labels. */
  monoFont: z
    .string()
    .min(1)
    .default("'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace"),
  /** Base body size in pixels. */
  baseFontSize: z.number().int().min(8).max(72).default(32),
  /** Multiplier applied to display type. */
  displayScale: z.number().min(0.5).max(6).default(2.6),
  /** Letter spacing for display type, in em. */
  displayTracking: z.number().min(-0.2).max(0.6).default(-0.02),
  /** Uppercase display type. */
  uppercaseDisplay: z.boolean().default(false),
});
export type Typography = z.infer<typeof TypographySchema>;

export const VisualStyleSchema = z.object({
  /** Human readable style name, e.g. "Cinematic Futurism". */
  name: z.string().min(1).default("Cinematic Dark"),
  /** One-line description of the look. */
  description: z.string().default(""),
  /** Mood keywords that drive music / pacing suggestions. */
  mood: z.array(z.string()).default(["focused", "modern"]),
  palette: PaletteSchema.default(PaletteSchema.parse({})),
  typography: TypographySchema.default(TypographySchema.parse({})),
  /** Global grain / noise overlay intensity, 0..1. */
  grain: z.number().min(0).max(1).default(0.06),
  /** Vignette strength, 0..1. */
  vignette: z.number().min(0).max(1).default(0.35),
  /** Bloom / glow strength, 0..1. */
  glow: z.number().min(0).max(1).default(0.4),
  /** Enable a subtle animated background field. */
  ambientBackground: z.boolean().default(true),
});
export type VisualStyle = z.infer<typeof VisualStyleSchema>;

/**
 * Background layers sit behind every element of a scene.
 */
export const BackgroundSchema = z.object({
  type: z.enum([
    "solid",
    "linearGradient",
    "radialGradient",
    "mesh",
    "grid",
    "dots",
    "noise",
    "image",
    "video",
  ]).default("linearGradient"),
  /** Primary colour. */
  color: z.string().min(1).default("#07090f"),
  /** Secondary colour used by gradients. */
  color2: z.string().min(1).default("#11151f"),
  /** Gradient angle in degrees. */
  angle: z.number().min(0).max(360).default(160),
  /** Background asset id (image/video backgrounds). */
  assetId: z.string().nullable().default(null),
  /** Grid spacing in pixels. */
  gridSize: z.number().int().min(8).max(400).default(64),
  /** Overall opacity, 0..1. */
  opacity: z.number().min(0).max(1).default(1),
  /** Enable a slow drift for gradients / grids. */
  animated: z.boolean().default(true),
});
export type Background = z.infer<typeof BackgroundSchema>;

/**
 * Base fields shared by every element in a scene.
 */
export const ElementBaseSchema = z.object({
  id: z.string().min(1),
  /** Layer name shown in the inspector / layer list. */
  name: z.string().default("Layer"),
  /** Whether the element is visible in preview and render. */
  visible: z.boolean().default(true),
  /** Whether the element is locked against selection in the preview. */
  locked: z.boolean().default(false),
  /** Position as a percentage of the canvas, 0..100. */
  x: z.number().min(-100).max(200).default(50),
  y: z.number().min(-100).max(200).default(50),
  /** Explicit width in pixels. Omit to auto-size. */
  width: z.number().min(1).max(8000).nullable().default(null),
  /** Explicit height in pixels. Omit to auto-size. */
  height: z.number().min(1).max(8000).nullable().default(null),
  scale: z.number().min(0.01).max(20).default(1),
  rotation: z.number().min(-360).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  /** Stacking order within the scene. Higher renders on top; negative values
   *  place the element behind the default layer. */
  zIndex: z.number().int().min(-1000).max(1000).default(0),
  /** Offset of the element's own timeline relative to the scene start. */
  offsetInFrames: z.number().int().min(0).max(100000).default(0),
  /** How long the element lives; `null` means until the end of the scene. */
  durationInFrames: z.number().int().min(1).max(100000).nullable().default(null),
  animation: AnimationSchema.default(AnimationSchema.parse({})),
});
export type ElementBase = z.infer<typeof ElementBaseSchema>;

/** Text element. */
export const TextElementSchema = ElementBaseSchema.extend({
  type: z.literal("text"),
  text: z.string().default(""),
  /** Typographic role, drives font size and tracking. */
  variant: z
    .enum(["display", "heading", "subheading", "body", "caption", "label"])
    .default("heading"),
  color: z.string().min(1).default("#f8fafc"),
  /** Which font token to use. */
  fontFamily: z.enum(["display", "body", "mono"]).default("display"),
  align: z.enum(["left", "center", "right"]).default("center"),
  /** Maximum width in pixels before wrapping. */
  maxWidth: z.number().min(40).max(8000).nullable().default(null),
  lineHeight: z.number().min(0.6).max(3).default(1.1),
  letterSpacing: z.number().min(-0.3).max(1).default(-0.02),
  uppercase: z.boolean().default(false),
  /** Optional highlight colour applied to a `**marker**` segment. */
  accentColor: z.string().min(1).default("#5eead4"),
  /** Text shadow strength, 0..1. */
  shadow: z.number().min(0).max(1).default(0.35),
});
export type TextElement = z.infer<typeof TextElementSchema>;

/** Geometric shape element. */
export const ShapeElementSchema = ElementBaseSchema.extend({
  type: z.literal("shape"),
  shape: z
    .enum(["rect", "circle", "triangle", "line", "polygon", "ring", "blob"])
    .default("rect"),
  fill: z.string().min(1).default("#5eead4"),
  /** When set, the shape renders as a stroke instead of a fill. */
  stroke: z.string().min(1).nullable().default(null),
  strokeWidth: z.number().min(0).max(200).default(0),
  /** Corner radius for rects. */
  radius: z.number().min(0).max(2000).default(0),
  /** Number of sides for polygons. */
  sides: z.number().int().min(3).max(12).default(6),
  /** Glow radius in pixels. */
  glow: z.number().min(0).max(200).default(0),
});
export type ShapeElement = z.infer<typeof ShapeElementSchema>;

/** Raster asset (image) element. */
export const ImageElementSchema = ElementBaseSchema.extend({
  type: z.literal("image"),
  assetId: z.string().min(1),
  /** How the image fills its box. */
  fit: z.enum(["cover", "contain", "fill"]).default("cover"),
  /** Optional circular mask. */
  mask: z.enum(["none", "circle", "rounded"]).default("none"),
  radius: z.number().min(0).max(2000).default(0),
  /** Colour multiplied over the image for grading. */
  tint: z.string().nullable().default(null),
  tintOpacity: z.number().min(0).max(1).default(0.35),
});
export type ImageElement = z.infer<typeof ImageElementSchema>;

/** Video asset element. */
export const VideoElementSchema = ElementBaseSchema.extend({
  type: z.literal("video"),
  assetId: z.string().min(1),
  fit: z.enum(["cover", "contain", "fill"]).default("cover"),
  muted: z.boolean().default(true),
  volume: z.number().min(0).max(2).default(1),
});
export type VideoElement = z.infer<typeof VideoElementSchema>;

/** Icon element drawn from a bundled SVG icon set. */
export const IconElementSchema = ElementBaseSchema.extend({
  type: z.literal("icon"),
  /** Icon identifier, see `packages/video-components/src/icons`. */
  icon: z.string().min(1).default("sparkles"),
  color: z.string().min(1).default("#5eead4"),
  strokeWidth: z.number().min(0.5).max(10).default(1.75),
  filled: z.boolean().default(false),
});
export type IconElement = z.infer<typeof IconElementSchema>;

/** A single bar / line / point in a chart element. */
export const ChartSeriesSchema = z.object({
  label: z.string().default(""),
  value: z.number().default(0),
  color: z.string().min(1).default("#5eead4"),
});
export type ChartSeries = z.infer<typeof ChartSeriesSchema>;

export const ChartElementSchema = ElementBaseSchema.extend({
  type: z.literal("chart"),
  chartType: z.enum(["bar", "line", "area", "donut", "progress"]).default("bar"),
  series: z.array(ChartSeriesSchema).default([]),
  /** Maximum value used to normalise bars. */
  maxValue: z.number().min(0).nullable().default(null),
  /** Show value labels next to bars. */
  showValues: z.boolean().default(true),
  /** Show the axis baseline. */
  showAxis: z.boolean().default(true),
  /** Bar gap as a fraction of the slot width. */
  barGap: z.number().min(0).max(0.9).default(0.35),
  lineWidth: z.number().min(1).max(40).default(4),
});
export type ChartElement = z.infer<typeof ChartElementSchema>;

/** Node/edge graph, used for network and diagram visualisations. */
export const NetworkElementSchema = ElementBaseSchema.extend({
  type: z.literal("network"),
  /** Number of nodes in the graph. */
  nodeCount: z.number().int().min(1).max(200).default(12),
  /** Probability (0..1) that a given node pair is connected. */
  density: z.number().min(0).max(1).default(0.35),
  /** Graph layout algorithm. */
  layout: z.enum(["radial", "grid", "random", "spiral"]).default("radial"),
  nodeColor: z.string().min(1).default("#5eead4"),
  edgeColor: z.string().min(1).default("#334155"),
  nodeRadius: z.number().min(2).max(200).default(8),
  edgeWidth: z.number().min(0.5).max(20).default(1.5),
  /** Animate a travelling pulse along the edges. */
  pulse: z.boolean().default(true),
  /** Reveal nodes one-by-one instead of all at once. */
  staggered: z.boolean().default(true),
  /** Rotation of the whole graph in degrees. */
  spin: z.number().min(-360).max(360).default(0),
});
export type NetworkElement = z.infer<typeof NetworkElementSchema>;

/** Particle field element. */
export const ParticlesElementSchema = ElementBaseSchema.extend({
  type: z.literal("particles"),
  count: z.number().int().min(1).max(2000).default(90),
  color: z.string().min(1).default("#5eead4"),
  size: z.number().min(0.5).max(40).default(2.5),
  /** Particle drift speed multiplier. */
  speed: z.number().min(0).max(20).default(1),
  /** Movement style. */
  motion: z.enum(["drift", "rise", "orbit", "rain", "scatter"]).default("drift"),
  /** Particle opacity. */
  particleOpacity: z.number().min(0).max(1).default(0.7),
  /** Connect nearby particles with lines (constellation look). */
  connect: z.boolean().default(false),
  /** Distance threshold for `connect`, in pixels. */
  connectDistance: z.number().min(10).max(1000).default(150),
});
export type ParticlesElement = z.infer<typeof ParticlesElementSchema>;

/** A labelled box in a flow / diagram element. */
export const DiagramNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().default(""),
  sublabel: z.string().default(""),
  color: z.string().min(1).default("#5eead4"),
  /** Relative x within the diagram box, 0..1. */
  x: z.number().min(0).max(1).default(0.5),
  /** Relative y within the diagram box, 0..1. */
  y: z.number().min(0).max(1).default(0.5),
  /** Node width as a fraction of the diagram box. */
  width: z.number().min(0.05).max(1).default(0.24),
  height: z.number().min(0.02).max(1).default(0.16),
});
export type DiagramNode = z.infer<typeof DiagramNodeSchema>;

export const DiagramElementSchema = ElementBaseSchema.extend({
  type: z.literal("diagram"),
  nodes: z.array(DiagramNodeSchema).default([]),
  /** Draw connectors between consecutive nodes. */
  connectors: z.boolean().default(true),
  connectorColor: z.string().min(1).default("#334155"),
  /** Animate connectors as travelling dashes. */
  animatedConnectors: z.boolean().default(true),
  /** Show node labels. */
  showLabels: z.boolean().default(true),
  /** Reveal nodes in sequence. */
  staggered: z.boolean().default(true),
});
export type DiagramElement = z.infer<typeof DiagramElementSchema>;

/** Grouped elements, so the inspector can move several layers at once. */
export const GroupElementSchema = ElementBaseSchema.extend({
  type: z.literal("group"),
  children: z.array(z.unknown()).default([]),
});
export type GroupElement = z.infer<typeof GroupElementSchema>;

export const ElementSchema = z.discriminatedUnion("type", [
  TextElementSchema,
  ShapeElementSchema,
  ImageElementSchema,
  VideoElementSchema,
  IconElementSchema,
  ChartElementSchema,
  NetworkElementSchema,
  ParticlesElementSchema,
  DiagramElementSchema,
  GroupElementSchema,
]);
export type Element = z.infer<typeof ElementSchema>;

/** Any element that carries an animation block. */
export const AnimatedElementSchema = ElementSchema;
export type AnimatedElement = Element;
