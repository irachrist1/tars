# Stages — detailed playbook

The SKILL.md has the spine. This is the depth for each stage, including the interview question bank and the consent script.

## Detect

Goal: know the OS and what the person actually uses, without reading anything private.

- Windows: `pwsh -File scripts/detect/windows-probe.ps1 -Json`. If `pwsh` is absent, fall back to `powershell -ExecutionPolicy Bypass -File ...`.
- macOS: `node scripts/detect/mac-probe.mjs`.
- Pipe to `node scripts/detect/normalize.mjs --pretty` and keep the result for the session.

Consent line before running: *"I'd like to list your installed apps and default browser to figure out what you use. It reads app names only, nothing inside any file, and nothing leaves this machine. OK?"*

Summarize the result in one or two lines. Never paste the raw dump.

## Index — the cheap wow

`node scripts/index/local-index.mjs`. This is the moment that earns trust, so make it land. Translate the JSON into one concrete sentence with real numbers from *their* machine. Then offer, but do not require, a connector-enriched count.

Consent line: *"Want me to scan your Documents, Desktop, and Downloads for the last 30 days? Metadata only — I never open a file, nothing is sent anywhere."*

## Profile

Combine detection archetypes + index signals into a one-paragraph guess. Hold it. The guess is ammunition for the interview, not output.

## Interview — the question bank (cap at 8)

Lead with the inference. Pick only the questions you cannot answer from the data.

Identity confirmations (pick 1–2):
- "You've got {dev tools}. You build software — and from the {Clients/Work} folder, you also consult. Right?"
- "School tenant on your account plus a {course} folder — you're a student?"

Gap-fillers (pick what's missing):
- **Interface:** "Most people just talk to this in their Claude client. Some want a Notion view, technical folks want Obsidian. Which fits you?"
- **Privacy:** "Anything I should keep strictly local and never surface elsewhere? Finances, journal, a specific client?"
- **Naming:** "What do you want to call the vault?"
- **Cadence:** "Do you want a daily brief, or only when you ask?"
- **Tasks:** "I see {task tool}. Should the brain track tasks there, or just in markdown?"

Stop at 8. Fewer is better. If the inference was strong, three may do.

### Needs discovery (2–4, after identity is confirmed)

Identity is who they are; needs is what to build. Detection can't infer intent, so ask.
grill-me style — concrete, slightly pushy, no generic "what are your goals":
- "What breaks for you today that this should fix?"
- "What decision are you trying to make this week?"
- "What do you reach for and can't find?"
- "If this saved you an hour a week, where would that hour come from?"

For an operator/consultant this pass outranks identity confirmation — it defines the value.
Capture answers as a `needs` block in the profile; it drives folder structure, default
behaviors, and capability priority. Example: "I lose track of deadlines across my
businesses" → prioritize a cross-entity deadline view, not a generic notes folder.

## Propose — the consent gate

Show, in chat, in this order, and then wait:
1. The folder tree that will be created.
2. The full generated `CLAUDE.md`.
3. The integration plan: what is connector-backed, what is manual, what is local-only.

Script: *"Here's what I'll create and the operating manual I'll write. Nothing is written until you say go. Want any changes first?"*

Offer concrete edits. Do not write a byte before an explicit yes.

## Scaffold + first-brief

- `node scripts/scaffold/scaffold-vault.mjs --profile <profile.json> --dest "<vault>"` (run `--dry-run` first if the user wants to see the file list without writing).
- Build `profile.json` from the confirmed profile: `user_name`, `identity_summary`, `archetypes`, `interface`, and the `capabilities` block straight from `normalize.mjs`.
- First-brief: fetch last meeting + today + recent threads via the connected tools yourself, pipe JSON to `first-brief.mjs --dest "<vault>"`. If no connector, run with no input.

Close by telling them where the vault is and that they now live in it from their Claude client. Do not linger.

## profile.json shape

```json
{
  "user_name": "Jane Student",
  "identity_summary": "Two-to-four sentences. Synthesized, specific, no fluff.",
  "archetypes": ["developer", "consultant"],
  "interface": "conversation",
  "capabilities": { "...": "the .capabilities object from normalize.mjs" }
}
```
