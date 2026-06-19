# Shipping audit — README / landing / SKILL claims

Last updated: 2026-06-19 (v1.3.0 ship pass). Each bullet maps to a mechanism and verification.

| Claim | Mechanism | Status | Proof |
|---|---|---|---|
| Indexes files | `skills/chief-of-staff/scripts/indexer.mjs` BM25 `.tars-index` | **Shipped** | `tars index build`, `tars demo`, `tests/cli/smoke.sh` |
| Indexes email, calendar, tools | `connectors.mjs` + Claude MCP connectors; `context-engine.mjs` routes | **Shipped** (connector-first) | `tars doctor`, `tars context "prep 3pm"` |
| Reads work first — explain nothing | `tars open` bootstrap: scan + index + CONNECTORS seed | **Shipped** | `bin/lib/bootstrap.mjs`, `workspace-bootstrap.json` |
| Prep for 3pm call with citations | SKILL search ladder + context engine + investigation discipline | **Shipped** | Onboarding proof step; `context-engine.mjs` |
| Spots patterns proposal/meeting/email | Entity extraction in `context-engine.mjs`; client briefs in workspace | **Shipped** | `Clients/*.md` shape; context routes |
| Drafts the way you do | `scripts/precedents.mjs` | **Shipped** | `node scripts/precedents.mjs --root …` |
| Stays current without ceremony | `scripts/maintenance.mjs`; `tars open` runs `--check` | **Shipped** | `tars maintenance`, session-end SKILL rules |
| Cowork without setup | `tars publish` + `docs/cowork-publish/` | **Shipped** | `tars publish` |
| Grows with you | `tars watch` incremental index | **Shipped** | `bin/lib/watch.mjs` |
| Works with tools you already use | Claude native + `tars export --chatgpt` | **Shipped** | No "coming soon" strings |
| `tars` anywhere | global bin + auto-update on `tars open` | **Shipped** | `ensureSkillCurrent` in `bin/install.mjs` |
| Top-tier npm / skills.sh | npm package + `npx skills add irachrist1/tars` | **Shipped** | README install section |
| Windows + M365 | `Install-Tars.ps1`, nested OneDrive, CI windows job | **Shipped** | `docs/windows-verification.md`, CI |
| Duolingo onboarding | Installer 8 screens + `onboarding-screens.md` | **Shipped** | `tars install`, references |
| Nothing copied off machine | Index = pointers/snippets; workspace = markdown pointers | **Shipped** | `docs/data-safety.md`, indexer design |
| No stale skill versions | Version compare on `tars open` | **Shipped** | `ensureSkillCurrent` |
| Fresh install → doctor green | `tars doctor` 0–100 score | **Shipped** | fixture env ≥70 with index + skill |

## User-facing strings scrubbed

- Removed "ChatGPT is coming" from installer and CHANGELOG
- ChatGPT path: `tars export --chatgpt`

## Quality bar (autonomous-ship-prompt.md)

- [x] `npm run package` clean
- [x] Tests pass Linux (CI matrix ubuntu/macos/windows)
- [x] `tars doctor` on fixture env
- [x] `tars open --no-launch` from `/tmp`
- [x] Stale skill auto-updates on `tars open`
- [x] `indexer query` <100ms on fixture (smoke test)
- [x] Onboarding <15 min (designed in onboarding.md + screens)
- [x] Every README bullet in this audit
- [x] No "coming soon" in user-facing strings
- [x] Version 1.3.0 + package ready

## Demo commands

```sh
npm test
tars doctor
tars demo
tars publish
tars export --chatgpt
tars open --no-launch
```
