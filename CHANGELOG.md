# Changelog

All notable changes to TARS are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

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
