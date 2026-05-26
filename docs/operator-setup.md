# Operator Setup (multi-business / CPA / consultant)

How to run TARS for someone like a partner who runs several businesses plus a firm, with
years of client files. The generic flow works, but lead with these three things.

## 1. Needs first, not folders

After confirming who they are, run the needs-discovery pass (see SKILL.md §4). For an
operator the value is defined here, not by the file scan. Ask what breaks, what decision
they're making, what they can't find. Their answers decide what to prioritize.

## 2. Index the client archive — don't flat-scan it

```
node scripts/index/client-archive.mjs --root "<their Clients/Entities folder>"
```

- Tiers each client/entity into **hot / warm / cold** by recency.
- Links to originals **in place** — never moves, renames, or copies.
- Flags oversized folders (⚠) so you scope before deep work.
- Status per client: active / warm / dormant, plus last-activity date.

Index the **active set first**. Leave the deep archive (pre-2-year) as a cold store
touched only on request. ~90% of daily value is in the last 90 days.

## 3. Read the active set — filenames lie

`Final_v3_REAL.xlsx` tells you nothing. With explicit consent, sample real content from
the live set:

```
node scripts/index/client-archive.mjs --root "<...>" --read-active --max-read 40
```

Opens the first 1KB of recent text files (md/txt/csv) only, capped. Never the whole
archive, never without consent. Use folder path + type + mtime clusters as signal too,
and when names are junk, show the user a sample and let them label the folder once.

## 4. When overwhelmed, ask

If a client has hundreds/thousands of files, don't guess. Surface it:
*"340 files match this client across 2010–2026. Active matters only, or the full archive?"*
Let them scope. Ambiguity becomes a question, never a silent guess.

## What this does NOT do yet

Cross-entity financial consolidation, board-ready reporting, and per-entity deadline
dashboards are the executive features an operator would actually pay for. They are not
built. Run a real discovery conversation, see which 2–3 they keep reaching for, then
build those against the real engagement. Don't build them speculatively.
