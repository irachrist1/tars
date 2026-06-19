# TARS — Ship to Advertised Product

**Repo:** `github.com/irachrist1/tars`  
**Reference this file:** `docs/autonomous-ship-prompt.md`

## Mission

Turn TARS from v1.2.0 (Claude skill + installers) into a **fully shipped product that delivers every promise in README, landing page, and SKILL.md** — no hand-waving, no “coming soon,” no terminal expertise required.

**North star:** A professional installs once; their AI knows their operation (files, mail, calendar, meetings, trackers) and can prep a real meeting with citations in under a minute. Nothing copied off their machine. No stale skill versions.

**Brand line to defend:** *Give your AI the context it needs to deliver.*

---

## Repository context

**Exists today:**
- `skills/chief-of-staff/` — SKILL.md, onboarding, workspace shapes, investigation discipline, handoff, publishing
- `scripts/indexer.mjs` — BM25 local file index (`.tars-index`)
- `scripts/scan.mjs`, `scripts/connectors.mjs`
- `bin/install.mjs` — npx + global `tars` (`open`, `install`, `use`, `help`)
- `install.sh`, `Install-Tars.ps1`, `scripts/package.mjs` → `dist/chief-of-staff.zip`

**Read first (law):**
- `README.md`
- `skills/chief-of-staff/SKILL.md`
- `skills/chief-of-staff/references/onboarding.md`
- `skills/chief-of-staff/references/handoff.md`
- `PUBLISHING.md`
- `docs/product-overview.md`
- `docs/data-safety.md`
- `CHANGELOG.md`

**Non-negotiable:**
- Pointers only — never copy user corpus into workspace
- Connector-first — no TARS-held tokens
- Substrate = markdown in user's work storage (`Chief of Staff/`)
- Consent-gated probes; ask before risky actions
- No telemetry; indexer/scan stay local unless user opts in
- ChatGPT: ship it or remove every “coming” claim

---

## Gap: advertise vs ship

| Promise | Today | Deliverable |
|---|---|---|
| Indexes files, email, calendar, tools | Files via BM25; mail/calendar only via connectors + agent discipline | Unified context layer: file index + connector metadata cache + optional mail/calendar snapshot |
| Reads work first — explain nothing | Needs Claude onboarding after install | Auto first-run: detect folder, build index, probe connectors, seed workspace before Claude opens |
| Prep for 3pm call | Works if map + connectors + skilled agent | Scripted proof workflow; onboarding ends with real meeting prep + citations |
| Spots patterns across proposal/meeting/email | SKILL instructions only | Entity linker: client graph (folder ↔ meetings ↔ threads ↔ Linear) |
| Drafts the way you do | Precedent-pulling in SKILL | `scripts/precedents.mjs` — last N similar docs by client + type |
| Stays current without ceremony | Session-end agent behavior | `scripts/maintenance.mjs` + optional watcher; `indexer update` on `tars open` |
| Cowork without setup | Manual zip upload | `tars publish` — zip, clipboard, guided steps, docs with screenshots |
| Grows with you | No daemon | Optional lightweight watcher → incremental index (`tars watch` or `tarsd`) |
| Works with tools you already use | Claude only | Ship ChatGPT export **or** cut all ChatGPT copy |
| `tars` anywhere | Shipped; open doesn't auto-update | Auto-refresh stale skill on `tars open` |
| Top-tier npm | Good installers; not on skills.sh | Register `npx skills add irachrist1/tars` |
| Windows + M365 rollout | `windows-probe.ps1` unverified | Windows CI, nested OneDrive, verification doc |
| Duolingo onboarding | Designed only | Ship installer screens 1–8 + in-Claude screens 9–14 |

---

## Done definition

Non-technical user on **Windows or macOS** with **Microsoft 365**:

1. One command (`tars` or curl installer)
2. ≤8 installer taps + ≤6 in-Claude screens
3. No zip or JSON config
4. *"Prep me for my next meeting"* → brief with citations from real sources
5. `tars` next day → latest version, workspace updated

**Acceptance demo:**
```sh
tars install --yes
tars open
# First session: MAP.md exists, CONNECTORS.md current, .tars-index built
# User: "prep me for the 3pm call with ACME"
# Response cites ≥2 real sources (file, mail, or meeting)
```

---

## Phases

### Phase 0 — Audit
- Clean install; run everything
- Write `docs/shipping-audit.md`: every README bullet → mechanism → status → file
- Every "coming soon" / TODO / unverified → shipped or deleted from copy

