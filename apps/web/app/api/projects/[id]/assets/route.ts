import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createStorage, kindForMimeType, storeAsset, MAX_UPLOAD_BYTES } from "@motionforge/asset-manager";
import { getProject, listAssets, prisma } from "@motionforge/database";
import { requireUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { saveProject } from "@/lib/projects";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const project = await getProject(id, user.id);
    if (!project) return jsonError("Project not found.", 404, "NOT_FOUND");
    const assets = await listAssets(id);
    return jsonOk({ assets });
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

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("A file upload is required.", 400, "MISSING_FILE");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return jsonError("File too large.", 413, "TOO_LARGE");
    }
    const kind = kindForMimeType(file.type);
    if (!kind) {
      return jsonError(`Unsupported file type: ${file.type}`, 415, "UNSUPPORTED_TYPE");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const assetId = `asset_${randomUUID().slice(0, 12)}`;
    const storage = createStorage();
    const record = await storeAsset(
      storage,
      {
        projectId: id,
        filename: file.name || `upload-${assetId}`,
        mimeType: file.type,
        size: buffer.byteLength,
        data: buffer,
        kind,
      },
      assetId,
    );

    await prisma.asset.create({
      data: {
        id: record.id,
        projectId: id,
        name: record.name,
        type: record.kind,
        storagePath: record.storagePath,
        url: record.url,
        mimeType: record.mimeType,
        size: record.size,
      },
    });

    // Embed asset reference in the project document.
    const updated = {
      ...project,
      assets: [
        ...(project.assets ?? []),
        {
          id: record.id,
          name: record.name,
          type: record.kind,
          mimeType: record.mimeType,
          url: record.url,
          width: null,
          height: null,
          durationInFrames: null,
          size: record.size,
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    await saveProject(user.id, updated);

    return jsonOk({ asset: record, project: updated }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
