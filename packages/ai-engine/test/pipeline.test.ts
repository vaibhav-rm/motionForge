import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateProject,
  editProject,
  analysePrompt,
  resolveStyle,
} from "../src/index.js";

/**
 * End-to-end tests for the AI generation pipeline.
 *
 * These run against the offline provider, so they exercise the real
 * generation path without any network access or API keys.
 */

test("prompt analysis extracts duration, style and topics", () => {
  const analysis = analysePrompt(
    "Create a 45-second cinematic visualization of a computer network. Start with a dark environment, gradually introduce glowing interconnected nodes, zoom into one node. Use a sophisticated dark blue and cyan visual style.",
  );

  assert.equal(analysis.durationSeconds, 45);
  assert.ok(analysis.styles.includes("Cinematic"));
  assert.ok(analysis.topics.includes("network"));
  assert.ok(analysis.paletteHints.includes("blue"));
  assert.ok(analysis.paletteHints.includes("cyan"));
});

test("style resolution applies explicit colour hints", () => {
  const style = resolveStyle({
    styles: ["Cinematic"],
    paletteHints: ["cyan"],
    moods: [],
  });

  assert.equal(style.name, "Cinematic");
  assert.equal(style.palette.primary, "#22d3ee");
});

test("generation produces a valid multi-scene project", async () => {
  const result = await generateProject({
    prompt:
      "Create a 30-second cinematic explanation of how a processor works, in a dark blue and cyan style.",
  });

  const project = result.project;

  assert.ok(project.scenes.length >= 4, "expected at least 4 scenes");
  assert.ok(project.scenes.length <= 7, "expected at most 7 scenes");
  assert.equal(project.fps, 30);
  assert.equal(project.width, 1920);
  assert.equal(project.height, 1080);

  // Total runtime should be close to the requested 30 seconds.
  const totalFrames = project.scenes.reduce(
    (sum, scene) => sum + scene.durationInFrames,
    0,
  );
  const totalSeconds = totalFrames / project.fps;
  assert.ok(
    Math.abs(totalSeconds - 30) < 3,
    `expected ~30s, got ${totalSeconds}s`,
  );

  // Every scene must contain real layers.
  for (const scene of project.scenes) {
    assert.ok(scene.elements.length > 0, `scene "${scene.name}" has no layers`);
    for (const element of scene.elements) {
      assert.ok(element.id, "element must have an id");
      assert.ok(Number.isFinite(element.x), "element x must be finite");
      assert.ok(Number.isFinite(element.y), "element y must be finite");
    }
  }

  // Scene order must be contiguous.
  project.scenes.forEach((scene, index) => {
    assert.equal(scene.order, index);
  });

  // The copy must be real, not placeholder text.
  const allText = project.scenes
    .flatMap((scene) => scene.elements)
    .filter((element) => element.type === "text")
    .map((element) => (element.type === "text" ? element.text : ""))
    .join(" ")
    .toLowerCase();

  assert.ok(allText.length > 20, "expected meaningful on-screen copy");
  assert.ok(!allText.includes("lorem"), "must not contain lorem ipsum");
});

test("generation is deterministic for the same prompt", async () => {
  const prompt = "A 20-second minimalist typography video about focus.";
  const first = await generateProject({ prompt });
  const second = await generateProject({ prompt });

  // Ids are random, but the structure must match.
  assert.equal(first.project.scenes.length, second.project.scenes.length);
  assert.equal(
    first.project.scenes.map((s) => s.name).join("|"),
    second.project.scenes.map((s) => s.name).join("|"),
  );
  assert.equal(
    first.project.scenes.map((s) => s.durationInFrames).join(","),
    second.project.scenes.map((s) => s.durationInFrames).join(","),
  );
});

test("different prompts produce different structures", async () => {
  const network = await generateProject({
    prompt: "A cinematic video about a computer network.",
  });
  const data = await generateProject({
    prompt: "A documentary video showing quarterly data growth.",
  });

  assert.notEqual(
    network.project.scenes.map((s) => s.name).join("|"),
    data.project.scenes.map((s) => s.name).join("|"),
  );
  assert.notEqual(
    network.project.style.palette.primary,
    data.project.style.palette.primary,
  );
});

