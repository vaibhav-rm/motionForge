import type { PlanPalette } from "@motionforge/video-schema";

/**
 * Style system.
 *
 * Each style is a complete visual direction: palette, typography behaviour,
 * atmosphere and pacing. Styles are *suggestions* — a prompt can combine
 * them or override individual tokens — but every style here is a genuinely
 * different look rather than a recolour of the same template.
 */

export interface StyleDefinition {
  name: string;
  description: string;
  palette: PlanPalette;
  grain: number;
  vignette: number;
  glow: number;
  /** Mood keywords applied to the project. */
  mood: string[];
  /** Base pacing in seconds per scene — lower means denser cutting. */
  pacing: number;
}

export const STYLES: Record<string, StyleDefinition> = {
  Cinematic: {
    name: "Cinematic",
    description:
      "Deep contrast, restrained typography and deliberate camera movement.",
    palette: {
      background: "#05070c",
      surface: "#0d121c",
      primary: "#f5c451",
      secondary: "#5b8def",
      text: "#f7f9fc",
      muted: "#7c8798",
    },
    grain: 0.11,
    vignette: 0.5,
    glow: 0.3,
    mood: ["focused", "dramatic", "cinematic"],
    pacing: 4.2,
  },
  Minimalist: {
    name: "Minimalist",
    description:
      "Generous negative space, one accent colour and unhurried reveals.",
    palette: {
      background: "#fbfbfd",
      surface: "#f1f2f6",
      primary: "#111827",
      secondary: "#6b7280",
      text: "#111827",
      muted: "#9ca3af",
    },
    grain: 0.02,
    vignette: 0.08,
    glow: 0.08,
    mood: ["calm", "precise", "restrained"],
    pacing: 5,
  },
  Documentary: {
    name: "Documentary",
    description:
      "Warm archival tones, editorial framing and typographic restraint.",
    palette: {
      background: "#141210",
      surface: "#241f1a",
      primary: "#e8b473",
      secondary: "#a05c3b",
      text: "#f5efe6",
      muted: "#9a8b7c",
    },
    grain: 0.15,
    vignette: 0.42,
    glow: 0.16,
    mood: ["warm", "grounded", "narrative"],
    pacing: 5.4,
  },
  "Sci-Fi": {
    name: "Sci-Fi",
    description:
      "Electric cyan light in deep space, holographic surfaces and slow drift.",
    palette: {
      background: "#03060f",
      surface: "#081428",
      primary: "#4de3ff",
      secondary: "#7b5cff",
      text: "#eaf6ff",
      muted: "#5b7391",
    },
    grain: 0.07,
    vignette: 0.45,
    glow: 0.62,
    mood: ["futuristic", "vast", "electric"],
    pacing: 4,
  },
  Retro: {
    name: "Retro",
    description:
      "Warm analogue decay, sun-bleached colour and VHS texture.",
    palette: {
      background: "#1a1410",
      surface: "#2c211a",
      primary: "#ff7a3d",
      secondary: "#f5c34e",
      text: "#ffeede",
      muted: "#a8907d",
    },
    grain: 0.22,
    vignette: 0.4,
    glow: 0.22,
    mood: ["nostalgic", "warm", "analog"],
    pacing: 4.6,
  },
  Abstract: {
    name: "Abstract",
    description:
      "Generative fields, soft chromatic drift and non-representational form.",
    palette: {
      background: "#07060d",
      surface: "#131024",
      primary: "#c084fc",
      secondary: "#38bdf8",
      text: "#f5f3ff",
      muted: "#7d7594",
    },
    grain: 0.09,
    vignette: 0.3,
    glow: 0.55,
    mood: ["fluid", "experimental", "evolving"],
    pacing: 4.4,
  },
  Geometric: {
    name: "Geometric",
    description:
      "Confident flat shapes, hard edges and rhythmic structure.",
    palette: {
      background: "#0e0e12",
      surface: "#1a1a22",
      primary: "#ff4d4d",
      secondary: "#ffd23f",
      text: "#fafafa",
      muted: "#6f6f7d",
    },
    grain: 0.04,
    vignette: 0.18,
    glow: 0.12,
    mood: ["bold", "rhythmic", "designed"],
    pacing: 3.6,
  },
  Editorial: {
    name: "Editorial",
    description:
      "Magazine-scale typography, asymmetric layout and sharp contrast.",
    palette: {
      background: "#f7f6f2",
      surface: "#e7e5de",
      primary: "#e03e3e",
      secondary: "#1c1c1c",
      text: "#121212",
      muted: "#8b8b85",
    },
    grain: 0.05,
    vignette: 0.05,
    glow: 0.05,
    mood: ["bold", "editorial", "confident"],
    pacing: 4,
  },
  Corporate: {
    name: "Corporate",
    description:
      "Clean blue-white palette, structured diagrams and assured pacing.",
    palette: {
      background: "#f8fafc",
      surface: "#eef2f7",
      primary: "#2563eb",
      secondary: "#0ea5e9",
      text: "#0f172a",
      muted: "#94a3b8",
    },
    grain: 0.02,
    vignette: 0.06,
    glow: 0.1,
    mood: ["professional", "clear", "trustworthy"],
    pacing: 4.8,
  },
  Scientific: {
    name: "Scientific",
    description:
      "Lab-clean surfaces, annotated data and measured movement.",
    palette: {
      background: "#0b1220",
      surface: "#131c2e",
      primary: "#22d3ee",
      secondary: "#a3e635",
      text: "#e6f1ff",
      muted: "#6b7f9e",
    },
    grain: 0.05,
    vignette: 0.28,
    glow: 0.34,
    mood: ["clinical", "precise", "lucid"],
    pacing: 4.6,
  },
  Typography: {
    name: "Typography",
    description:
      "Type as the image — kinetic letterforms, scale contrast and rhythm.",
    palette: {
      background: "#0a0a0a",
      surface: "#171717",
      primary: "#fafafa",
      secondary: "#a3a3a3",
      text: "#ffffff",
      muted: "#737373",
    },
    grain: 0.08,
    vignette: 0.25,
    glow: 0.18,
    mood: ["expressive", "typographic", "rhythmic"],
    pacing: 3.8,
  },
  Atmospheric: {
    name: "Atmospheric",
    description:
      "Soft haze, low contrast and slow dissolves between states.",
    palette: {
      background: "#0d1117",
      surface: "#1a2230",
      primary: "#7dd3fc",
      secondary: "#a78bfa",
      text: "#eef4fb",
      muted: "#64748b",
    },
    grain: 0.13,
    vignette: 0.34,
    glow: 0.45,
    mood: ["dreamy", "slow", "immersive"],
    pacing: 5.6,
  },
  "Neon Cyberpunk": {
    name: "Neon Cyberpunk",
    description:
      "Magenta and acid green on wet black, hard rim light and static.",
    palette: {
      background: "#08030f",
      surface: "#150726",
      primary: "#ff2e9a",
      secondary: "#b6ff3d",
      text: "#fdf4ff",
      muted: "#8b5fa8",
    },
    grain: 0.16,
    vignette: 0.46,
    glow: 0.7,
    mood: ["electric", "rebellious", "noisy"],
    pacing: 3.4,
  },
  Playful: {
    name: "Playful",
    description:
      "Bright saturated colour, bouncing shapes and upbeat timing.",
    palette: {
      background: "#fff9f2",
      surface: "#ffeede",
      primary: "#f97316",
      secondary: "#8b5cf6",
      text: "#1c1917",
      muted: "#a8a29e",
    },
    grain: 0.03,
    vignette: 0.06,
    glow: 0.14,
    mood: ["upbeat", "colourful", "friendly"],
    pacing: 3.4,
  },
  Monochrome: {
    name: "Monochrome",
    description:
      "Pure value contrast, no colour, refined weight and spacing.",
    palette: {
      background: "#0a0a0a",
      surface: "#161616",
      primary: "#ffffff",
      secondary: "#a3a3a3",
      text: "#ffffff",
      muted: "#737373",
    },
    grain: 0.1,
    vignette: 0.38,
    glow: 0.1,
    mood: ["stark", "focused", "timeless"],
    pacing: 4.4,
  },
};