### Phase 1 — `tars` fast path
In `bin/install.mjs`:
- `tars open`: version check → update if stale → `indexer update` if index exists → launch (setup vs continue)
- `tars doctor` — connectors, index, workspace, skill version, fixes
- `tars index build|update|query` — wrapper over indexer
- `tars status` — one-screen health
- Shell tests in `tests/cli/`

### Phase 2 — Automatic first-run
Before Claude opens:
- Detect work folder (macOS CloudStorage, Windows nested OneDrive)
- `scan.mjs` + `indexer build` with progress
- `connectors.mjs` → seed CONNECTORS.md
- Write `onboarding-seed.md` + `workspace-bootstrap.json`
- Onboarding adopts bootstrap; don't re-ask detected facts

### Phase 3 — Context engine
Ship `scripts/context-engine.mjs`:
```
question → entity extract → MAP/Clients lookup → connector route
         → local index query → merged ranked JSON → Claude cites sources
```
Invent as needed: connector cache under `.tars-index/connectors/`, entity graph, precedent finder. Cross-platform without Spotlight.

### Phase 4 — Quiet maintenance
- `scripts/maintenance.mjs` — diff session vs workspace, one-line updates, LOG.md, caps → ARCHIVE
- `tars watch --once` for power users
- `tars open` runs `maintenance --check` (report only)

### Phase 5 — Cowork / cloud
- `tars publish` — zip, clipboard, platform instructions, `docs/cowork-publish/`
- Onboarding Phase 4 blocks complete until upload confirmed or Code-only mode
- Experimental automation gated behind `--experimental`

### Phase 6 — Duolingo onboarding
- Installer screens 1–8: name, work, folder, meetings, surfaces, boundaries, handoff
- In-Claude screens 9–14: silent read → read-back → 3 picks → proof → streak → publish
- `references/onboarding-screens.md` — one question per screen, numbered choices, progress `3/8`

### Phase 7 — Distribution
- skills.sh registration
- GitHub Actions: ubuntu, macos, windows; package + CLI tests
- Release automation; README only claims `tars doctor` can verify

### Phase 8 — Windows
- Verify `Install-Tars.ps1` on Windows runner
- `docs/windows-verification.md`

### Phase 9 — ChatGPT
Ship `tars export --chatgpt` **or** remove all ChatGPT strings. No half-measures.

### Phase 10 — Copy sync
- `docs/index.html` matches reality
- README bullets link to mechanisms
- CHANGELOG for v1.3.0 or v2.0.0

---

## Allowed inventions

- New scripts under `skills/chief-of-staff/scripts/` or `scripts/`
- Optional local daemon (fs.watch + debounced indexer)
- SQLite FTS alongside BM25 if measurably better
- Workspace templates per archetype
- `tars demo` with fixture corpus
- `tars doctor` readiness score 0–100
- skills.sh metadata, multi-agent install

**Not allowed:** telemetry, storing user content in repo/cloud, copying corpus to workspace, secrets in repo, README claims without tests.

---

## Quality bar

- [ ] `npm run package` clean; MANIFEST matches tree
- [ ] Tests pass on Linux, macOS, Windows CI
- [ ] Fresh install → `tars doctor` green on fixture env
- [ ] `tars open --no-launch` from `/tmp`
- [ ] Stale skill auto-updates on `tars open`
- [ ] `indexer query` <100ms on fixture corpus
- [ ] Onboarding <15 min scripted
- [ ] Every README bullet proven in `docs/shipping-audit.md`
- [ ] No "coming soon" in user-facing strings
- [ ] Version bump + tagged release ready

---

## Git rules

- Branch: `cursor/ship-advertised-product-01b1`
- Small commits; push frequently; draft PR early
- Maintain `docs/decision-log.md` for each invention
- Release: notes + `dist/chief-of-staff.zip` on GitHub release

---

## Operating mode

1. Ship over spec
2. Test as non-technical user
3. API limits → best UX workaround + one honest doc note
4. Missing MCP in CI → fixture JSON via `--tools`
5. Loop: implement → test → fix → audit → commit → push
6. Don't ask user unless impossible; document assumptions
7. End with: demo commands, `tars doctor` output, PR link, proven README claims

---

## Success

> TARS is shipped. Install once, run `tars`, AI knows the operation — indexed files, connected tools, living map, real meeting prep with citations. Nothing copied. Nothing hidden. No stale versions. Every README line is true.

Start Phase 0. Don't stop until success is defensible.
