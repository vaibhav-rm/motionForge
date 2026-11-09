import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Project } from "@motionforge/video-schema";

/**
 * Render service.
 *
 * Wraps Remotion's server-side renderer. The bundle is built once and
 * reused across jobs, which is the expensive part of a render; each job
 * then only pays for the actual frame encoding.
 */

const here = dirname(fileURLToPath(import.meta.url));

/** The Remotion entry file that registers the composition. */
export const REMOTION_ENTRY = resolve(here, "index.ts");

/** Where rendered output is written. */
export function renderOutputDir(): string {
  return resolve(process.env.RENDER_OUTPUT_DIR ?? "./storage/renders");
}

/** A cached bundle, reused between jobs. */
let cachedBundle: { path: string; createdAt: number } | null = null;

/**
 * Build (or reuse) the Remotion bundle.
 *
 * Bundling takes several seconds, so the result is cached for the lifetime
 * of the worker process.
 */
export async function getBundle(): Promise<string> {
  const cacheKey = process.env.REMOTION_BUNDLE_CACHE_KEY ?? "default";

  if (cachedBundle && existsSync(cachedBundle.path)) {
    return cachedBundle.path;
  }

  console.log("[render] bundling Remotion project...");
  const started = Date.now();

  const output = await bundle({
    entryPoint: REMOTION_ENTRY,
    onProgress: (progress) => {
      if (progress % 25 === 0) {
        console.log(`[render] bundle ${Math.round(progress)}%`);
      }
    },
  });

  cachedBundle = { path: output, createdAt: Date.now() };
  console.log(
    `[render] bundle ready in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  void cacheKey;
  return output;
}

/** Clear the cached bundle. */
export function clearBundleCache(): void {
  cachedBundle = null;
}

export interface RenderJobInput {
  project: Project;
  /** Output filename without extension. */
  outputName: string;
  width?: number;
  height?: number;
  fps?: number;
  quality?: "draft" | "standard" | "high";
  onProgress?: (progress: number) => void | Promise<void>;
}

/** Codec / quality mapping. */
function qualitySettings(quality: "draft" | "standard" | "high") {
  switch (quality) {
    case "draft":
      return { crf: 28, scale: 0.5 };
    case "high":
      return { crf: 16, scale: 1 };
    case "standard":
    default:
      return { crf: 23, scale: 1 };
  }
}

/**
 * Render a project to an MP4 file.
 *
 * Returns the absolute path of the rendered file.
 */
export async function renderProject(input: RenderJobInput): Promise<string> {
  const serveUrl = await getBundle();
  const outputDir = renderOutputDir();
  await mkdir(outputDir, { recursive: true });

  const outputLocation = join(outputDir, `${input.outputName}.mp4`);
  const settings = qualitySettings(input.quality ?? "standard");

  const inputProps = {
    project: input.project,
  };

  const composition = await selectComposition({
    serveUrl,
    id: "MotionForge",
    inputProps,
  });

  console.log(
    `[render] rendering ${composition.width}x${composition.height} @ ${composition.fps}fps, ${composition.durationInFrames} frames`,
  );

  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    outputLocation,
    inputProps,
    imageFormat: "jpeg",
    jpegQuality: 90,
    crf: settings.crf,
    scale: settings.scale,
    // Overrides the composition's own dimensions when an explicit export
    // resolution was requested.
    ...(input.width && input.height
      ? { composition: { ...composition, width: input.width, height: input.height } }
      : {}),
    onProgress: ({ progress }) => {
      const value = Math.max(0, Math.min(1, progress));
      void input.onProgress?.(value);
    },
    onBrowserLog: (log) => {
      if (log.type === "error") {
        console.error(`[render][browser] ${log.text}`);
      }
    },
  });

  console.log(`[render] complete → ${outputLocation}`);
  return outputLocation;
}