/** Colour overrides applied when the prompt names a specific hue. */
const HUE_OVERRIDES: Record<string, Partial<PlanPalette>> = {
  cyan: { primary: "#22d3ee", secondary: "#0891b2" },
  blue: { primary: "#3b82f6", secondary: "#1d4ed8" },
  purple: { primary: "#a855f7", secondary: "#7e22ce" },
  pink: { primary: "#ec4899", secondary: "#be185d" },
  red: { primary: "#ef4444", secondary: "#b91c1c" },
  orange: { primary: "#f97316", secondary: "#c2410c" },
  yellow: { primary: "#eab308", secondary: "#a16207" },
  green: { primary: "#22c55e", secondary: "#15803d" },
  monochrome: {
    primary: "#ffffff",
    secondary: "#a3a3a3",
    background: "#0a0a0a",
    surface: "#161616",
    text: "#ffffff",
    muted: "#737373",
  },
};

/**
 * Resolve a concrete style from a prompt's detected style keywords and
 * palette hints.
 */
export function resolveStyle(options: {
  styles: string[];
  paletteHints: string[];
  moods: string[];
  fallbackName?: string;
}): StyleDefinition {
  const matched = options.styles
    .map((name) => STYLES[name])
    .filter((definition): definition is StyleDefinition => Boolean(definition));

  const fallback =
    options.fallbackName && STYLES[options.fallbackName]
      ? STYLES[options.fallbackName]
      : STYLES.Cinematic;

  const primaryStyle = matched[0] ?? fallback;

  const definition: StyleDefinition = {
    ...primaryStyle,
    palette: { ...primaryStyle.palette },
    mood: [...primaryStyle.mood],
  };

  // Explicit colour requests override the palette's accent colours.
  for (const hint of options.paletteHints) {
    const override = HUE_OVERRIDES[hint];
    if (override) {
      definition.palette = { ...definition.palette, ...override };
    }
  }

  // Prompt moods adjust pacing: energetic prompts cut faster.
  if (options.moods.includes("energetic")) definition.pacing *= 0.82;
  if (options.moods.includes("calm") || options.moods.includes("epic")) {
    definition.pacing *= 1.15;
  }

  return definition;
}
