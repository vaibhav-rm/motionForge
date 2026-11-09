/**
 * MotionForge AI engine.
 *
 * A provider-independent creative layer that turns natural language into
 * validated video specifications. The engine never emits executable code —
 * it emits data that passes through a schema validator before it can reach
 * the renderer.
 */
export * from "./providers/types.js";
export * from "./providers/registry.js";
export * from "./prompts/analyse.js";
export * from "./prompts/styles.js";
export * from "./prompts/planner.js";
export * from "./prompts/system.js";
export * from "./generation/compiler.js";
export * from "./generation/editing.js";
export * from "./generation/generate.js";
export * from "./generation/json.js";
