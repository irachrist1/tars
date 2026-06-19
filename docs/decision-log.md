# Decision log — ship to advertised product

Decisions made during the autonomous ship pass (v1.3.0).

## 2026-06-19 — Branch base

**Decision:** Branch from PR #27 (`cursor/merge-pr-15-26-01b1`) rather than merge to main first.  
**Why:** Prompt file and v1.2.0 indexer/installer work live on that branch; ship work extends it in one PR.

## 2026-06-19 — CLI module split

**Decision:** Extract `bin/lib/*` (paths, doctor, bootstrap, publish) instead of one monolithic `install.mjs`.  
**Why:** Phase 1–5 add many subcommands; shared path detection was duplicated.

## 2026-06-19 — Bootstrap before Claude opens

**Decision:** `tars open` runs scan + index build + CONNECTORS seed when no `workspace-bootstrap.json`.  
**Why:** Delivers "reads your work first" without requiring terminal literacy in Claude.

## 2026-06-19 — Context engine as merge layer

**Decision:** `scripts/context-engine.mjs` merges BM25 hits, connector routes, and client brief pointers — not a remote service.  
**Why:** Cross-platform, pointer-only, citeable JSON for the agent.

## 2026-06-19 — ChatGPT via export, not duplicate skill

**Decision:** Ship `tars export --chatgpt` wrapping SKILL.md; remove "coming soon" copy.  
**Why:** Phase 9 rule — ship or cut; export is honest about connector/file limits on ChatGPT.

## 2026-06-19 — Maintenance report-only on open

**Decision:** `tars open` calls `maintenance.mjs --check`; full fold only without `--check`.  
**Why:** "Quiet maintenance" — no surprise writes at launch.

## 2026-06-19 — CI fixture corpus

**Decision:** `tests/fixtures/work-corpus` for indexer perf + demo; `--tools` JSON when MCP unavailable.  
**Why:** Prompt rule 4 — fixture JSON in CI without live Claude.

## 2026-06-19 — Doctor readiness score

**Decision:** 0–100 score from skill version, MAP, index, connectors, bootstrap, work folder.  
**Why:** Single verification command for README claim "install once, run tars doctor."

## 2026-06-19 — Onboarding screens doc

**Decision:** `references/onboarding-screens.md` numbered 1–8 / 9–14 without rewriting full onboarding.md.  
**Why:** Phase 6 deliverable; director script stays in onboarding.md.

## 2026-06-19 — Version bump 1.3.0

**Decision:** Minor bump (not 2.0) — additive CLI and scripts; no breaking installer contract.  
**Why:** SemVer; manifest-driven installers remain compatible.
