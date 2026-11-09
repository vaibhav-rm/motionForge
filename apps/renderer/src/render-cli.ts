import { disconnect } from "@motionforge/database";
import { generateProject } from "@motionforge/ai-engine";
import { renderProject } from "./render-service";

/**
 * Render CLI.
 *
 * Renders a project directly, without the queue. Useful for verifying the
 * rendering pipeline and for batch exports.
 *
 * Usage:
 *   npm run render -- --prompt "a 10-second video about networks"
 *   npm run render -- --project-id prj_123 --output my-video
 */

interface CliOptions {
  prompt?: string;
  projectId?: string;
  output?: string;
  quality: "draft" | "standard" | "high";
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { quality: "standard" };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    switch (arg) {
      case "--prompt":
        options.prompt = next;
        index += 1;
        break;
      case "--project-id":
        options.projectId = next;
        index += 1;
        break;
      case "--output":
        options.output = next;
        index += 1;
        break;
      case "--quality":
        options.quality = (next as CliOptions["quality"]) ?? "standard";
        index += 1;
        break;
      default:
        break;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!options.prompt && !options.projectId) {
    console.error(
      "Usage: npm run render -- --prompt \"...\" | --project-id <id> [--output name] [--quality draft|standard|high]",
    );
    process.exit(1);
  }

  let project;
  if (options.projectId) {
    const { getProjectInternal } = await import("@motionforge/database");
    const found = await getProjectInternal(options.projectId);
    if (!found) {
      console.error(`Project ${options.projectId} not found.`);
      process.exit(1);
    }
    project = found;
  } else {
    const generated = await generateProject({ prompt: options.prompt! });
    project = generated.project;
    console.log(
      `[render] generated ${project.scenes.length} scenes · ${project.style.name}`,
    );
  }

  const outputName =
    options.output ??
    options.projectId ??
    `render-${Date.now().toString(36)}`;

  const outputPath = await renderProject({
    project,
    outputName,
    quality: options.quality,
    onProgress: (progress) => {
      const percent = Math.round(progress * 100);
      if (percent % 10 === 0) {
        console.log(`[render] ${percent}%`);
      }
    },
  });

  console.log(`[render] output: ${outputPath}`);
  await disconnect();
}

main().catch(async (error) => {
  console.error("[render] failed:", error);
  await disconnect();
  process.exit(1);
});
