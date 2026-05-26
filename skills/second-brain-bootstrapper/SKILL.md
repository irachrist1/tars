---
name: second-brain-bootstrapper
description: Turn a blank or messy machine into an organized, maintainable markdown second brain. Use when a user wants to set up a personal knowledge/AI system, "build me a second brain", bootstrap a notes/vault system, organize their files and tools into one place, or onboard onto a Claude-based personal operating system. Inspects the machine, infers who the user is, indexes what they already have, confirms with a few sharp questions, then scaffolds a personalized vault + CLAUDE.md + memory system. Works connector-first (Microsoft 365 / Google / Granola via the user's existing Claude connectors) and produces a working result even with zero integrations.
---

# Second Brain Bootstrapper (TARS)

Transform a machine into an organized second brain. The output is a markdown vault plus a maintainable operating manual the user runs from their existing Claude client. Not an app.

**Operating principles (do not violate):**
- **On-device + consent.** Every probe and every write is announced and run only on a yes. Consent for one step is not consent for the next.
- **Connectors over credentials.** Use the user's connected Claude tools for email/calendar/files/meetings. Never build OAuth or store tokens during a normal run.
- **Lead with the cheap wow.** Run the local index before asking for any integration.
- **Infer, then confirm.** Never ask cold. Use what the machine shows to make onboarding questions specific confirmations.
- **Capabilities, not tools.** Reason in terms of notes / tasks / calendar / meeting-notes / email / read-later / behavior-data. See `references/capability-model.md`.

Run these stages in order. Keep narration short. Show, don't explain.

## 1. Detect

Identify OS, then enumerate installed apps and the default browser/mail client to learn what the user actually uses. One entrypoint handles both platforms and never writes anything:

```
node scripts/detect/detect.mjs           # human capability map (safe dry-run)
node scripts/detect/detect.mjs --json     # normalized JSON for your own reasoning
```

It runs `windows-probe.ps1` on Windows or `mac-probe.mjs` on macOS, pipes through `normalize.mjs`, and prints the capability map + archetype scores. Hold the `--json` result for this session. Do not print the raw dump; summarize.

For a capability that resolves to no connector, no local hook, and no API (a native app with no integration at all), do not pretend it's missing — note that **Claude Cowork** can drive that app directly on the desktop. See `references/capability-model.md`.

## 2. Index — the cheap wow

Run the local file index. This needs no integration and proves value immediately.

```
node scripts/index/local-index.mjs            # human summary
node scripts/index/local-index.mjs --json     # for your own reasoning
```

Turn the output into one punchy line: *"Last 30 days on this machine: N active projects, N meeting notes, N deadline-flavored files, N files I can organize."* This is metadata only. Say so.

If a connector is present (Microsoft 365 / Google / Granola), offer to enrich the index with a 30-day count of meetings and threads via that connector. If none is connected, continue. **Never** block on an integration.

**Operator / client-archive path.** If detection or the user shows deep client/entity folders (a CPA, consultant, or multi-business operator with years of files), run the archive indexer instead of guessing from a flat scan:

```
node scripts/index/client-archive.mjs --root "<their Clients folder>"            # metadata tiers
node scripts/index/client-archive.mjs --root "<...>" --read-active --max-read 40 # + content from active set (consent first)
```

It tiers every client into hot/warm/cold by recency, links to originals **in place** (never moves/copies), and flags oversized folders to scope. When a client is too large to reason about, ask the user to scope (active vs full archive) — don't guess. Filenames lie; use `--read-active` (with explicit consent) to sample the live set's real content.

## 3. Profile — infer identity

From detection + index, infer the archetype(s): student, consultant, developer, writer, researcher, operator. Most people are a blend. Read `references/capability-model.md` for the signal→archetype mapping. Draft a one-paragraph identity guess. Do not show it yet — it feeds the interview.

## 4. Interview — confirm + gap-fill (≤ 8 questions)

Lead with the inference. Questions are sharp confirmations, not generic prompts. Examples:
- "You've got VS Code, git, and an Outlook default. You build, and you live in Microsoft 365 — right?"
- "I see an active 'Clients' folder and weekly meeting notes. You consult on the side?"

Only ask what you genuinely cannot infer (interface preference, what to keep private, naming). Cap at 8. See `references/stages.md` for the question bank.

**Then a short needs-discovery pass (2-4 questions, grill-me style).** Identity tells you who they are; this tells you what to build. Detection cannot infer intent — ask it. Keep it sharp and concrete, not generic:
- "What breaks for you today that this should fix?"
- "What decision are you trying to make this week?"
- "What do you reach for and can't find?"

Capture the answers as a `needs` block in the profile. It shapes folder structure, default behaviors, and which capabilities to prioritize (e.g. an operator who says "I lose track of deadlines across my businesses" gets a cross-entity deadline view prioritized, not a generic notes folder). For an operator/consultant this pass matters more than identity — it's where the real value is defined.

## 5. Propose — the consent gate

Show, in chat, before writing anything:
1. The proposed vault folder structure.
2. The generated `CLAUDE.md` (filled from templates + profile), in full.
3. The capability/integration plan (what's connector-backed, what's manual).

Wait for an explicit yes. Offer edits. Nothing is written before approval.

## 6. Scaffold + first-brief

On approval:
```
node scripts/scaffold/scaffold-vault.mjs --profile <profile.json> --dest "<vault path>"
```
This writes the vault skeleton, the parameterized `CLAUDE.md` (~300-line ceiling, a pointer not a dump), `MEMORY.md` (~150-line index), the `memory/*.md` scoped files, and `00_System/` routing/identity. See `references/memory-architecture.md` for the split rules and ceilings.

Then prove it live, in under 60 seconds. A Node script cannot reach the user's connectors, so **you** do the fetch: call the connected Microsoft 365 / Granola / Google tools for the last meeting, today's calendar, and recent threads, assemble a small JSON, and pipe it to the formatter, which renders and files the brief:
```
echo '<brief.json>' | node scripts/scaffold/first-brief.mjs --dest "<vault path>"
```
If no connector is present, run it with no input. It produces a valid brief that tells the user how to connect one. The brain still works.

Close by telling the user where the vault is and how to live in it: open the Claude client, point it at the vault, talk to it. Done.

## Maintainability (what gets generated, why it lasts)

The generated system is engineered to not rot:
- `CLAUDE.md` holds prescriptive always/never rules + routing, capped at ~300 lines.
- `MEMORY.md` is a ~150-line index pointing to single-topic `memory/*.md` files (frontmatter: name, description, type), loaded only when relevant.
- Changing facts live in memory files; rules live in `CLAUDE.md`; never duplicated.
- A session-audit behavior files new rules/facts silently and archives past the ceiling.

Full rationale and the templates: `references/memory-architecture.md`.
