import {
  EditPlanSchema,
  EditRequestSchema,
  GenerationRequestSchema,
  ProjectSchema,
  VideoPlanSchema,
  type EditPlanInput,
  type EditRequest,
  type GenerationRequest,
  type GenerationResult,
  type Project,
  type VideoPlan,
} from "@motionforge/video-schema";
import { analysePrompt } from "../prompts/analyse.js";
import { resolveStyle } from "../prompts/styles.js";
import { planVideo } from "../prompts/planner.js";
import { compilePlan } from "./compiler.js";
import { applyEditPlan } from "./editing.js";
import { getProvider, type AIEngineConfig } from "../providers/registry.js";
import { buildPlanPrompt, buildEditPrompt } from "../prompts/system.js";
import { parseJsonResponse } from "./json.js";

/**
 * Generation orchestration.
 *
 * This is the only module that knows how to go from "user said something" to
 * "a validated project". The provider is swappable; the pipeline is not.
 */

/** Default runtime when the prompt does not state one. */
const DEFAULT_DURATION_SECONDS = 30;

/**
 * Runtime options supplied by the caller.
 *
 * The provider configuration is passed in rather than read from the
 * environment so the application can let the user configure credentials at
 * runtime. When omitted the environment is used, preserving the previous
 * behaviour.
 */
export interface GenerationOptions {
  provider?: AIEngineConfig;
  temperature?: number;
}

/**
 * Resolve the target duration for a request.
 * An explicit request value wins; otherwise the prompt is mined for one.
 */
export function resolveTargetDuration(
  request: GenerationRequest,
): number {
  if (request.targetDurationSeconds) return request.targetDurationSeconds;
  const analysis = analysePrompt(request.prompt);
  if (analysis.durationSeconds) return analysis.durationSeconds;
  return DEFAULT_DURATION_SECONDS;
}

/**
 * Generate a complete video project from a natural-language prompt.
 */
