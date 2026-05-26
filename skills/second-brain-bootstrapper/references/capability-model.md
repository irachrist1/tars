# Capability Model

TARS reasons about **capabilities**, never about specific apps. Apps come and go. The capability a person needs (somewhere to put notes, a way to see their calendar) is stable. This indirection is what lets one skill serve a student on Apple Notes and a consultant on Microsoft 365 without branching logic everywhere.

## The seven (plus two) capabilities

| Capability | The need it covers |
|---|---|
| `notes` | a place to write and keep thinking |
| `tasks` | what needs doing |
| `calendar` | what's scheduled |
| `meeting-notes` | what was said and decided |
| `email` | inbound/outbound correspondence |
| `read-later` | saved articles and links |
| `behavior-data` | how time/attention is actually spent |
| `files` | documents on disk / in the cloud |
| `code` | developer signal (drives archetype, not a brain surface) |

## Three adapter tiers

Every capability resolves to the best tier an installed provider affords:

1. **connector** — a first-class Claude connector exists (Microsoft 365, Google, Granola, Notion). Preferred. No tokens, no OAuth code, the user clicks Connect once in their Claude client.
2. **local** — on-device access: markdown files (Obsidian), a local DB (ActivityWatch), AppleScript (Apple Mail/Calendar), a synced folder (Dropbox).
3. **manual** — no connector and no clean local hook. The user pastes content, or a tiny script reads an API with a token kept **outside** the vault (Raindrop, TickTick, Todoist).

The rule: **connector > local > manual**. `normalize.mjs` picks the highest tier available per capability.

## Zero-integration guarantee

If nothing resolves above `manual`, the brain still ships. `notes` is satisfied by plain markdown the moment the vault is scaffolded. Everything else degrades to "paste it in." A working second brain must never require an integration.

## App → capability mapping

Lives in `config/app-registry.json` as data, not code. Each entry maps a name/regex to a capability, a tier, and an optional `interface: true` (the app could also be the user's chosen view) and `signal` (e.g. `developer`). Extend the JSON to support a new app; no code change.

## Archetype inference

Capabilities present → weighted archetype scores (`archetypeSignals` in the registry):

| Archetype | Strong signals |
|---|---|
| developer | `code` (VS Code, git, JetBrains, Cursor) |
| consultant | `calendar` + `meeting-notes` + `email`, work tenant, a Clients folder |
| operator | `tasks` + `calendar` + `email` |
| writer | `notes` + `read-later`, a Writing folder |
| researcher | `read-later` + `notes`, PDFs, a reference manager |
| student | school tenant/domain, course folders, `notes` |

Most people are a blend. The top two or three scores become the profile, which then drives the scaffolded folder set and routing rules. Tenant hints (`onedrive-commercial` vs `onedrive-consumer`, an email domain) sharpen student vs consultant during the interview.
