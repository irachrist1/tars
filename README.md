# TARS — Chief of Staff on Claude

A Claude **skill** that turns Claude into a chief of staff for a professional-services knowledge worker whose entire working life — years of client documents, meetings, mail — lives in Microsoft 365 / OneDrive.

It keeps a lightweight map of the whole operation, finds anything via Microsoft 365 connector search (or a local scan), answers from the actual files **with citations**, connects documents/meetings/threads per client, drafts from the user's real precedents, quietly keeps its own notes current, and asks before anything risky.

The deliverable is a **capability, not an app**. The user lives in their existing Claude client (claude.ai, Claude Desktop, mobile). Their documents never move. The assistant's entire state is a small, human-readable markdown folder inside their own OneDrive.

> Named for TARS in *Interstellar*: a portable unit that carries everything the crew needs, with adjustable settings.

## Install

Published on npm — works on any machine with Node, no clone, no auth:

```bash
npx tars-chief-of-staff
```

That copies the skill to `~/.claude/skills/chief-of-staff/` (use `--project` for `./.claude/skills`, `--force` to overwrite, `--uninstall` to remove). Then, in your Claude client:

```
set up my chief of staff
```

The only technical prerequisite is the **Microsoft 365 connector** enabled in the Claude client (Settings → Connectors; org admin consent if needed). No terminal for the end user — the npx line is for whoever provisions the machine; on claude.ai with the connector, the skill alone is enough.

## Onboarding (what the first session feels like)

Designed in full at `skills/chief-of-staff/references/onboarding.md`. The shape: it detects what it has (connector / file access / where OneDrive is), asks **one** question ("where is your work kept?"), reads the folder with consent, and comes back uncannily specific — your clients, what's live, the deadline it spotted, the folder it couldn't place. Four more plain questions (how you write, what matters, boundaries), one consent gate showing the proposed workspace, then it proves itself on a real question with a citation. Under 15 minutes, no ceremony.

## The product

| Piece | What |
|---|---|
| `skills/chief-of-staff/SKILL.md` | **The product.** Map + connector search + precedents + quiet self-maintenance + archiving + consent rule. |
| `skills/chief-of-staff/references/` | Onboarding script, workspace file shapes. Loaded on demand. |
| `skills/chief-of-staff/scripts/scan.mjs` | Local accelerator for map building: stat-only skeleton of tens of thousands of files in seconds. Optional — the connector-only path needs no install. |
| `bin/install.mjs` | The npx installer. Copies the skill, prints next steps. No deps, no network. |
| `docs/independent-review.md` | Why this architecture: the problem read, the verdict on prior directions, the build plan, what we deliberately don't build. |

## Architecture in one paragraph

The corpus stays where it lives (OneDrive/SharePoint/Outlook) — never copied, never transformed. Retrieval is **map + search + just-in-time reading + citation**: a small agent-built `MAP.md` for orientation, Microsoft's own server-side content index (via the Claude Microsoft 365 connector) as the grep-equivalent, and an agentic loop that reads only the two or three files a task needs. "How their work is done" comes from **precedents fetched at task time**, not stored style profiles, plus a bounded `USER.md` of explicit corrections. The workspace updates itself quietly (session-audit, one-line notice, dated `LOG.md`) and asks one plain question when it cannot connect something search can't settle — never when looking would do.

## Delivery

Zero terminal. Org admin enables the Microsoft 365 connector once; the skill is uploaded at org level; the user says "set yourself up" in their Claude client. White-glove for the first customer; the same skill is the repeatable product.

## Status

- `skills/chief-of-staff/SKILL.md` — current direction, connector-first. Phase 1 = run onboarding with the first real user and measure recall on 20 real questions (see `docs/independent-review.md` §e).
- `skills/chief-of-staff/scripts/scan.mjs` — verified on macOS at scale.
- `bin/install.mjs` — verified: install, clobber-guard, `--force`, `--uninstall`.
- **Parked, kept for parts:** `skills/second-brain-bootstrapper/` (vault-transformation premise is wrong for this buyer; its memory-architecture discipline lives on in the workspace design) and `skills/jarvis/` (developer-persona machine scanning). See the review doc for the full reasoning.

## Quick start (developer)

```bash
npm run install-hooks                                  # pre-commit data-safety scan
node skills/chief-of-staff/scripts/scan.mjs --root "<a work folder>"   # map skeleton on your own files
node bin/install.mjs --project                         # install the skill into this repo's .claude/skills
```

## Data safety

On-device / in-tenant by default, consent before anything outbound or destructive, no tokens held (connectors only), templates synthetic, pre-commit scan as a hard gate. See `docs/data-safety.md`. The repo stays private.