export async function generateProject(
  rawRequest: unknown,
  options: GenerationOptions = {},
): Promise<GenerationResult> {
  const request = GenerationRequestSchema.parse(rawRequest);
  const provider = getProvider(options.provider);

  const analysis = analysePrompt(request.prompt);
  const targetDuration = resolveTargetDuration(request);
  const style = resolveStyle({
    styles: analysis.styles,
    paletteHints: analysis.paletteHints,
    moods: analysis.moods,
  });

  let plan: VideoPlan;
  let usedProvider = provider.id;

  if (provider.id === "local") {
    // The offline creative director plans directly — no network required.
    plan = planVideo({ analysis, style, targetDurationSeconds: targetDuration });
  } else {
    // A model proposes the plan; the schema validates it and the compiler
    // turns it into a project.
    const response = await provider.complete({
      messages: [
        { role: "system", content: buildPlanPrompt() },
        {
          role: "user",
          content: JSON.stringify({
            prompt: request.prompt,
            targetDurationSeconds: targetDuration,
            aspectRatio: analysis.aspectRatio,
            styles: analysis.styles,
            topics: analysis.topics,
            mood: analysis.moods,
            paletteHints: analysis.paletteHints,
            availableAssets: request.availableAssets,
          }),
        },
      ],
      model: "",
      temperature: options.temperature ?? 0.7,
      maxTokens: 8000,
      jsonMode: true,
    });

    const parsed = parseJsonResponse(response.text);
    const validation = VideoPlanSchema.safeParse(parsed);
    if (!validation.success) {
      throw new Error(
        `The AI returned a plan that failed validation: ${validation.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    plan = validation.data;
  }

  const project = compilePlan({
    plan,
    fps: request.targetFps ?? analysis.fps ?? 30,
    aspectRatio: analysis.aspectRatio,
    width: request.targetWidth ?? undefined,
    height: request.targetHeight ?? undefined,
  });

  return {
    project,
    summary: `Generated ${project.scenes.length} scenes totalling ${Math.round(
      project.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0) /
        project.fps,
    )}s in the "${plan.styleName}" style.`,
    changes: project.scenes.map(
      (scene) => `Scene "${scene.name}" · ${Math.round(scene.durationInFrames / project.fps * 10) / 10}s · ${scene.elements.length} layers`,
    ),
    provider: usedProvider,
  };
}

/**
 * Apply a conversational edit to an existing project.
 *
 * The edit plan is a list of *operations*. Operations are applied by
 * deterministic code, so an edit scoped to one scene provably cannot touch
 * another scene.
 */
export async function editProject(
  rawRequest: unknown,
  options: GenerationOptions = {},
): Promise<GenerationResult> {
  const request = EditRequestSchema.parse(rawRequest);
  const provider = getProvider(options.provider);

  let editPlan: EditPlanInput;

  if (provider.id === "local") {
    editPlan = buildLocalEditPlan(request);
  } else {
    const response = await provider.complete({
      messages: [
        { role: "system", content: buildEditPrompt() },
        {
          role: "user",
          content: JSON.stringify({
            instruction: request.instruction,
            focusedSceneId: request.focusedSceneId,
            selectedElementIds: request.selectedElementIds,
            project: summariseProject(request.project),
          }),
        },
      ],
      model: "",
      temperature: Math.min(options.temperature ?? 0.4, 0.8),
      maxTokens: 4000,
      jsonMode: true,
    });

    const parsed = parseJsonResponse(response.text);
    const validation = EditPlanSchema.safeParse(parsed);
    if (!validation.success) {
      throw new Error(
        `The AI returned an invalid edit plan: ${validation.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    editPlan = validation.data;
  }

  const { project, changes } = applyEditPlan(request.project, editPlan);

  return {
    project: ProjectSchema.parse(project),
    summary: editPlan.summary || "Applied the requested changes.",
    changes,
    provider: provider.id,
  };
}

/**
 * A compact view of the project for prompting.
 * Full element details are omitted to keep the prompt small.
 */
export function summariseProject(project: Project) {
  return {
    name: project.name,
    fps: project.fps,
    width: project.width,
    height: project.height,
    style: {
      name: project.style.name,
      palette: project.style.palette,
      typography: project.style.typography,
      grain: project.style.grain,
      vignette: project.style.vignette,
      glow: project.style.glow,
    },
    scenes: project.scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      order: scene.order,
      durationInFrames: scene.durationInFrames,
      background: scene.background.type,
      camera: scene.camera,
      transition: scene.transition.type,
      notes: scene.notes,
      elements: scene.elements.map((element) => ({
        id: element.id,
        name: element.name,
        type: element.type,
        text: element.type === "text" ? element.text : undefined,
      })),
    })),
  };
}

/**
 * Build an edit plan without a model.
 *
 * The offline editor understands the most common creative instructions and
 * maps them onto precise operations. Unrecognised instructions fall back to
 * a safe, additive response rather than mutating content blindly.
 */
