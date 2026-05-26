# TARS — Second Brain Bootstrapper

A Claude **skill** that turns a blank machine into an organized, maintainable second brain. It inspects the machine, infers who the user is, indexes what they already have, confirms with a few sharp questions, and scaffolds a personalized markdown vault with a parameterized operating manual.

The deliverable is a **transformation**, not an app. After setup the user lives in their existing Claude client plus plain markdown files. There is nothing to stare at.

> Named for TARS in *Interstellar*: a portable unit that carries everything the crew needs, with adjustable settings. This ships the same thing — a portable, plain-markdown brain with an operating manual you tune per person.

## What it is (and is not)

- **Is:** a Claude skill (`skills/second-brain-bootstrapper/SKILL.md`) plus local helper scripts.
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
npm run install-hooks          # install the pre-commit data-safety scan
npm run index                  # see the cheap wow on your own machine
```

## Status

Phase 0, in build. See `docs/phase-0-walkthrough.md` for the end-to-end target.

This repo is **private** and stays private. Templates are blank and synthetic. See `docs/data-safety.md`.
