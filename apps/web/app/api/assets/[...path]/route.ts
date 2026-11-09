import { NextRequest, NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * Serves locally stored assets. The renderer and Remotion Player fetch
 * media from these URLs during preview/render.
 */

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".aac": "audio/aac",
  ".m4a": "audio/mp4",
};

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { path: parts } = await ctx.params;
  const root = path.resolve(process.env.STORAGE_LOCAL_ROOT ?? "./storage");
  const rel = parts.map((p) => decodeURIComponent(p)).join("/");
  const full = path.resolve(root, rel);

  // Prevent path traversal.
  if (!full.startsWith(root + path.sep) && full !== root) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!existsSync(full)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stat = statSync(full);
  if (!stat.isFile()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = path.extname(full).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "bytes",
    },
  });
}
