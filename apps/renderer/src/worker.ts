import { disconnect, claimNextJob, failJob, completeJob, updateProgress, getProjectInternal } from "@motionforge/database";
import { renderProject } from "./render-service";

/**
 * Render worker.
 *
 * A separate process that claims jobs from the database queue and renders
 * them. Running renders outside the web server keeps long jobs from
 * blocking user interactions and lets rendering scale independently.
 */

const POLL_INTERVAL_MS = 2000;
const MAX_CONCURRENT = Number.parseInt(process.env.RENDER_CONCURRENCY ?? "1", 10);

let running = true;
let activeJobs = 0;

/** Process a single job. */
async function processJob(job: {
  id: string;
  projectId: string;
  settings: {
    width: number;
    height: number;
    fps: number;
    codec: string;
    quality: "draft" | "standard" | "high";
  };
}): Promise<void> {
  try {
    const project = await getProjectInternal(job.projectId);
    if (!project) {
      throw new Error(`Project ${job.projectId} no longer exists.`);
    }

    await renderProject({
      project,
      outputName: job.id,
      width: job.settings.width,
      height: job.settings.height,
      fps: job.settings.fps,
      quality: job.settings.quality,
      onProgress: async (progress) => {
        await updateProgress(job.id, progress);
      },
    });

    const outputPath = `${job.id}.mp4`;
    await completeJob(job.id, outputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[worker] job ${job.id} failed: ${message}`);
    await failJob(job.id, message);
  }
}

/** Main loop. */
async function main(): Promise<void> {
  console.log("[worker] MotionForge render worker started");

  const shutdown = () => {
    running = false;
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (running) {
    try {
      while (activeJobs < MAX_CONCURRENT) {
        const job = await claimNextJob();
        if (!job) break;

        activeJobs += 1;
        void processJob(job).finally(() => {
          activeJobs -= 1;
        });
      }
    } catch (error) {
      console.error(
        "[worker] poll error:",
        error instanceof Error ? error.message : String(error),
      );
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  console.log("[worker] shutting down");
  await disconnect();
  process.exit(0);
}

main().catch(async (error) => {
  console.error("[worker] fatal:", error);
  await disconnect();
  process.exit(1);
});
