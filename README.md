# TARS — Second Brain Bootstrapper

A Claude **skill** that turns a blank machine into an organized, maintainable second brain. It inspects the machine, infers who the user is, indexes what they already have, confirms with a few sharp questions, and scaffolds a personalized markdown vault with a parameterized operating manual.

The deliverable is a **transformation**, not an app. After setup the user lives in their existing Claude client plus plain markdown files. There is nothing to stare at.

> Named for TARS in *Interstellar*: a portable unit that carries everything the crew needs, with adjustable settings. This ships the same thing — a portable, plain-markdown brain with an operating manual you tune per person.

## Install

One line, via the open [`skills`](https://github.com/vercel-labs/skills) CLI. Works in Claude Code, Cursor, Codex, and Claude Desktop (anything that reads `SKILL.md`):

```bash
npx skills@latest add irachrist1/tars
```

Then, in your Claude client:

```
Build me a second brain.
```

The skill takes over from there. (While the repo is private you'll need a GitHub token in your environment, or clone and `npx skills@latest add ./tars`. The one-liner above is the experience once it's public.)

## Two skills: set it up, then run it

TARS ships two complementary skills. The bootstrapper *creates* the second brain once; Jarvis *runs* it every day.

| Skill | Role | Invoke |
|---|---|---|
| `skills/second-brain-bootstrapper/` | One-time setup — detect, profile, scaffold the vault + operating manual | "Build me a second brain." |
| `skills/jarvis/` | Daily driver — scans the machine each session, builds persistent memory, answers real questions about your actual day ("how many hours on this client this week?", "what's overdue?", "how much time on YouTube?") | `/jarvis` |

(Jarvis was previously the standalone `jarvis-claude` repo; it's merged here so setup and daily use live in one place. Its original pitch is preserved at `docs/jarvis-readme-legacy.md`.)

## What it is (and is not)

- **Is:** Claude skills (`skills/`) plus local helper scripts.
- **Is not:** a desktop app, a CLI for end users, or an MCP server. An MCP server is a possible *later* evolution, not built now.

## Core design

1. **Model capabilities, not tools.** notes, tasks, calendar, meeting-notes, email, read-later, behavior-data. Each resolves to a connector-tier, local-tier, or manual-fallback adapter. A working second brain is produced even with **zero** integrations.
2. **Substrate is not interface.** Source of truth is plain markdown. The interface is per-user: conversation (default), Notion (a synced *view*, never the source), or Obsidian (technical users).
3. **Connectors over credentials.** Microsoft 365, Google, and Granola come through the user's existing Claude connectors. TARS holds no tokens. (See `docs/azure-app-registration.md` for the rare deferred raw-Graph case.)
4. **Lead with the cheap wow.** A local, consented file index runs first and needs no integration at all.
5. **Infer identity, then confirm.** Because it can see the machine, the onboarding questions are specific confirmations, not cold generic prompts.
6. **Generate a maintainable system.** A line-capped `CLAUDE.md` pointer plus a scoped `MEMORY.md` index, not a dumping ground.

## Stages

`detect → index (the wow) → profile → interview (≤8 qs) → propose (consent gate) → scaffold + first-brief`

## Platform priority

Windows first (detection via registry / winget / Start Menu), macOS second. Integrations are connector-first on every platform.

## Layout

| Path | What |
|---|---|
| `skills/second-brain-bootstrapper/` | the skill (`SKILL.md` + on-demand references) |
| `scripts/detect/` | machine detection probes |
| `scripts/index/` | local file index (the cheap wow) |
| `scripts/scaffold/` | vault writer + first-brief |
| `templates/vault/` | blank, synthetic vault + `CLAUDE.md` + memory templates |
| `config/` | capability schema |
| `docs/` | data safety, walkthrough, deferred Azure path |

## Quick start (developer)

```bash
npm run install-hooks                 # install the pre-commit data-safety scan
npm run index                         # see the cheap wow on your own machine
node scripts/detect/detect.mjs        # safe dry-run: capability map, no scaffolding
```

`detect.mjs` is the safe entrypoint for testing on a fresh machine (especially Windows). It picks the right probe for the OS, prints the inferred capability map and archetypes, and writes nothing.

## What a run looks like (synthetic)

```
You: build me a second brain

TARS: Quick scan of your machine, app names only, nothing opened — ok? … done.
      Last 30 days here: 11 active project folders, 4 meeting notes, 89 files I can organize.
      You've got VS Code + git and an Outlook default. You build software and live in
      Microsoft 365 — and there's an active "Clients" folder, so you also consult. Right?

You: yep, and I'm finishing a degree

TARS: Then you're developer + consultant + student. One interface question: most people
      just talk to this in their Claude client. Want that, a Notion view, or Obsidian?

You: conversation

TARS: Here's the vault I'll create and the operating manual I'll write [shows tree + CLAUDE.md].
      Nothing is written until you say go.

You: go

TARS: Done. Vault at ~/second-brain. Pulling your last meeting through the Microsoft 365
      connector… brief filed. You now live in this from your Claude client.
```

All names and numbers above are illustrative. TARS uses synthetic placeholders everywhere; it never ships real data.

## Status

Phase 0 complete and verified on macOS: detection, capability inference, the local index, the scaffolder, the connector-first first-brief (read live mail/calendar via the Microsoft 365 connector, no custom OAuth). `windows-probe.ps1` is written to the same contract and needs a Windows box to validate. See `docs/phase-0-walkthrough.md`.

This repo is **private** for now. We flip it public once the Windows path is verified. Templates are blank and synthetic. See `docs/data-safety.md`.
