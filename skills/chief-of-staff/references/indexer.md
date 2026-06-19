# The local index — how to use it

`scripts/indexer.mjs` is TARS's own full-text index over the user's work folder.
It is the fast lane behind "find / pull / where is X": ranked file hits with
snippets in milliseconds, fully local, no dependencies, nothing transmitted. It
works everywhere Node runs — it is the cross-platform answer where macOS
Spotlight (`mdfind`) doesn't exist (Windows, Linux, headless).

## Why it exists

Without it, every local "find X" re-walks the disk: slow, and it spends tokens
streaming a scan into the model. The index moves the heavy walk to **once**;
after that, queries hit the built index and return only the top N hits. That is
what makes "pull last year's ACME numbers" feel instant and stay cheap.

## Commands

```sh
# Build once, after you know the work folder (point --root at it).
node scripts/indexer.mjs build  --root "<their work folder>"

# Ask it anything. --json gives you a compact, parse-ready result.
node scripts/indexer.mjs query  "acme 2024 audit fees" --json --top 8

# Refresh cheaply — re-indexes only files whose mtime changed, drops deleted ones.
node scripts/indexer.mjs update --root "<their work folder>"

# Sanity check.
node scripts/indexer.mjs stats
```

The index lives at `<work folder>/.tars-index/` by default (override with
`--store`). It is derived data inside the user's own storage — they own it and
can delete it; rebuild any time. Add `.tars-index/` to ignore lists if the work
folder is a git repo.

## How to use it in a session

1. **First run / setup:** after confirming the work folder, run `build`. On a
   large corpus this is the one slow step; say so ("indexing your work once —
   this is the only slow part").
2. **Every "find / pull / what did we say about X":** prefer `query` over a raw
   walk. Read the top hits' real files before answering, and cite them. Do not
   answer from the snippet alone — the snippet tells you *which file*, the file
   tells you the *truth* (filenames and snippets can mislead).
3. **When things may have moved:** run `update` first (it's near-instant if
   little changed), then query. Roughly: update at session start if it's been a
   while, or when a query comes up empty for something you know exists.

## What it indexes

- **Text files** (`.md .txt .csv .json .yaml .html`, code, …) are **full-text**
  indexed (first 512KB each).
- **Everything else** (`.docx .xlsx .pptx .pdf`, images) is indexed by
  **filename + path tokens**, so it's still findable by name — but there's no
  body snippet for those, and a body-only match won't surface them.
- Filename and path tokens are **boosted**, so "the ACME proposal" finds
  `Clients/ACME/Proposal v3.docx` even when the body never repeats the words.

### Extending to office/PDF body text

Body extraction for binary formats is a deliberate, isolated extension point:
the `EXTRACTORS` map in `indexer.mjs` maps an extension to an
`async (path) => string`. Wire a converter there (e.g. `textutil` on macOS, or an
optional dependency) and those files upgrade from filename-only to full-text with
no other change to the index format. Until then, lean on the Microsoft 365
connector's content search for inside-the-document matches on office files, and
use the local index for everything text-based and for fast filename/path lookup.

## Ranking

BM25 over an inverted index (the standard relevance model), with a boost on
filename/path terms. Query terms are lowercased, stopworded, and matched against
both body and path tokens. Results are sorted by score; ties broken by score
only — check recency (`modified`) yourself when "latest" matters.
