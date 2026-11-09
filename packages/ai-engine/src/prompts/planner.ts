import type { ScenePlan, VideoPlan } from "@motionforge/video-schema";
import type { PromptAnalysis } from "./analyse.js";
import type { StyleDefinition } from "./styles.js";

/**
 * Scene planning.
 *
 * The planner's job is to produce a *directed* sequence: an opening that
 * establishes atmosphere, a middle that develops the idea, and a close that
 * resolves it. It uses the topic detected in the prompt to choose visual
 * archetypes and the detected sentences as beats, so the resulting video
 * reflects what the user actually asked for rather than a generic template.
 */

/** A visual archetype the planner can emit. */
type Visual = ScenePlan["visual"];

/** Topic → the sequence of visuals that tells that story well. */
const TOPIC_ARC: Record<string, Visual[]> = {
  network: ["title", "network", "network", "diagram", "statement"],
  processor: ["title", "abstractShapes", "diagram", "network", "statement"],
  ai: ["title", "network", "abstractShapes", "diagram", "statement"],
  data: ["title", "chart", "chart", "statement", "statement"],  product: ["title", "statement", "abstractShapes", "chart", "statement"],
  code: ["title", "code", "diagram", "code", "statement"],
  education: ["title", "diagram", "diagram", "chart", "statement"],
  architecture: ["title", "diagram", "network", "diagram", "statement"],
  team: ["title", "statement", "network", "diagram", "statement"],
  space: ["title", "particles", "abstractShapes", "network", "statement"],
  fluid: ["title", "particles", "abstractShapes", "particles", "statement"],
  city: ["title", "abstractShapes", "network", "particles", "statement"],
  music: ["title", "abstractShapes", "particles", "chart", "statement"],
  quote: ["title", "quote", "statement", "quote", "statement"],
  countdown: ["title", "countdown", "statement", "countdown", "statement"],
  particles: ["title", "particles", "abstractShapes", "particles", "statement"],
};

/** Generic arc when no topic is detected. */
const DEFAULT_ARC: Visual[] = [
  "title",
  "statement",
  "abstractShapes",
  "process",
  "statement",
];

/** How the video should open, keyed by detected style. */
const OPENING_TREATMENT: Record<string, Visual> = {
  Cinematic: "title",
  Documentary: "quote",
  Minimalist: "title",
  Typography: "title",
  Editorial: "title",
};

/** Topic-specific copy. The first matching topic supplies the vocabulary. */
const TOPIC_COPY: Record<
  string,
  { title: string; subtitle: string; beats: string[]; statements: string[] }
