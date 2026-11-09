import { registerRoot } from "remotion";
import { RemotionRoot } from "./root";

/**
 * Remotion entry point.
 *
 * The renderer bundles this file and renders the `MotionForge` composition.
 * The composition takes the project document as input props, so the same
 * bundle can render any project — no code generation happens at render time.
 */
registerRoot(RemotionRoot);
