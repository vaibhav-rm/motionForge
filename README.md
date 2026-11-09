# MotionForge

**MotionForge** is an AI-powered video creation studio that turns natural-language descriptions into **editable, high-quality videos** rendered with [Remotion](https://www.remotion.dev/) (React + TypeScript).

> _Describe it. Visualize it. Refine it. Render it._

Instead of generating slides or executing arbitrary code, MotionForge uses a **safe, validated pipeline**: the AI produces a structured video plan (JSON) that is validated and compiled into a real Remotion composition built from reusable motion-design components. You can preview, edit scenes/elements, refine with conversation, and export MP4.

## Features

- **Text → video project:** describe any idea (cinematic, documentary, technical, abstract, product, data viz, typography, sci‑fi, storytelling) and get a paced, multi-scene composition.
- **Creative direction, not templates:** intent/style/palette/pacing analysis drives varied visuals (networks, diagrams, charts, particles, kinetic type, shapes) — not a fixed slideshow.
- **Editable projects:** scene timeline, properties inspector, undo/redo, autosave, version snapshots.
- **Conversational editing:** targeted natural-language changes (e.g. _make the opening more dramatic_, _add particles_, _change to monochrome_, _slow the transition_) applied as scoped operations that **preserve unrelated scenes**.
- **Remotion rendering:** dynamic composition, frame-based animation, sequences, transitions, camera motion, server-side H.264 MP4 export with progress.
- **Assets:** upload images/audio/video/SVG (local or S3-compatible storage) and use them in projects.
- **Provider-independent AI:** works **offline by default** (built-in creative director, no API key). Optionally use OpenAI-compatible or Anthropic providers.
- **Portable data:** Prisma + SQLite for easy local dev; schema portable to Postgres.

## Repository layout

```
apps/
  web/        Next.js app (dashboard + editor + API routes)
  renderer/   Remotion root, bundling, render service/worker/CLI
packages/
  video-schema/      Zod schemas: project/scene/element/animation/plan + validation
  shared/            utilities
  video-components/  Remotion composition + motion/scene/element renderers
  ai-engine/         prompt analysis, planning, plan→project compiler, edit ops, providers
  database/          Prisma schema/client, projects/assets/jobs/versions/messages/auth
  asset-manager/     storage abstraction (local + S3-compatible), upload validation
```

## Prerequisites

- **Node.js >= 20.11** (developed/tested on Node 22)
- **npm** (workspace-aware). `ffmpeg`/`ffprobe` available on PATH for rendering.
- A Chromium/Chrome Headless Shell is provisioned by Remotion (`remotion browser ensure`, already run in this workspace).

## Quick start

```bash
npm install

# Configure env (defaults work locally; offline AI, SQLite, local storage)
cp .env.example .env
# The web app also reads apps/web/.env (preconfigured with absolute local paths).

# Ensure the SQLite database exists / is in sync
npm run db:push

# Start the web app
npm run dev
# open http://localhost:3000
```

Create a project, describe a video in the AI assistant, preview it, refine it, then export an MP4.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` (SQLite) | Prisma datasource URL. Use Postgres by changing provider in `packages/database/prisma/schema.prisma`. |
| `AUTH_SECRET` | dev value | Session cookie signing secret (**change in production**). |
| `STORAGE_DRIVER` | `local` | `local` or `s3`. |
| `STORAGE_LOCAL_ROOT` | `./storage` | Local asset/output root. |
| `S3_*` | — | Endpoint/region/bucket/keys for S3-compatible storage. |
| `AI_PROVIDER` | `local` | `local`, `openai`, `anthropic`. |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | — | For OpenAI-compatible providers. |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | — | For Anthropic. |
| `RENDER_OUTPUT_DIR` | `./storage/renders` | MP4 output directory. |
| `RENDER_CONCURRENCY` | `1` | Worker concurrency. |

**Security note:** AI output is validated data only — never executed as code. Rendering runs via Remotion/FFmpeg; run workers as separate processes in production and keep secrets out of source control.

## Development commands

```bash
npm run dev                  # Next.js dev server (web)
npm run build                # build packages + apps
npm run typecheck            # workspace typecheck (where configured)

# AI pipeline tests (verified: 11/11 passing)
npm test --workspace @motionforge/ai-engine

# Direct render (verifies full Remotion+FFmpeg pipeline)
npm run render --workspace @motionforge/renderer -- --prompt "A 30-second cinematic visualization of a computer network" --quality draft

# Render worker (processes queued jobs)
npm run worker --workspace @motionforge/renderer

# Database
npm run db:push
npm run db:generate
```

## How generation works

1. You submit a prompt (and optional constraints). The system analyses intent (duration, style, palette, topics, pacing).
2. A provider produces a **scene plan** (or the offline director plans locally). The plan is **validated** against the schema.
3. A deterministic **compiler** expands the plan into a full `Project` (scenes, elements, animations, camera, transitions) using the component library.
4. The Remotion `Player` previews the exact same composition the renderer exports. Edits are applied as scoped operations and revalidated.

## Status & roadmap

See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for implemented scope, verification, MVP criteria mapping, and next steps (deeper timeline/audio/waveform UX, production auth hardening, worker scaling, richer component library).

## License

Project workspace; review dependency licenses (Remotion, etc.) before commercial use.
