# MotionForge — Project Status

_Last updated: 2026-11-09_

## Summary

MotionForge is an AI-powered video creation studio built on Remotion (React/TypeScript). The core engine, AI generation pipeline, database, asset/storage layer, Remotion renderer, and a Next.js web application (dashboard + editor) are implemented. The **AI pipeline and rendering pipeline are verified end-to-end with automated tests and a real MP4 render**.

## Architecture (implemented)

- **Monorepo** (npm workspaces): `apps/web`, `apps/renderer`, `packages/{video-schema,shared,video-components,ai-engine,database,asset-manager}`.
- **Safe AI pipeline (no arbitrary code execution):** the AI produces a **validated JSON video plan/spec** (`@motionforge/video-schema`, Zod). A deterministic compiler (`@motionforge/ai-engine`) converts the plan into a complete Remotion `Project` composed from reusable components. The renderer never executes model-generated code.
- **Provider-independent AI:** `local` (built-in offline creative director, default — works with no API key), `openai`/OpenAI-compatible, `anthropic`. Configured via env (`AI_PROVIDER`, `OPENAI_*`, `ANTHROPIC_*`).
- **Remotion rendering:** `@motionforge/video-components` provides the dynamic composition + motion/scene/element renderers (text/typography, shapes, charts, networks, particles, diagrams, icons, image/video, camera, transitions, atmosphere). `apps/renderer` bundles and renders H.264 MP4 via `@remotion/renderer` + FFmpeg. Chrome Headless Shell provisioned.
- **Database:** Prisma + **SQLite** by default (`packages/database/prisma/dev.db`) for zero-dependency local dev; schema is portable to Postgres (change datasource provider + `DATABASE_URL`). Models: User, Session, Project, Scene, Asset, RenderJob, ProjectVersion, ProjectMessage.
- **Storage:** local filesystem driver (default) and an S3-compatible driver, behind a single abstraction. Upload validation (type/size) and path-traversal protection.
- **Web app (Next.js 15, App Router, Tailwind 4):** dashboard/project management, full editor workspace (AI creative assistant, Remotion Player preview, properties inspector, scene timeline), asset upload/serve routes, render trigger/progress/download routes. Autosave, undo/redo, scene add/duplicate/delete/reorder, conversational edit flow.

## Verification performed

- `packages/ai-engine` pipeline tests: **11/11 passing** (`tsx --test`). Covers prompt analysis (duration/style/topic/palette extraction), style resolution, multi-scene generation, deterministic structure, prompt-driven variety, aspect-ratio handling, and **targeted conversational edits that preserve unrelated scenes** (style-wide monochrome, add particles scoped to a scene, duration edits, safe handling of unrecognised instructions).
- **Real MP4 render verified:** `apps/renderer` rendered a generated project to H.264 (`960x540` draft shown in smoke output path; composition respects project settings) via `@remotion/renderer` + FFmpeg (Chrome Headless Shell installed). Output: `apps/renderer/storage/renders/*.mp4`.
- `apps/web` **production build succeeds** (`next build`).

## MVP acceptance criteria — status

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Create a new project | **Done** | Dashboard/API create blank project; persisted in DB. |
| 2 | Describe a video in natural language | **Done** | AI assistant panel + `/api/ai/generate`. |
| 3 | AI interprets prompt and creates a structured scene plan | **Done** | Offline creative director analyses intent, resolves style/palette/pacing, plans paced scenes; LLM providers supported via same plan schema. |
| 4 | System generates a working Remotion composition | **Done** | Deterministic plan→project compiler + dynamic `MotionForge` composition. |
| 5 | Video preview displays the generated composition | **Done** | Remotion `Player` in editor; runtime verified via actual renderer output. Full browser-interaction smoke depends on running the app locally. |
| 6 | Modify individual scenes | **Done** | Inspector (scene name/duration/bg/transition/notes) + timeline scene ops; element property edits. |
| 7 | Request changes through natural language | **Done** | `/api/ai/edit` + assistant; local editor maps common instructions (dramatic, monochrome, particles, transitions, camera, duration, text, typography). |
| 8 | Targeted edits preserve unrelated scenes | **Done (verified)** | Structural operation-based edits + automated tests confirm unrelated scenes unchanged. |
| 9 | Upload and use custom assets | **Done (core)** | Upload/list routes, local storage, asset refs embedded in project; player/renderer resolve asset URLs. Rich in-editor drag/placement UX can be expanded. |
| 10 | Project auto-saved | **Done** | Debounced autosave on editor changes + explicit save/version snapshots. |
| 11 | Render a complete MP4 video | **Done (verified)** | DB-backed render jobs + in-process render trigger + separate worker; real MP4 produced by renderer. |
| 12 | Download the rendered video | **Done** | `/api/renders/[jobId]?download=1` serves MP4 with attachment disposition. |

## Known issues / limitations / next steps

- **Browser E2E not captured in this environment:** the web UI was built and compiles, and the underlying engine/render paths are verified; a full interactive browser walkthrough (create → prompt → preview → edit → upload → render/download) should be run locally (`npm run dev`).
- **AI quality depends on provider:** the offline director produces coherent, varied, non-slideshow motion-graphics plans but is heuristic; configuring `AI_PROVIDER=openai|anthropic` with a capable model yields richer interpretation.
- **Advanced editor UX (expand):** drag-and-drop timeline/layer reordering, keyframe-level timing UI, waveform visualization, multi-select/marquee, direct on-canvas element manipulation, and richer audio controls are scaffolded at the data/model level and partially in UI; can be deepened.
- **Auth:** frictionless local workspace user is auto-provisioned for dev; production should enforce explicit auth, CSRF hardening, and rate limits (hooks/structure in place).
- **Rendering scale:** in-process render trigger works for dev; production should run `@motionforge/renderer` worker(s) separately (queue already DB-backed) and use object storage.
- **Code-generated visuals beyond schema:** intentionally constrained to validated spec + component library for safety/reliability (per PRD). Extend by adding new component primitives, not arbitrary code execution.
- **Server restart during session:** workspace recovered; tsx was reinstalled (was corrupted) — environment is stable.

## Key commands

```bash
# install
npm install

# database (SQLite dev db already created at packages/database/prisma/dev.db)
cp .env.example .env   # adjust if needed; apps/web/.env is preconfigured for local paths
npm run db:push

# run web app (dashboard + editor)
npm run dev            # http://localhost:3000

# run tests (AI pipeline)
npm test --workspace @motionforge/ai-engine

# render a video directly (verifies Remotion+FFmpeg)
npm run render --workspace @motionforge/renderer -- --prompt "A 10-second cinematic network visualization" --quality draft

# background render worker (production-style queue processing)
npm run worker --workspace @motionforge/renderer
```
