# Phase 0 — End-to-End Walkthrough

The target: from a cold machine to a working second brain plus a real brief, in one sitting, proving one stack end to end before generalizing.

## The stack proven in Phase 0

- **OS:** Windows first (macOS adapter validated in parallel).
- **Integrations:** Claude connectors (Microsoft 365 / Granola / Google). No raw OAuth.
- **Interface:** conversation in the user's Claude client.
- **Store:** plain markdown vault.

## The run

1. **Detect.** `windows-probe.ps1` (or `mac-probe.mjs`) → `normalize.mjs`. Output: capability map + archetype scores. *Consented.*
2. **Index — the wow.** `local-index.mjs` prints real numbers from the user's last 30 days. *Consented, metadata only.*
3. **Profile.** Infer archetype(s) from detection + index. Held internally.
4. **Interview.** ≤ 8 sharp confirmations. Fill only genuine gaps (interface, privacy, naming).
5. **Propose.** Show the folder tree + full generated `CLAUDE.md` + integration plan. *Wait for explicit yes.*
6. **Scaffold.** `scaffold-vault.mjs` writes the vault, the parameterized `CLAUDE.md` (≤300 lines), `MEMORY.md` (≤150), the `memory/*.md` files, and `00_System/`.
7. **First brief.** Fetch last meeting + today + recent threads via the connector, pipe to `first-brief.mjs`, file it. Under 60 seconds.

## Done means

- A vault exists at the chosen path with a working operating manual.
- The brain answers questions from markdown today, and from connected tools when present.
- The user closes the laptop and lives in their Claude client. Nothing to stare at.

## What is verified today

- `local-index.mjs` — runs on macOS, real signal. ✓
- `mac-probe.mjs` + `normalize.mjs` — runs on macOS, correct capability + archetype inference. ✓
- `scaffold-vault.mjs` — renders a complete vault end to end; `CLAUDE.md` at 89 lines. ✓
- `first-brief.mjs` — formats and files a brief from connector JSON. ✓
- `windows-probe.ps1` — written to the shared contract; **needs a Windows box to validate**.

## What Phase 1+ adds

- Validate `windows-probe.ps1` on real Windows; expand registry coverage.
- More connector adapters surfaced in the interview (Notion view, Todoist).
- Plain-markdown-only fallback path hardened and documented.
- Pluggable adapter interface so a new capability provider is a registry entry plus, at most, one small fetch helper.