test("aspect ratio from the prompt changes the canvas", async () => {
  const result = await generateProject({
    prompt: "Create a 15-second vertical 9:16 video about a product launch.",
  });

  assert.equal(result.project.width, 1080);
  assert.equal(result.project.height, 1920);
});

test("targeted edits preserve unrelated scenes", async () => {
  const generated = await generateProject({
    prompt: "A 30-second cinematic video about a computer network.",
  });

  const project = generated.project;
  const targetIndex = 1;
  const targetSceneId = project.scenes[targetIndex].id;
  const untouchedBefore = project.scenes
    .filter((_, index) => index !== targetIndex)
    .map((scene) => JSON.stringify(scene));

  const edited = await editProject({
    instruction: "Make the opening more dramatic.",
    project,
    focusedSceneId: targetSceneId,
    selectedElementIds: [],
  });

  // The targeted scene changed.
  const targetAfter = edited.project.scenes.find(
    (scene) => scene.id === targetSceneId,
  );
  assert.ok(targetAfter);
  assert.notEqual(
    JSON.stringify(targetAfter),
    JSON.stringify(project.scenes[targetIndex]),
    "the targeted scene should have changed",
  );

  // Every other scene is byte-identical.
  const untouchedAfter = edited.project.scenes
    .filter((_, index) => index !== targetIndex)
    .map((scene) => JSON.stringify(scene));
  assert.deepEqual(untouchedAfter, untouchedBefore);
});

test("monochrome edit changes the whole project style", async () => {
  const generated = await generateProject({
    prompt: "A 20-second video about a product.",
  });

  const edited = await editProject({
    instruction: "Change the entire project to a monochrome style.",
    project: generated.project,
    focusedSceneId: null,
    selectedElementIds: [],
  });

  assert.equal(edited.project.style.palette.background, "#0a0a0a");
  assert.equal(edited.project.style.palette.primary, "#ffffff");
  assert.equal(edited.project.style.name, "Monochrome");
});

test("add-particles edit only touches the focused scene", async () => {
  const generated = await generateProject({
    prompt: "A 25-second video about artificial intelligence.",
  });

  const project = generated.project;
  const focusedId = project.scenes[1].id;
  const otherBefore = JSON.stringify(project.scenes[0]);

  const edited = await editProject({
    instruction: "Add animated particles behind the main object.",
    project,
    focusedSceneId: focusedId,
    selectedElementIds: [],
  });

  const focused = edited.project.scenes.find((s) => s.id === focusedId);
  assert.ok(
    focused?.elements.some((element) => element.type === "particles"),
    "particles should have been added",
  );
  assert.equal(
    JSON.stringify(edited.project.scenes[0]),
    otherBefore,
    "unrelated scenes must be untouched",
  );
});

test("unrecognised instructions do not mutate the project", async () => {
  const generated = await generateProject({
    prompt: "A 20-second video about data.",
  });

  const edited = await editProject({
    instruction: "Flibbertigibbet the sprocket dynamics.",
    project: generated.project,
    focusedSceneId: null,
    selectedElementIds: [],
  });

  assert.deepEqual(
    edited.project.scenes.map((s) => JSON.stringify(s)),
    generated.project.scenes.map((s) => JSON.stringify(s)),
  );
  assert.ok(edited.summary.length > 0, "should explain what it can do");
});

test("scene duration edits are applied exactly", async () => {
  const generated = await generateProject({
    prompt: "A 30-second video about a network.",
  });

  const project = generated.project;
  const sceneId = project.scenes[0].id;

  const edited = await editProject({
    instruction: "Make this scene 5s",
    project,
    focusedSceneId: sceneId,
    selectedElementIds: [],
  });

  const scene = edited.project.scenes.find((s) => s.id === sceneId);
  assert.equal(scene?.durationInFrames, 5 * project.fps);
});
