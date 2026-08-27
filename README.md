# GitCanoe

A GitKraken-style desktop Git GUI, built with **Tauri 2 + React + TypeScript + Vite**.

The backend shells out to the `git` CLI (args array, never a shell string — no
shell injection). The frontend renders the commit graph on a canvas with a
virtualized commit list, so it stays smooth on large repos.

## Features

- **Commit graph** — colored lanes, merge/branch connectors with rounded
  corners, virtualized rendering
- **WIP row** — shows uncommitted changes at the top of the graph
  (modified / added / deleted counts), hidden when the tree is clean
- **Commit composer** — stage/unstage files in collapsible file trees,
  stage-all/unstage-all, subject + description, commits only the index
- **Commit detail** — subject, author, date, parents, refs, and a collapsible
  file tree of changed files with status icons and counts
- **Repository picker** — JetBrains-style welcome screen with a searchable
  recent-repos list (persisted to localStorage)

## Prerequisites

- [Node.js](https://nodejs.org) 18+ and npm
- [Rust](https://rustup.rs) stable
- Tauri system dependencies for your platform — see the
  [Tauri prerequisites](https://tauri.app/start/prerequisites/)

## Getting started

```bash
# 1. Install frontend dependencies.
#    (This machine sets NODE_ENV=production globally, which makes npm skip
#    devDependencies — force development so vite/tsc/vitest install.)
NODE_ENV=development npm ci

# 2. Run the desktop app in dev mode.
npm run dev:desktop
```

`npm run dev:desktop` sets `WEBKIT_DISABLE_DMABUF_RENDERER=1`, which is
required for the webview on this machine (Wayland).

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev:desktop` | Run the desktop app (Tauri + Vite dev server) |
| `npm run dev` | Run only the Vite dev server (frontend) |
| `npm run build` | Typecheck + production frontend build |
| `npm run test` | Frontend tests (Vitest) |
| `cd src-tauri && cargo test` | Backend tests (git parsers) |

## Architecture

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

src-tauri/src/
  commands/             # one file per command area (log, refs, show, repo, status, commit)
  git/                  # git subprocess layer (run, run_ok, parsers)
  error.rs, lib.rs, main.rs
```

Feature-first layout: each feature owns its components + logic in
`src/features/<feature>/`; code reused by 2+ features lives in `src/shared/`.
All imports use the `@/` alias.

See [ROADMAP.md](./ROADMAP.md) for where the project is headed.
