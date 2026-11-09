import { prisma } from "./client.js";

/**
 * Render job repository.
 *
 * The queue is database-backed so jobs survive a web-server restart and can
 * be picked up by a separate worker process.
 */

export type RenderStatus =
  | "queued"
  | "rendering"
  | "completed"
  | "failed"
  | "cancelled";

export interface RenderSettings {
  width: number;
  height: number;
  fps: number;
  codec: string;
  quality: "draft" | "standard" | "high";
  format: string;
}

/** Create a queued render job. */
export async function createJob(input: {
  projectId: string;
  settings: RenderSettings;
}): Promise<{ id: string; status: RenderStatus }> {
  const job = await prisma.renderJob.create({
    data: {
      projectId: input.projectId,
      status: "queued",
      progress: 0,
      settings: JSON.stringify(input.settings),
    },
    select: { id: true, status: true },
  });
  return { id: job.id, status: job.status as RenderStatus };
}

/**
 * Claim the next queued job.
 *
 * Uses a conditional update so two workers cannot claim the same job.
 */
export async function claimNextJob(): Promise<{
  id: string;
  projectId: string;
  settings: RenderSettings;
} | null> {
  const candidate = await prisma.renderJob.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;

  const claimed = await prisma.renderJob.updateMany({
    where: { id: candidate.id, status: "queued" },
    data: { status: "rendering", startedAt: new Date(), progress: 0 },
  });

  if (claimed.count === 0) return null;

  let settings: RenderSettings;
  try {
    settings = JSON.parse(candidate.settings) as RenderSettings;
  } catch {
    settings = {
      width: 1920,
      height: 1080,
      fps: 30,
      codec: "h264",
      quality: "standard",
      format: "mp4",
    };
  }

  return { id: candidate.id, projectId: candidate.projectId, settings };
}

/** Update a job's progress. */
export async function updateProgress(
  jobId: string,
  progress: number,
): Promise<void> {
  await prisma.renderJob.updateMany({
    where: { id: jobId, status: "rendering" },
    data: { progress: Math.max(0, Math.min(1, progress)) },
  });
}

/** Mark a job as completed with its output path. */
export async function completeJob(
  jobId: string,
  outputPath: string,
): Promise<void> {
  await prisma.renderJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      progress: 1,
      outputPath,
      completedAt: new Date(),
      error: null,
    },
  });
}

/** Mark a job as failed. */
export async function failJob(jobId: string, error: string): Promise<void> {
  await prisma.renderJob.update({
    where: { id: jobId },
    data: {
      status: "failed",
      error: error.slice(0, 4000),
      completedAt: new Date(),
    },
  });
}

/** Cancel a job. */
export async function cancelJob(jobId: string): Promise<void> {
  await prisma.renderJob.updateMany({
    where: { id: jobId, status: { in: ["queued", "rendering"] } },
    data: { status: "cancelled", completedAt: new Date() },
  });
}

/** Fetch a job's status. */
export async function getJob(jobId: string) {
  const row = await prisma.renderJob.findUnique({ where: { id: jobId } });
  if (!row) return null;

  let settings: RenderSettings | null = null;
  try {
    settings = JSON.parse(row.settings) as RenderSettings;
  } catch {
    settings = null;
  }

  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status as RenderStatus,
    progress: row.progress,
    outputPath: row.outputPath,
    error: row.error,
    settings,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

/** List a project's render jobs, newest first. */
export async function listJobs(projectId: string, limit = 20) {
  const rows = await prisma.renderJob.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status as RenderStatus,
    progress: row.progress,
    outputPath: row.outputPath,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  }));
}

/**
 * Requeue failed or cancelled jobs.
 * Used by the "retry" action in the export panel.
 */
export async function requeueJob(jobId: string): Promise<void> {
  await prisma.renderJob.updateMany({
    where: { id: jobId, status: { in: ["failed", "cancelled"] } },
    data: { status: "queued", progress: 0, error: null, startedAt: null },
  });
}

/** Reset jobs that were left "rendering" by a crashed worker. */
export async function reclaimStaleJobs(
  olderThanMinutes = 30,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const result = await prisma.renderJob.updateMany({
    where: { status: "rendering", startedAt: { lt: cutoff } },
    data: { status: "queued", progress: 0 },
  });
  return result.count;
}
