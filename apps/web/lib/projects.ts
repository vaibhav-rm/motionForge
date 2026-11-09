import type { Project } from "@motionforge/video-schema";
import {
  createProject as dbCreateProject,
  deleteProject as dbDeleteProject,
  duplicateProject as dbDuplicateProject,
  getProject as dbGetProject,
  listProjects as dbListProjects,
  renameProject as dbRenameProject,
  setArchived,
  updateProject as dbUpdateProject,
  saveVersion,
} from "@motionforge/database";
import { createProject, createScene, type Scene } from "@motionforge/video-schema";

export { dbListProjects as listProjects };
export { dbGetProject as getProject };
export { dbDeleteProject as deleteProject };
export { dbDuplicateProject as duplicateProject };
export { dbRenameProject as renameProject };
export { setArchived };

export async function createBlankProject(
  userId: string,
  input: { name?: string; description?: string } = {},
): Promise<Project> {
  const opening: Scene = createScene({
    name: "Opening",
    order: 0,
    durationInFrames: 150,
    description: "A blank opening scene. Describe your idea to generate content.",
  });

  const project = createProject({
    name: input.name?.trim() || "Untitled Project",
    description: input.description?.trim() || "",
    fps: 30,
    width: 1920,
    height: 1080,
    scenes: [opening],
  });

  return dbCreateProject({
    userId,
    name: project.name,
    description: project.description,
    project,
  });
}

export async function saveProject(
  userId: string,
  project: Project,
  options: { snapshot?: boolean; note?: string } = {},
): Promise<Project> {
  const saved = await dbUpdateProject(project.id, userId, project);
  if (options.snapshot) {
    await saveVersion(saved.id, saved, options.note ?? "Manual snapshot").catch(
      () => {},
    );
  }
  return saved;
}