export function buildLocalEditPlan(request: EditRequest): EditPlanInput {
  const instruction = request.instruction.toLowerCase().trim();
  const operations: EditPlanInput["operations"] = [];
  const summaryParts: string[] = [];

  const focusedScene =
    request.focusedSceneId ??
    request.project.scenes.find((scene) =>
      scene.elements.some((element) =>
        request.selectedElementIds.includes(element.id),
      ),
    )?.id ??
    request.project.scenes[0]?.id ??
    null;

  // --- Monochrome / style-wide changes ---------------------------------
  if (
    /\b(monochrome|black and white|greyscale|grayscale|noir)\b/.test(instruction)
  ) {
    operations.push({
      op: "updateStyle",
      style: {
        name: "Monochrome",
        palette: {
          background: "#0a0a0a",
          surface: "#161616",
          primary: "#ffffff",
          secondary: "#a3a3a3",
          text: "#ffffff",
          muted: "#737373",
        },
        glow: 0.12,
      },
      note: "Converted the project to a monochrome palette.",
    });
    summaryParts.push("Switched the whole project to monochrome");
  }

  // --- Palette change ---------------------------------------------------
  const paletteMatch = instruction.match(
    /\b(?:palette|colou?rs?|make it|change the colour|change the color)\b.*?\b(red|blue|green|purple|orange|yellow|pink|cyan|teal)\b/,
  );
  if (paletteMatch) {
    const hueMap: Record<string, string> = {
      red: "#ef4444",
      blue: "#3b82f6",
      green: "#22c55e",
      purple: "#a855f7",
      orange: "#f97316",
      yellow: "#eab308",
      pink: "#ec4899",
      cyan: "#22d3ee",
      teal: "#14b8a6",
    };
    const hue = hueMap[paletteMatch[1]];
    if (hue) {
      operations.push({
        op: "updateStyle",
        style: { palette: { primary: hue, secondary: hue } },
        note: `Shifted the accent colour to ${paletteMatch[1]}.`,
      });
      summaryParts.push(`Changed the accent colour to ${paletteMatch[1]}`);
    }
  }

  // --- Background change -------------------------------------------------
  const backgroundMatch = instruction.match(
    /\bbackground\b.*?\b(gradient|solid|grid|dots|noise|mesh)\b/,
  );
  if (backgroundMatch && focusedScene) {
    operations.push({
      op: "updateScene",
      sceneId: focusedScene,
      scene: {
        background: {
          type: backgroundMatch[1],
          ...(backgroundMatch[1] === "solid" ? { color: "#07090f" } : {}),
        },
      },
      note: `Changed the background to a ${backgroundMatch[1]}.`,
    });
    summaryParts.push("Updated the background");
  }

  // --- More dramatic ------------------------------------------------------
  if (/\b(more dramatic|dramatic|more intense|intensify|punchier)\b/.test(instruction)) {
    if (focusedScene) {
      operations.push({
        op: "updateScene",
        sceneId: focusedScene,
        scene: {
          camera: {
            zoomFrom: 1.18,
            zoomTo: 1.02,
            easing: "easeInOut",
          },
        },
        note: "Increased camera movement for a more dramatic feel.",
      });
      summaryParts.push("Pushed the camera and pacing harder");
    }
  }

  // --- Subtler / calmer ---------------------------------------------------
  if (/\b(calmer|subtler|softer|less busy|minimal(ist)?)\b/.test(instruction)) {
    operations.push({
      op: "updateStyle",
      style: { grain: 0.02, vignette: 0.12, glow: 0.15 },
      note: "Reduced grain, vignette and glow for a quieter look.",
    });
    if (focusedScene) {
      operations.push({
        op: "updateScene",
        sceneId: focusedScene,
        scene: { camera: { zoomFrom: 1.01, zoomTo: 1.01 } },
        note: "Stilled the camera move.",
      });
    }
    summaryParts.push("Softened the visual treatment");
  }

  // --- Particles ----------------------------------------------------------
  if (/\b(add|include).{0,12}\bparticles?\b/.test(instruction)) {
    if (focusedScene) {
      operations.push({
        op: "addElement",
        sceneId: focusedScene,
        element: {
          type: "particles",
          name: "Particles",
          x: 50,
          y: 50,
          width: 1920,
          height: 1080,
          count: 110,
          color: "#5eead4",
          size: 2.4,
          speed: 0.8,
          motion: "drift",
          particleOpacity: 0.55,
          connect: false,
          connectDistance: 150,
          zIndex: -5,
          animation: {
            entrance: {
              type: "fade",
              durationInFrames: 24,
              delayInFrames: 0,
              staggerInFrames: 0,
              easing: "easeOut",
              distance: 0,
            },
            exit: {
              type: "fade",
              durationInFrames: 12,
              delayInFrames: 0,
              easing: "easeIn",
              distance: 0,
            },
            loop: { type: "none", periodInFrames: 60, amplitude: 0 },
          },
        },
        note: "Added an animated particle field.",
      });
      summaryParts.push("Added particles");
    }
  }

  // --- Typography ---------------------------------------------------------
  if (/\b(typography|type|text).{0,20}\b(minimal|simpler|smaller|larger|bigger|bolder)\b/.test(instruction)) {
    const stylePatch: Record<string, unknown> = {};
    if (/minimal|simpler/.test(instruction)) {
      stylePatch.typography = {
        displayScale: 1.9,
        displayTracking: -0.01,
        uppercaseDisplay: false,
      };
    }
    if (/smaller/.test(instruction)) stylePatch.typography = { displayScale: 1.8 };
    if (/larger|bigger/.test(instruction)) stylePatch.typography = { displayScale: 3.4 };
    if (/bolder/.test(instruction)) {
      stylePatch.typography = { displayScale: 2.9, uppercaseDisplay: true };
    }
    operations.push({
      op: "updateStyle",
      style: stylePatch,
      note: "Adjusted the typography.",
    });
    summaryParts.push("Adjusted typography");
  }

  // --- Slow down the transition -------------------------------------------
  const slowTransition = instruction.match(
    /\b(slow|slower|lengthen|longer)\b.{0,20}\btransition\b/,
  );
  if (slowTransition && focusedScene) {
    const scene = request.project.scenes.find((s) => s.id === focusedScene);
    const current = scene?.transition.durationInFrames ?? 18;
    operations.push({
      op: "updateScene",
      sceneId: focusedScene,
      scene: { transition: { durationInFrames: Math.min(90, current * 2) } },
      note: "Slowed the outgoing transition.",
    });
    summaryParts.push("Slowed the transition");
  }

  // --- Camera movement ----------------------------------------------------
  if (/\b(camera|pan|zoom|movement|drift)\b/.test(instruction)) {
    if (focusedScene) {
      operations.push({
        op: "updateScene",
        sceneId: focusedScene,
        scene: {
          camera: {
            zoomFrom: 1.08,
            zoomTo: 1.0,
            panXFrom: -30,
            panXTo: 30,
            easing: "easeInOut",
          },
        },
        note: "Added a subtle camera move.",
      });
      summaryParts.push("Added a subtle camera move");
    }
  }

  // --- Duration -----------------------------------------------------------
  const durationMatch = instruction.match(
    /\b(?:make|set|change)\b.{0,20}\b(?:this|the|scene)?\s*(?:scene)?\s*(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)\b/,
  );
  if (durationMatch && focusedScene) {
    const seconds = Number.parseFloat(durationMatch[1]);
    operations.push({
      op: "setDuration",
      sceneId: focusedScene,
      scene: { durationInFrames: Math.round(seconds * request.project.fps) },
      note: `Set the scene duration to ${seconds}s.`,
    });
    summaryParts.push(`Set the scene to ${seconds}s`);
  }

  // --- Text replacement ----------------------------------------------------
  const replaceMatch = instruction.match(
    /\b(?:change|replace|set)\b.{0,24}\b(?:text|title|headline|copy)\b.{0,12}\b(?:to|with)\b\s*["']?([^"'.]+)["']?/i,
  );
  if (replaceMatch && focusedScene) {
    const scene = request.project.scenes.find((s) => s.id === focusedScene);
    const textElement = scene?.elements.find((element) => element.type === "text");
    if (textElement) {
      operations.push({
        op: "updateElement",
        sceneId: focusedScene,
        elementId: textElement.id,
        element: { text: replaceMatch[1].trim() },
        note: `Updated the copy to "${replaceMatch[1].trim()}".`,
      });
      summaryParts.push("Updated the on-screen copy");
    }
  }

  // --- Fallback ------------------------------------------------------------
  if (operations.length === 0) {
    // Nothing recognised: describe what is possible rather than making a
    // blind mutation that could damage the project.
    return {
      summary:
        "I could not map that instruction to a specific edit. Try phrasing it as a style change (for example \"make it monochrome\"), a scene change (\"add particles\", \"slow down the transition\"), or a camera change (\"add a subtle camera movement\").",
      operations: [],
      reset: false,
    };
  }

  return {
    summary:
      summaryParts.length > 0
        ? `${summaryParts.join(", ")}.`
        : "Applied the requested changes.",
    operations,
    reset: false,
  };
}
