import { NextRequest } from "next/server";
import { z } from "zod";
import {
  createJob,
  getJob,
  getProject,
  listJobs,
  updateProgress,
  completeJob,
  failJob,
} from "@motionforge/database";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { existsSync } from "node:fs";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  fps: z.number().int().optional(),
  quality: z.enum(["draft", "standard", "high"]).default("standard"),
});

let bundleCache: string | null = null;
async function getBundle() {
  if (bundleCache && existsSync(bundleCache)) return bundleCache;
  // Bundle from the renderer app's entry.
  const entry = path.resolve(
    process.cwd(),
    "../../apps/renderer/src/index.ts",
  );
  const fallback = path.resolve(process.cwd(), "../renderer/src/index.ts");
  const entryPoint = existsSync(entry) ? entry : fallback;
  bundleCache = await bundle({ entryPoint });
  return bundleCache;
}

async function runRender(jobId: string, project: any, settings: any) {
  try {
    const serveUrl = await getBundle();
    const inputProps = { project };
    const composition = await selectComposition({
      serveUrl,
      id: "MotionForge",
      inputProps,
    });
    const outDir = path.resolve(process.env.RENDER_OUTPUT_DIR ?? "./storage/renders");
    await mkdir(outDir, { recursive: true });
    const outputLocation = path.join(outDir, `${jobId}.mp4`);
    const crf = settings.quality === "draft" ? 28 : settings.quality === "high" ? 16 : 23;
    await renderMedia({
      serveUrl,
      composition: {
        ...composition,
        width: settings.width ?? composition.width,
        height: settings.height ?? composition.height,
        fps: settings.fps ?? composition.fps,
      },
      codec: "h264",
      outputLocation,
      inputProps,
      crf,
      onProgress: ({ progress }) => {
        void updateProgress(jobId, progress).catch(() => {});
      },
    });
    await completeJob(jobId, `${jobId}.mp4`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[render]", msg);
    await failJob(jobId, msg).catch(() => {});
  }
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await getProject(id, user.id);
    if (!project) return jsonError("Project not found.", 404, "NOT_FOUND");
    const jobs = await listJobs(id, 20);
    return jsonOk({ jobs });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await getProject(id, user.id);
    if (!project) return jsonError("Project not found.", 404, "NOT_FOUND");
    const parsed = await readJson(request, schema);
    if (!parsed.ok) return parsed.response;
    const settings = {
      width: parsed.data.width ?? project.width,
      height: parsed.data.height ?? project.height,
      fps: parsed.data.fps ?? project.fps,
      codec: "h264",
      quality: parsed.data.quality,
      format: "mp4",
    };
    const job = await createJob({ projectId: id, settings });
    // Fire-and-forget in-process render for MVP/dev. In production the
    // separate worker process picks up queued jobs.
    void runRender(job.id, project, settings);
    return jsonOk({ job }, 202);
  } catch (error) {
    return handleApiError(error);
  }
}