> = {
  network: {
    title: "Every Node, Connected",
    subtitle: "How information moves through a network",
    beats: [
      "The network begins as isolated points of light",
      "Links form between distant nodes",
      "One node becomes the focus",
      "Traffic flows across the topology",
    ],
    statements: [
      "Scale changes the problem, not the principle",
      "The structure decides what is possible",
    ],
  },
  processor: {
    title: "Inside the Machine",
    subtitle: "A processor, from silicon to signal",
    beats: [
      "A dark die sits at the centre of the frame",
      "Functional blocks resolve out of the darkness",
      "Signals race between the blocks",
      "The core wakes up",
    ],
    statements: [
      "Complexity is arranged, not accidental",
      "Every instruction becomes a physical event",
    ],
  },
  ai: {
    title: "Machines That Learn",
    subtitle: "How a model finds its own structure",
    beats: [
      "An empty field of nodes waits in the dark",
      "Weighted connections appear between them",
      "The network reorganises itself",
      "Structure resolves into meaning",
    ],
    statements: [
      "Learning is the slow discovery of structure",
      "The model finds what the data already contains",
    ],
  },
  data: {
    title: "Reading the Signal",
    subtitle: "What the numbers actually show",
    beats: [
      "The dataset arrives as a flat field",
      "The first trend separates from the noise",
      "The comparison becomes clear",
      "The conclusion holds",
    ],
    statements: [
      "The shape of the data tells the story",
      "Context turns a number into a decision",
    ],
  },
  product: {
    title: "Built for the Work",
    subtitle: "Everything you need, nothing you don't",
    beats: [
      "The product emerges from darkness",
      "Its core capability takes shape",
      "The evidence builds",
      "The case is made",
    ],
    statements: [
      "Designed around the way you actually work",
      "Less friction, more momentum",
    ],
  },
  code: {
    title: "How It Works",
    subtitle: "From source to execution",
    beats: [
      "The source appears line by line",
      "Control flow draws itself",
      "The runtime takes over",
      "The output lands",
    ],
    statements: [
      "Readable code is a design decision",
      "Every abstraction buys clarity at a price",
    ],
  },
  education: {
    title: "Understanding",
    subtitle: "One idea, explained clearly",
    beats: [
      "The question appears",
      "The pieces are laid out",
      "The parts come together",
      "The idea resolves",
    ],
    statements: [
      "Clarity comes from showing the steps",
      "Each part makes the whole legible",
    ],
  },
  architecture: {
    title: "The System",
    subtitle: "Components, boundaries and flow",
    beats: [
      "The components are introduced",
      "The boundaries between them become clear",
      "Data moves through the system",
      "The whole architecture is visible at once",
    ],
    statements: [
      "Good boundaries make change cheap",
      "The shape of the system shapes the work",
    ],
  },
  team: {
    title: "Together",
    subtitle: "How the work actually gets done",
    beats: [
      "The people appear",
      "Their work connects",
      "The effort compounds",
      "The result lands",
    ],
    statements: [
      "The team is the system",
      "Alignment is a design problem too",
    ],
  },
  space: {
    title: "Deep Space",
    subtitle: "Scale, distance and time",
    beats: [
      "Stars resolve out of the dark",
      "The field of view opens",
      "A structure emerges from the noise",
      "The scale becomes legible",
    ],
    statements: [
      "Perspective changes everything",
      "Distance is measured in light",
    ],
  },
  fluid: {
    title: "In Motion",
    subtitle: "Movement, pressure and flow",
    beats: [
      "Stillness",
      "The first movement",
      "The system finds its rhythm",
      "Flow",
    ],
    statements: [
      "Flow follows the path of least resistance",
      "Pressure reveals the structure",
    ],
  },
  city: {
    title: "The Built World",
    subtitle: "Structure at human scale",
    beats: [
      "The skyline resolves out of the haze",
      "Light moves across the facades",
      "The grid reveals itself",
      "The city wakes up",
    ],
    statements: [
      "Cities are systems you can walk through",
      "Every scale tells a different story",
    ],
  },
  music: {
    title: "The Rhythm",
    subtitle: "Sound given shape",
    beats: [
      "Silence",
      "The first pulse",
      "The pattern establishes",
      "The arrangement opens",
    ],
    statements: [
      "Rhythm is time made visible",
      "Every track is a landscape",
    ],
  },
  quote: {
    title: "In Their Words",
    subtitle: "What people remember",
    beats: [
      "The quote resolves",
      "The context appears",
      "The point lands",
    ],
    statements: [
      "The best answers are the briefest",
    ],
  },
  countdown: {
    title: "The Countdown",
    subtitle: "Everything leads here",
    beats: [
      "The clock appears",
      "The numbers fall away",
      "The moment arrives",
    ],
    statements: ["Everything arrives at once"],
  },
  particles: {
    title: "Field",
    subtitle: "Form out of motion",
    beats: [
      "Scattered points",
      "The field finds a pattern",
      "Structure emerges",
      "The field settles",
    ],
    statements: ["Order hides inside apparent chaos"],
  },
};

/** Generic copy used when no topic matched. */
const DEFAULT_COPY = {
  title: "Untitled",
  subtitle: "A visual study",
  beats: [
    "The idea establishes itself",
    "The structure becomes visible",
    "Details come into focus",
    "The whole is understood",
  ],
  statements: [
    "Start with the essential idea",
    "Build the detail around it",
    "End with what it all adds up to",
  ],
};

interface PlannerInput {
  analysis: PromptAnalysis;
  style: StyleDefinition;
  /** Target duration in seconds, resolved from the prompt or the request. */
  targetDurationSeconds: number;
}

/**
 * Build a complete video plan from prompt analysis.
 */
