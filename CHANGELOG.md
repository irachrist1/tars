# Changelog

All notable changes to TARS are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

## [1.3.0] — 2026-06-20

Make the cross-surface promise real, and a `tars` command to drive it. Folds in the
strongest ideas from the team's exploration branches, implemented cleanly.

### Cross-surface
- **`npx tars-chief-of-staff --use`** (or `tars use`) prints a paste-ready prompt that
  wraps `SKILL.md` and stages its supporting files to a temp dir — so the chief of
  staff runs on **Cowork / claude.ai**, where a skill can't be installed. `--continue`
  switches the prompt to "continue as my chief of staff." This is the cross-surface
  answer until a publish API exists (issues #1, #3). New `references/handoff.md`; the
  skill now offers both a launch path and a paste path and never assumes Claude Code.

### CLI
- A short **`tars`** command (second bin) alongside `tars-chief-of-staff`.
- **`tars doctor`** — health-checks an install (skill version, work folder, local index,
  connectors) and exits non-zero on a blocking issue. **`tars index <build|update|query|stats>`**
  wraps the indexer. **`tars help`**.
- **`tests/smoke.mjs`** (`npm test`) covers packager + indexer + CLI; GitHub Actions CI
  runs it on ubuntu/macos/windows, plus `install.sh` shellcheck.

### Fixes (from review)
- **indexer:** `.obsidian` is now actually indexed (it was double-listed in the skip set,
  so the explicit exception was dead); `update` rebuilds instead of reusing an index built
  for a different `--root`; doc examples carry the required locator flag.
- **installers:** the version is read from `MANIFEST` (one source — `VERSION` and the file
  list can no longer disagree); updates now **prune files removed in newer releases** instead
  of leaving them behind; per-file download failures abort on Windows too.
- **package.mjs:** ships only git-tracked files (no stray local artifact can leak into the
  manifest or zip) and fails fast if the zip can't be built.

## [1.2.0] — 2026-06-19

A real local index, plus a packaging & update layer that ships it everywhere.

### The indexer (new)
- New `scripts/indexer.mjs` is TARS's own persistent, ranked full-text index over
  the user's work folder — pure Node, **no dependencies**, fully local, nothing
  transmitted. This replaces the previous "indexer" (which was really one-shot
  scanners + macOS Spotlight) with an index that **persists, is queryable, and is
  incremental**.
  - `build` walks once; `query` returns BM25-ranked file hits with snippets in
    **milliseconds** (single-digit ms on a small corpus), returning only the top N
    — so it answers "pull last year's numbers" without re-scanning the disk and
    without spending tokens on a walk.
  - `update` re-indexes **only files whose mtime changed** and drops deleted ones —
    the "doesn't re-scan your whole laptop" property.
  - Full-text for text formats; filename/path tokens (boosted) for office/PDF, with
    a documented `EXTRACTORS` hook to add body extraction later without changing the
    index format. Works **cross-platform** — the answer where Spotlight isn't.
- The skill's search ladder now queries this index as the primary local accelerator
  (`references/indexer.md`), ahead of `mdfind`.

### Distribution
- **One source of truth.** New `scripts/package.mjs` walks the skill folder and
  generates `MANIFEST` (version + every file to ship) and `VERSION` (carried
  inside the skill to every surface), and builds `dist/chief-of-staff.zip` for
  cloud upload. `npm run package` regenerates all three.
- **Installers no longer drift.** `install.sh` and `Install-Tars.ps1` now read the
  MANIFEST and fetch exactly what it lists — fixing the bug where the curl/PowerShell
  paths shipped without `connectors.mjs` (the v1.1.0 headline feature). Adding the
  indexer was zero installer edits: it shipped automatically once the manifest
  regenerated.

### Updates
- **Re-running is now an update, not a wall.** All three installers compare the
  installed `VERSION` to the published one: same → "already up to date"; newer →
  update in place. The user's `onboarding-seed.md` is preserved across updates;
  their OneDrive workspace is never touched. `npx … --update` forces a refresh.

### Cross-surface publishing
- New `PUBLISHING.md` documents the two-world model (local auto-update via
  re-run; cloud manual upload + re-upload to refresh) and the release checklist.
  Addresses the publishing-model half of issues #1 and #3.

## [1.1.0] — 2026-06-17

TARS stops being a file mapper and becomes a map of your whole connected operation.

### Connector detection
- New `scripts/connectors.mjs` runs `claude mcp list`, classifies every Claude
  connector against a registry of **what it holds and what to open it for**, and
  emits a `CONNECTORS.md` map grouped by tier (work / design / life / needs-auth).
  Detects Linear, Notion, Gmail, Granola, Google Calendar/Drive, Slack, Figma,
  Canva, Gamma, and more. Degrades gracefully when the `claude` CLI isn't present.
- **Route by source first:** the search ladder now sends each kind of question to
  the tool that holds the answer — project status → Linear, meeting notes →
  Granola, specs → Notion, threads → Gmail/Outlook — instead of searching files
  for an answer that lives in a tracker.
- **Onboarding is connector-aware:** Phase 0 detects the full connector surface,
  the first-run deep read samples it (active Linear projects, recent Granola
  meetings, top Notion pages), and the read-back names them specifically.

## [1.0.0] — 2026-06-17

First stable release. This is the version where the promise and the product line up:
TARS says it gives your AI the context it needs to deliver, and the onboarding now
sets up the exact thing that makes that true.

### Positioning
- New through-line everywhere (landing page, README, installer): **"Give your AI the
  context it needs to deliver."** Leads with the solo professional and the concrete
  payoff ("prep me for the 3pm call with last year's numbers"), not a vague "10x" claim.
- Corrected the privacy claim from the inaccurate "nothing leaves your machine" to the
  true one: **TARS never copies or moves your files.** The workspace is plain files you
  own and can delete.

### Onboarding
- The installer interview now sets up the **meeting** half of the promise: a new
  "where do your meetings and notes live?" question (Microsoft 365 / Google Calendar /
  Granola / nothing yet), threaded into the seed the skill reads on first run.
- The connector is surfaced as the step that **turns everything on**, tailored to the
  user's answer, instead of a footnote at the bottom.
- The "which AI" question is now honest: **TARS runs inside Claude today (ChatGPT is coming).**
- First-run proof defaults to a real **meeting prep** when a calendar is reachable —
  the signature demo now matches the signature claim.

### App awareness and handoff
- The installer **detects installed apps** (macOS) and *suggests* — never pushes — the
  ones that make TARS sharper, each with one plain line on why: **Obsidian** (a home for
  notes in plain files you own), **Granola** (real meeting transcripts to prep from),
  **Claude** (where TARS lives).
- The installer now **hands off into a coding agent**: it prefers **Claude Code**, falls
  back to **Codex**, and continues the conversation there so the agent picks up the seed
  and all the context just captured.

### Indexing (informed by macOS Golden Gate / macOS 27)
- The chief-of-staff **search ladder** now uses the on-device index for local content
  search: `mdfind "<query>"` (Spotlight, rebuilt as an on-device **semantic** index in
  macOS Golden Gate), instant and fully local — complementing connector search and
  upgrading the old filename-only local fallback.

## [0.1.5] — earlier

- Repositioned TARS as the layer over your AI; interactive installer; branding.
- Landing page: draggable 3D TARS, official Claude/OpenAI marks, click-to-copy install chips.
- `front-end-markdown` skill: beautiful HTML pages instead of markdown docs.
- MIT license; curl/PowerShell install paths (no Node required).
