# Roadmap

A GitKraken-style desktop Git GUI. This roadmap tracks what's built, what's in
progress, and what's planned. Items are roughly ordered by priority within each
phase.

Legend: ✅ done · 🔨 in progress · ⬜ planned

## Phase 1 — Foundations ✅

- [x] Tauri 2 + React + TypeScript + Vite skeleton
- [x] Safe git subprocess layer (args array, no shell)
- [x] `git log --all --topo-order` with parents, parsed into commits
- [x] Lane-assignment graph layout (fork on merge, lane merging)
- [x] Canvas graph renderer: colored lanes, curved cross-lane connectors
- [x] Virtualized commit list (scrolls smoothly on large repos)
- [x] Repository picker (folder dialog + searchable recent list)
- [x] Feature-first project structure + `@/` alias

## Phase 2 — Commit & working tree ✅

- [x] WIP row above the graph (modified/added/deleted counts, hidden when clean)
- [x] Commit composer: stage/unstage file trees, stage-all/unstage-all
- [x] Commit with subject + description (index-only)
- [x] Commit detail panel: subject, author, date, parents, refs
- [x] Changed-files tree with status icons + per-kind counts

## Phase 3 — Inspection & diff ✅

- [x] Side-by-side full-file diff viewer (left-panel swap)
- [x] Click a changed file to open its diff (commit detail + composer)
- [x] Change highlighting + hunk-only fallback + too-large guard
- [x] Working-tree diff from the composer's staged/unstaged trees

## Phase 4 — Branching & history ⬜

- [ ] Branch list / branch switcher (checkout)
- [ ] Create / delete / rename branches
- [ ] Merge with conflict detection and basic resolution UX
- [ ] Rebase UI
- [ ] Cherry-pick, reset (soft/mixed/hard)
- [ ] Stash (create, list, apply, drop)
- [ ] Tag create/delete

## Phase 5 — Remote operations ⬜

- [x] Push / pull / fetch with progress feedback
- [ ] Remote management (add/remove remotes)
- [ ] Remote branch tracking indicators on the graph
- [ ] Clone a repository from a URL

## Phase 6 — AI integration ⬜

- [ ] Generate commit message from staged diff (subject + description)
- [ ] Compose commits: group changed files by change context into logical,
      reviewable commits (instead of one big commit)
- [ ] Generate pull request title + description from the branch's commits
- [ ] Model/provider selection + API key settings (per-repo / global)

## Phase 7 — Project

- [ ] Allow open multiple project using Tab

## Phase 8 — Polish ⬜

- [ ] Amend commits from the composer
- [ ] Keyboard shortcuts (commit, stage, search…)
- [ ] Per-repo settings + app settings
- [ ] Theme options (light/dark)
- [ ] Performance profiling on very large repos
- [ ] Packaging / installers (deb, rpm, AppImage)