export function planVideo({
  analysis,
  style,
  targetDurationSeconds,
}: PlannerInput): VideoPlan {
  const topic = analysis.topics[0];
  const copy = TOPIC_COPY[topic] ?? DEFAULT_COPY;
  const arc = TOPIC_ARC[topic] ?? DEFAULT_ARC;

  // --- Scene count -----------------------------------------------------
  // Aim for 4–7 scenes. Longer videos get more scenes, but each scene stays
  // long enough to breathe.
  const idealSceneSeconds = style.pacing;
  let sceneCount = Math.round(targetDurationSeconds / idealSceneSeconds);
  sceneCount = Math.max(4, Math.min(7, sceneCount));

  // If the user wrote several sentences, respect that structure by allowing
  // one scene per sentence (capped).
  if (analysis.sentences.length >= 3 && analysis.sentences.length <= 7) {
    sceneCount = analysis.sentences.length;
  }

  // --- Title ------------------------------------------------------------
  const title = analysis.keyPhrases[0] ?? copy.title;
  const subtitle = analysis.keyPhrases[1] ?? copy.subtitle;

  // --- Scenes -----------------------------------------------------------
  const scenes: ScenePlan[] = [];
  const sentences = analysis.sentences;

  for (let index = 0; index < sceneCount; index += 1) {
    const isFirst = index === 0;
    const isLast = index === sceneCount - 1;

    let visual: Visual;
    if (isFirst) {
      visual = OPENING_TREATMENT[style.name] ?? arc[0];
    } else if (isLast) {
      visual = topic === "quote" ? "quote" : "statement";
    } else {
      visual = arc[Math.min(index, arc.length - 1)];
    }

    // Give each scene a share of the total runtime, weighted slightly
    // towards the middle where the idea is developed.
    const weights = Array.from({ length: sceneCount }, (_, position) => {
      if (position === 0 || position === sceneCount - 1) return 0.9;
      return 1.15;
    });
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    const durationSeconds = Math.max(
      1.5,
      (targetDurationSeconds * weights[index]) / totalWeight,
    );

    // --- Beats ----------------------------------------------------------
    // Prefer the user's own sentences as beats; fall back to the topic copy.
    const sentenceBeat = sentences[index];
    const fallbackBeat = copy.beats[(index - 1 + copy.beats.length) % copy.beats.length];

    const beats: ScenePlan["beats"] = [];
    if (sentenceBeat) {
      beats.push({
        intent: sentenceBeat,
        onScreenText: isFirst ? title : "",
        supportingText: isFirst ? subtitle : "",
        emphasis: isFirst ? "high" : index === sceneCount - 1 ? "high" : "medium",
        durationSeconds,
      });
    } else {
      beats.push({
        intent: fallbackBeat,
        onScreenText: isFirst ? title : "",
        supportingText: isFirst ? subtitle : "",
        emphasis: isFirst ? "high" : isLast ? "high" : "medium",
        durationSeconds,
      });
    }

    // The closing scene carries the payoff line.
    if (isLast && copy.statements.length > 0) {
      beats.push({
        intent: copy.statements[copy.statements.length - 1],
        onScreenText: copy.statements[copy.statements.length - 1],
        supportingText: "",
        emphasis: "high",
        durationSeconds: Math.max(1.5, durationSeconds * 0.45),
      });
    }

    // --- Background ------------------------------------------------------
    const background = planBackground(index, sceneCount, visual, style);

    // --- Camera ----------------------------------------------------------
    let camera: ScenePlan["camera"] = "static";
    if (isFirst) camera = "zoomIn";
    else if (isLast) camera = "zoomOut";
    else if (visual === "network" || visual === "diagram") camera = "zoomIn";
    else if (visual === "particles" || visual === "abstractShapes") camera = "drift";
    else camera = index % 2 === 0 ? "panRight" : "zoomIn";

    // --- Transition ------------------------------------------------------
    let transition: ScenePlan["transition"] = "fade";
    if (analysis.requestedTransitions[0]) {
      transition = analysis.requestedTransitions[0] as ScenePlan["transition"];
    } else if (visual === "network" || visual === "diagram") {
      transition = "wipeLeft";
    } else if (visual === "particles" || visual === "abstractShapes") {
      transition = "zoomBlur";
    } else if (style.name === "Editorial" || style.name === "Geometric") {
      transition = "slideLeft";
    }

    scenes.push({
      name: sceneName(index, sceneCount, visual, copy.title),
      summary: sentenceBeat ?? fallbackBeat,
      durationSeconds,
      background,
      visual,
      data: planData(visual, topic, analysis),
      beats,
      transition,
      camera,
    });
  }

  // --- Sound direction ---------------------------------------------------
  const soundEffects: string[] = [];
  scenes.forEach((scene, index) => {
    if (scene.visual === "network" || scene.visual === "chart") {
      soundEffects.push(`Scene ${index + 1}: soft digital pulse as nodes connect`);
    } else if (scene.visual === "title") {
      soundEffects.push(`Scene ${index + 1}: low atmospheric swell on reveal`);
    } else if (scene.visual === "statement" || scene.visual === "quote") {
      soundEffects.push(`Scene ${index + 1}: single sustained tone, no movement`);
    } else {
      soundEffects.push(`Scene ${index + 1}: subtle texture shift`);
    }
  });

  return {
    prompt: analysis.prompt,
    title,
    subtitle,
    styleName: style.name,
    styleDescription: style.description,
    mood: style.mood,
    palette: style.palette,
    grain: style.grain,
    vignette: style.vignette,
    glow: style.glow,
    scenes,
    musicDirection: `Music bed matched to "${style.name}" pacing — ${style.mood.join(", ")}.`,
    soundEffects,
  };
}

