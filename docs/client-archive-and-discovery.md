# Spec: Needs-Discovery Onboarding + Tiered Reading + Client Archive

Phase-next design. Not built. Captures two gaps found while pressure-testing the James
use-case (a CPA/multi-business operator with 15 years of client files).

## Gap 1 — Onboarding confirms identity but never asks what the user needs

The current interview (stage 4) is confirmation ("you build software, right?") + gap-fill.
It never asks what the system should *do for them*. Fine for inferring a student/dev from
a machine; wrong for an operator whose whole value is the needs answer.

**Add a short needs-discovery pass after identity is confirmed.** grill-me style — sharp,
slightly adversarial, keeps the user concrete. 2-4 questions, e.g.:
- "What breaks for you today that this should fix?"
- "What decision are you trying to make this week?"
- "What do you reach for and can't find?"
- "If this saved you one hour a week, where would that hour come from?"

Output: a `needs` block in the profile that shapes folder structure, default behaviors,
and which capabilities to prioritize. The scaffolder reads it; the generated CLAUDE.md
reflects it. Cap total interview (identity + needs) at ~8 questions.

## Gap 2 — Metadata-only is too shallow for messy real archives

Current rule: read filename/size/mtime, never open a file. Privacy-safe but names lie
(`Final_v3_REAL.xlsx`, `scan_0042.pdf`, `Document1`). Useless on a 15-year client store.

**Move to tiered, consented reading:**
- **Broad sweep** stays metadata-only (cheap, safe) — counts, folders, clusters.
- **Active tier** (recent + user-flagged clients): with explicit consent, OPEN and
  summarize a *scoped* set (tens, not thousands). Read 50 live files, never 50k.
- Use signals beyond the name: folder path (`/Clients/Mima/2024/`), file type, mtime
  clusters, co-location.
- When names are junk, show the user a sample and let them label the folder once.
  Human-in-the-loop beats guessing.

Revise the hard rule from "never open a file" to "never open without consent; open
selectively for the active set."

## Gap 3 — Client archive at scale (the James core)

For a user with deep client folders since 2010:

- **Never move or rename. Index + link in place.** Originals stay where they are. The
  vault holds references/links + a lightweight catalogue (path, date, client, type,
  one-line summary), never copies.
- **Tier by relevance:**
  - Hot (active clients, ~last 90 days): richly indexed, content-summarized, fast.
  - Warm (~last 2 years): lightly indexed, metadata + folder signal.
  - Cold (older archive): catalogued only, content read on explicit request.
- **Relevance signals, in order:** recency, recent activity (mtime), relationship to an
  active client/deal, query scope. The model loads on demand; it never holds 15 years.
- **When overwhelmed, ask — don't guess.** "340 files match 'Mima' across 2010-2026.
  Active matters only, or the full archive?" Surface ambiguity as a question.
- **Setup:** index the active set first. Leave the deep archive as a cold searchable
  store touched only on request. ~90% of daily value is in the last 90 days.

## Where this plugs in

- Gap 1 → interview stage (SKILL.md §4, stages.md question bank).
- Gap 2 → local-index.mjs gains an opt-in `--read-active` mode; the skill asks consent.
- Gap 3 → a new client-archive indexer (Phase-next), separate from the 30-day cheap-wow
  index. Connector-first for M365/SharePoint client data where available.

## Honest scope note

Gaps 1-2 are small and worth doing before any real client pilot. Gap 3 is a feature in
itself — only build it against a real engagement (e.g. James), driven by the needs his
discovery pass surfaces, not speculatively.
