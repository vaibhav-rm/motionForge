import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@motionforge/database";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import path from "node:path";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";

type Ctx = { params: Promise<{ jobId: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    await requireUser();
    const { jobId } = await ctx.params;
    const job = await getJob(jobId);
    if (!job) return jsonError("Job not found.", 404, "NOT_FOUND");

    const url = new URL(request.url);
    if (url.searchParams.get("download") === "1") {
      if (job.status !== "completed" || !job.outputPath) {
        return jsonError("Render not ready.", 409, "NOT_READY");
      }
      const outDir = path.resolve(process.env.RENDER_OUTPUT_DIR ?? "./storage/renders");
      const full = path.resolve(outDir, job.outputPath);
      if (!full.startsWith(outDir + path.sep) || !existsSync(full)) {
        return jsonError("Output file missing.", 404, "MISSING_OUTPUT");
      }
      const stat = statSync(full);
      const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
      return new NextResponse(stream, {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(stat.size),
          "Content-Disposition": `attachment; filename="${jobId}.mp4"`,
        },
      });
    }

    return jsonOk({ job });
  } catch (error) {
    return handleApiError(error);
  }
}