/** Background treatment per scene position and visual archetype. */
function planBackground(
  index: number,
  total: number,
  visual: Visual,
  style: StyleDefinition,
): ScenePlan["background"] {
  if (index === 0) {
    return style.name === "Minimalist" || style.name === "Corporate" ||
      style.name === "Editorial" || style.name === "Playful"
      ? "solid"
      : "linearGradient";
  }
  if (index === total - 1) {
    return "radialGradient";
  }
  switch (visual) {
    case "network":
    case "chart":
    case "code":
      return "grid";
    case "particles":
    case "abstractShapes":
      return "mesh";
    case "diagram":
    case "process":
      return "dots";
    default:
      return "linearGradient";
  }
}

/** A readable scene name. */
function sceneName(
  index: number,
  total: number,
  visual: Visual,
  fallbackTitle: string,
): string {
  if (index === 0) return "Opening";
  if (index === total - 1) return "Resolution";
  const names: Record<Visual, string> = {
    title: "Title",
    statement: "Statement",
    network: "Network",
    diagram: "Diagram",
    chart: "Data",
    particles: "Field",
    abstractShapes: "Form",
    code: "Code",
    process: "Process",
    quote: "Quote",
    countdown: "Countdown",
    comparison: "Comparison",
  };
  return names[visual] ?? `Scene ${index + 1}`;
}

/** Concrete data for data-driven visuals. */
function planData(
  visual: Visual,
  topic: string | undefined,
  analysis: PromptAnalysis,
): ScenePlan["data"] {
  if (visual === "chart") {
    return {
      series: [
        { label: "Signal", value: 42 },
        { label: "Noise", value: 18 },
        { label: "Growth", value: 67 },
        { label: "Retention", value: 54 },
      ],
      nodes: [],
      lines: [],
    };
  }

  if (visual === "diagram" || visual === "process") {
    return {
      series: [],
      nodes: diagramNodes(topic, analysis),
      lines: [],
    };
  }

  if (visual === "code") {
    return {
      series: [],
      nodes: [],
      lines: [
        "const result = await pipeline.run({",
        "  input: stream.buffer,",
        "  transform: normalize,",
        "  validate: schema.check,",
        "});",
        "",
        "if (result.ok) emit(result.value);",
      ],
    };
  }

  return { series: [], nodes: [], lines: [] };
}

/** Node labels appropriate to the detected topic. */
function diagramNodes(
  topic: string | undefined,
  analysis: PromptAnalysis,
): Array<{ label: string; sublabel: string }> {
  const known: Record<string, Array<{ label: string; sublabel: string }>> = {
    network: [
      { label: "Source", sublabel: "input" },
      { label: "Router", sublabel: "layer 1" },
      { label: "Fabric", sublabel: "core" },
      { label: "Consumer", sublabel: "output" },
    ],
    processor: [
      { label: "Fetch", sublabel: "instruction" },
      { label: "Decode", sublabel: "dispatch" },
      { label: "Execute", sublabel: "alu" },
      { label: "Writeback", sublabel: "commit" },
    ],
    ai: [
      { label: "Data", sublabel: "input" },
      { label: "Encode", sublabel: "embed" },
      { label: "Attend", sublabel: "weights" },
      { label: "Decode", sublabel: "output" },
    ],
    education: [
      { label: "Question", sublabel: "why" },
      { label: "Model", sublabel: "how" },
      { label: "Evidence", sublabel: "proof" },
      { label: "Answer", sublabel: "so what" },
    ],
    architecture: [
      { label: "Client", sublabel: "edge" },
      { label: "Gateway", sublabel: "route" },
      { label: "Service", sublabel: "domain" },
      { label: "Store", sublabel: "persist" },
    ],
  };

  if (topic && known[topic]) return known[topic];

  if (analysis.keyPhrases.length >= 2) {
    return [
      { label: analysis.keyPhrases[0], sublabel: "start" },
      { label: analysis.keyPhrases[1], sublabel: "middle" },
      { label: "Outcome", sublabel: "end" },
    ];
  }

  return [
    { label: "Input", sublabel: "source" },
    { label: "Process", sublabel: "transform" },
    { label: "Output", sublabel: "result" },
  ];
}
