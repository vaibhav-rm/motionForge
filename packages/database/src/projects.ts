import type { Project, Scene, Element } from "@motionforge/video-schema";
import { ProjectSchema } from "@motionforge/video-schema";
import { prisma } from "./client.js";

/**
 * Project repository.
 *
 * The project document is stored as a JSON string in a single column. This
 * keeps the relational model clean (projects, assets, jobs, versions are
 * relational) while the creative document itself stays schemaless and
 * versioned by the schema package.
 */

/** Convert a database row into a validated project. */
export function rowToProject(row: {
  id: string;
  name: string;
  description: string;
  fps: number;
  width: number;
  height: number;
  configuration: string;
  createdAt: Date;
  updatedAt: Date;
}): Project {
  const parsed = ProjectSchema.safeParse(JSON.parse(row.configuration));
  if (!parsed.success) {
    throw new Error(
      `Project ${row.id} contains an invalid configuration: ${parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  // The stored document is authoritative for scene content; the columns
  // mirror it for querying and sorting.
  return {
    ...parsed.data,
    id: row.id,
    name: row.name,
    description: row.description,
    fps: row.fps,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Total project duration in frames. */
export function durationOf(project: Project): number {
  return project.scenes.reduce(
    (total, scene) => total + scene.durationInFrames,
    0,
  );
}

/** Create a new project. */
export async function createProject(input: {
  userId: string;
  name: string;
  description?: string;
  project: Project;
}): Promise<Project> {
  const project = input.project;

  const row = await prisma.project.create({
    data: {
      id: project.id,
      userId: input.userId,
      name: input.name || project.name,
      description: input.description ?? project.description,
      fps: project.fps,
      width: project.width,
      height: project.height,
      duration: durationOf(project),
      configuration: JSON.stringify(project),
      scenes: {
        create: project.scenes.map((scene: Scene) => ({
          id: scene.id,
          name: scene.name,
          order: scene.order,
          duration: scene.durationInFrames,
          configuration: JSON.stringify(scene),
        })),
      },
    },
  });

  return rowToProject(row);
}

/** Fetch a project by id, scoped to the owning user. */
export async function getProject(
  projectId: string,
  userId: string,
): Promise<Project | null> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  return row ? rowToProject(row) : null;
}

/** Fetch a project without a user scope (internal use only). */
export async function getProjectInternal(
  projectId: string,
): Promise<Project | null> {
  const row = await prisma.project.findUnique({ where: { id: projectId } });
  return row ? rowToProject(row) : null;
}

/** Update a project and its scenes. */
export async function updateProject(
  projectId: string,
  userId: string,
  project: Project,
): Promise<Project> {
  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!existing) {
    throw new Error("Project not found.");
  }

  const row = await prisma.$transaction(async (tx) => {
    // Replace the scene rows so ordering and durations always match the
    // document. Scene rows are a queryable projection, not the source of
    // truth.
    await tx.scene.deleteMany({ where: { projectId } });
    await tx.scene.createMany({
      data: project.scenes.map((scene) => ({
        id: scene.id,
        projectId,
        name: scene.name,
        order: scene.order,
        duration: scene.durationInFrames,
        configuration: JSON.stringify(scene),
      })),
    });

    return tx.project.update({
      where: { id: projectId },
      data: {
        name: project.name,
        description: project.description,
        fps: project.fps,
        width: project.width,
        height: project.height,
        duration: durationOf(project),
        configuration: JSON.stringify(project),
      },
    });
  });

  return rowToProject(row);
}

/** List a user's projects, most recently updated first. */
export async function listProjects(
  userId: string,
  options: { includeArchived?: boolean; limit?: number } = {},
): Promise<
  Array<{
    id: string;
    name: string;
    description: string;
    thumbnail: string | null;
    fps: number;
    width: number;
    height: number;
    duration: number;
    archived: boolean;
    createdAt: string;
    updatedAt: string;
    sceneCount: number;
  }>
> {
  const rows = await prisma.project.findMany({
    where: {
      userId,
      ...(options.includeArchived ? {} : { archived: false }),
    },
    orderBy: { updatedAt: "desc" },
    take: options.limit ?? 100,
    include: { _count: { select: { scenes: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    thumbnail: row.thumbnail,
    fps: row.fps,
    width: row.width,
    height: row.height,
    duration: row.duration,
    archived: row.archived,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    sceneCount: row._count.scenes,
  }));
}

/** Rename a project. */
export async function renameProject(
  projectId: string,
  userId: string,
  name: string,
): Promise<void> {
  await prisma.project.updateMany({
    where: { id: projectId, userId },
    data: { name },
  });
}

/** Set the archived flag. */
export async function setArchived(
  projectId: string,
  userId: string,
  archived: boolean,
): Promise<void> {
  await prisma.project.updateMany({
    where: { id: projectId, userId },
    data: { archived },
  });
}

/** Delete a project and everything attached to it. */
export async function deleteProject(
  projectId: string,
  userId: string,
): Promise<boolean> {
  const result = await prisma.project.deleteMany({
    where: { id: projectId, userId },
  });
  return result.count > 0;
}

/** Duplicate a project, including its scenes and assets. */
export async function duplicateProject(
  projectId: string,
  userId: string,
): Promise<Project | null> {
  const source = await getProject(projectId, userId);
  if (!source) return null;

  const copyId = `prj_${Math.random().toString(36).slice(2, 10)}`;
  const copy: Project = {
    ...structuredClone(source),
    id: copyId,
    name: `${source.name} copy`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scenes: source.scenes.map((scene) => ({
      ...scene,
      id: `sc_${Math.random().toString(36).slice(2, 10)}`,
      elements: scene.elements.map((element) => ({
        ...element,
        id: `el_${Math.random().toString(36).slice(2, 10)}`,
      })),
    })),
  };

  return createProject({
    userId,
    name: copy.name,
    description: copy.description,
    project: copy,
  });
}

/** Attach assets to a project. */
export async function saveAssets(
  projectId: string,
  assets: Array<{
    id: string;
    name: string;
    type: string;
    storagePath: string;
    url: string;
    mimeType: string;
    size: number;
    width?: number | null;
    height?: number | null;
    duration?: number | null;
  }>,
): Promise<void> {
  await prisma.$transaction([
    prisma.asset.deleteMany({ where: { projectId } }),
    prisma.asset.createMany({
      data: assets.map((asset) => ({
        id: asset.id,
        projectId,
        name: asset.name,
        type: asset.type,
        storagePath: asset.storagePath,
        url: asset.url,
        mimeType: asset.mimeType,
        size: asset.size,
        width: asset.width ?? null,
        height: asset.height ?? null,
        duration: asset.duration ?? null,
      })),
    }),
  ]);
}

/** List a project's assets. */
export async function listAssets(projectId: string) {
  return prisma.asset.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
}

/** Save a project version snapshot. */
export async function saveVersion(
  projectId: string,
  snapshot: Project,
  note = "",
): Promise<number> {
  const latest = await prisma.projectVersion.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });
  const version = (latest?.version ?? 0) + 1;

  await prisma.projectVersion.create({
    data: {
      projectId,
      version,
      snapshot: JSON.stringify(snapshot),
      note,
    },
  });

  return version;
}

/** List version metadata for a project (without the snapshots). */
export async function listVersions(projectId: string) {
  const rows = await prisma.projectVersion.findMany({
    where: { projectId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      note: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Load a specific version snapshot. */
export async function loadVersion(
  projectId: string,
  version: number,
): Promise<Project | null> {
  const row = await prisma.projectVersion.findUnique({
    where: { projectId_version: { projectId, version } },
  });
  if (!row) return null;
  const parsed = ProjectSchema.safeParse(JSON.parse(row.snapshot));
  return parsed.success ? parsed.data : null;
}

/** Append a message to the project's assistant conversation. */
export async function addMessage(
  projectId: string,
  role: "user" | "assistant" | "system",
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await prisma.projectMessage.create({
    data: {
      projectId,
      role,
      content,
      metadata: JSON.stringify(metadata),
    },
  });
}

/** Read the project's assistant conversation, oldest first. */
export async function listMessages(
  projectId: string,
  limit = 100,
): Promise<
  Array<{
    id: string;
    role: string;
    content: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>
> {
  const rows = await prisma.projectMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return rows.map((row) => {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(row.metadata) as Record<string, unknown>;
    } catch {
      metadata = {};
    }
    return {
      id: row.id,
      role: row.role,
      content: row.content,
      metadata,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

/** Clear a project's assistant conversation. */
export async function clearMessages(projectId: string): Promise<void> {
  await prisma.projectMessage.deleteMany({ where: { projectId } });
}

/** Count the elements in a project — used for the dashboard statistics. */
export function countElements(project: Project): number {
  return project.scenes.reduce(
    (total, scene) => total + scene.elements.length,
    0,
  );
}

/** All element ids in a project, for selection restoration. */
export function allElementIds(project: Project): string[] {
  return project.scenes.flatMap((scene: Scene) =>
    scene.elements.map((element: Element) => element.id),
  );
}
