# GiTako — Project Memory

## Project Overview

Desktop Git GUI (GitKraken-style) built with Tauri 2 + React + TypeScript + Vite.
The backend shells out to the `git` CLI (args array, never a shell string) and the
frontend renders a commit graph on a canvas with a virtualized commit list.

Common commands (run from repo root):

- `npm run dev:desktop` — run the desktop app (dev mode). This project's env needs
  `WEBKIT_DISABLE_DMABUF_RENDERER=1`, which the script sets. If node deps are
  missing, install with `NODE_ENV=development npm ci` (this machine sets
  `NODE_ENV=production` globally, which makes npm skip devDependencies).
- `npx tsc --noEmit` — typecheck frontend.
- `npx vitest run` — frontend tests (graph layout).
- `cd src-tauri && cargo test` — backend tests (git parsers).

## Project Structure

Feature-first layout. Every self-contained feature lives in `src/features/<feature>/`
with its components + logic colocated. Shared code lives in `src/shared/`. The app
shell lives in `src/app/`. Global state lives in `src/state/`.

```
src/
  app/                  # app shell: App.tsx, main.tsx, styles/index.css
  features/
    commit-graph/       # graph + commit list (canvas, layout, colors)
    commit-detail/      # detail panel (CommitDetail)
    commit/             # commit composer (CommitComposer)
    repo/               # open-repo flow
    status-bar/         # StatusBar
  shared/
    components/         # FileTree, StatusIcon (used by 2+ features)
    utils/              # time, hash, status, error, fileTree
    types/              # git.ts
  state/                # zustand store + tauri invoke wrappers
```

Rules:

- New feature code goes in `src/features/<feature-name>/` (component + any logic that
  only it uses).
- Code reused by 2+ features goes in `src/shared/` (`components/`, `utils/`, or
  `types/`) — e.g. the file tree builder + FileTree component are shared by the
  commit-detail and commit composer features.
- App shell / entry points / global styles stay in `src/app/`.
- Stores and Tauri invoke wrappers go in `src/state/`.
- All imports use the `@/` alias: `@/features/...`, `@/shared/...`, `@/state/...`.
  No relative imports across feature boundaries (sibling imports within one
  feature folder are fine).
- Never create new top-level folders in `src/` without updating this section.

Backend mirror:

```
src-tauri/src/
  commands/   # one file per command area (log, refs, show, repo, status); mod.rs lists modules
  git/        # git subprocess layer (run, run_ok, parsers)
  error.rs, lib.rs, main.rs
```

Rules:

- Each Tauri command lives in its own file under `commands/`. Register it in
  `commands/mod.rs` AND reference it by full module path in `lib.rs`'s
  `generate_handler!` (e.g. `commands::log::git_log`). Do NOT re-export commands
  via `pub use` — the Tauri macro emits hidden `__cmd__*` symbols in the defining
  module, so re-exports break `generate_handler!`.
- Git subprocess helpers (`Command::new("git")`, output parsers) go in `git/`.
- Frontend invoke wrappers go in `src/state/git.ts`, never inline in components.
