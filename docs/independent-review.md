# Independent Review: Problem, Verdict, Architecture

Date: 2026-06-10. Author: independent review with fresh eyes, grounded in: the full tars
repo, the live Obsidian vault, shallow clones of OpenClaw and Hermes Agent read at source
level, and the actual tool contracts of the Microsoft 365 Claude connector.

---

## (a) The real problem and the real user

The user is a manager at a professional-services firm. Non-technical. Their entire
working life is Outlook, Teams, Word/Excel/PowerPoint, and OneDrive/SharePoint —
tens of thousands of files accumulated over years, organized in folder structures that
grew organically and encode the firm's real taxonomy (clients, engagements, years).
They manage several clients or entities at once. What "chief of staff" decomposes into,
concretely:

1. **Find** — "where is X, what did we agree with Y about Z" across years of files,
   mail, and meetings.
2. **Synthesize** — status of a matter across email + documents + calendar, with
   sources shown.
3. **Produce** — proposals, letters, reports that read like *their* past proposals,
   letters, and reports.
4. **Prepare** — meeting prep, morning brief, "what needs my attention."
5. **Track** — deadlines, commitments, what has gone quiet.

The two central problems, reframed after reading everything:

**Problem 1 — "knows how their work is done" — is a retrieval-of-precedent problem,
not a profile problem.** The user's history *is* the model of how their work is done.
A stored theory of their style ("writes formally, prefers bullet points") rots and
over-personalizes. The correct mechanism: at task time, fetch the two or three real
artifacts of the same kind and work from those. The only durable memory worth keeping
is small: who they are, their clients, their explicit corrections and boundaries. The
`chief-of-staff` skill in this repo already states this exactly right
(`skills/chief-of-staff/SKILL.md:25` — "The precedent is the ground truth and it
cannot rot").

**Problem 2 — "a lifetime of work without context overload" — is a search problem,
not a context problem.** Nobody loads a lifetime. You need to find the right 3 files
out of 50,000, then read just those. That requires three things: an *orienting map*
(search cannot answer "what should I know about"; only a map can), a *content search*
layer (filenames lie — `Final_v3_REAL.xlsx`), and an *agentic loop* that reformulates
queries and reads just-in-time, citing sources.

**The fact the prior team half-missed:** for a Microsoft 365 user, **the content index
already exists and Microsoft maintains it.** The Claude Microsoft 365 connector's
`sharepoint_search` searches *document content*, filename, and metadata across
SharePoint/OneDrive server-side (verified against the live tool schema: filters for
fileType, folder, author, date range; results carry URIs; `read_resource` returns full
file content, email bodies, calendar events, and Teams meeting transcripts). This is
the same index that powers the firm's own search. The strategy doc
(`docs/research-and-strategy.md` §3) proposes building a crawler + parser + embedding
pipeline over OneDrive — that is rebuilding, on a corporate laptop, a worse copy of an
index Microsoft already runs, at high engineering and IT-trust cost, before any user
value is proven.

### Why the Obsidian vault works, and what transfers

The vault is a genuine existence proof, but of something narrower than the strategy
docs assume. It works because:

1. **The owner authored the structure**, so the folder layout encodes meaning he
   already knows ("routing map" in `CLAUDE.md` works because he wrote it).
2. **The corpus is ~1,000 small, homogeneous markdown files** — trivially greppable;
   a 60-line BM25 script (`related.py`) over titles + first 1,500 chars is adequate
   retrieval.
3. **The owner is the maintainer.** He fixes rot himself, with lint scripts and
   discipline (150-line memory ceiling, session audit, no-duplication rule).
4. **Retrieval is agentic**: a tiny hook surfaces 3 candidates; Claude reads the real
   files just-in-time.

What transfers to a non-technical corporate user: the **small always-loaded kernel**,
the **pointer/index discipline** (caps, single-topic memory files, session audit), and
**agentic just-in-time reading**. What does *not* transfer: authored structure (the
Andersen corpus grew organically over 15 years), homogeneous plain text (office formats
are not greppable), and owner-as-maintainer (the system must maintain itself or be
maintained as a service). The same analysis explains why Claude Code works in large
codebases — plain text + cheap deterministic search + a small CLAUDE.md map + an
agentic loop — and identifies exactly what is missing for an office corpus: **the
equivalent of grep.** That equivalent is Graph search (server-side) or an
extracted-text FTS index (local). It is not, in the first instance, embeddings.

---

## (b) Verdict on the existing direction

The repo contains **three coexisting directions**, in tension with each other. They
deserve different verdicts.

### 1. The chief-of-staff skill (latest commit, "the lean direction") — RIGHT. Keep it.

`skills/chief-of-staff/SKILL.md` + `scripts/map/scan.mjs` is the best thinking in the
repo, and it is recent:

- **Right posture**: "you add exactly three things: you know where everything is, you
  work from the user's real precedents, and you never act recklessly. Everything else
  is Claude being Claude." This is the correct amount of system. Every line of
  instruction beyond this makes the assistant worse.
- **Right context discipline**: three layers — tiny always-loaded MAP.md; two or three
  files per task just-in-time; everything else stays on disk. This *is* the answer to
  Problem 2.
- **Right memory stance**: precedents over stored profiles. This *is* the answer to
  Problem 1.
- **Right safety model**: read/draft/prepare freely; one ask before anything outbound
  or irreversible.
- `scan.mjs` is honest engineering: stat-only, fast at tens of thousands of files,
  splits work correctly ("script handles scale; Claude handles meaning").

Two real gaps: it has **no content-search layer** (a stat-only skeleton cannot answer
"where did we discuss the fee change" when filenames lie), and it **assumes a local
scripting environment** (node) that the target buyer does not have. Both gaps close
with the connector (below).

### 2. The bootstrapper + jarvis — WRONG for this buyer. Park it.

- **Jarvis** (`skills/jarvis/SKILL.md`, 865 lines) is a developer tool built by a
  developer for himself: git config, TickTick, Things 3, Taskwarrior, browser history,
  Daylens, repo scanning. None of this exists on an Andersen manager's laptop. Its
  consent posture also contradicts the bootstrapper's by design (one upfront notice vs
  per-probe consent), and the merge note admits the two memory stores don't connect.
- **The bootstrapper's core premise — transform the machine into a markdown vault the
  user "lives in" — is wrong for this user.** Their documents must stay in
  OneDrive/SharePoint: that's where collaboration, sharing, compliance, retention, and
  their phone all live. A parallel vault of their work is a second system that
  immediately starts rotting, and `client-archive.mjs` already concedes the point with
  its own hard rule: "never move or rename; index and link in place." Follow that rule
  to its conclusion and the vault-as-destination disappears; what remains is a small
  assistant *workspace*, not a transformed corpus.
- Archetype inference, the ≤8-question interview machinery, capability/adapter
  registries, Notion-as-view — this is product machinery for a hypothetical broad
  market, built before the first user. With one named buyer, you ask them; you don't
  infer them from their Start Menu.

**What to salvage**: the memory architecture discipline
(`references/memory-architecture.md` — line-capped kernel, index-not-store, scoped
single-topic memory files, session audit, dedupe-on-write, archive-don't-delete). It is
genuinely good. Apply it to the *assistant's* workspace, never to the user's documents.
Also salvage `client-archive.mjs`'s hot/warm/cold tiering idea and its
ask-don't-guess rule.

### 3. The research-and-strategy doc — RIGHT diagnosis, WRONG prescription.

Its corrections (§0) are correct and earned: the index is the missing layer; delivery
must be zero-terminal; the product is proactive, not reactive scaffolding; the wow must
come from their real files. Its code-grounded claims about prior art are accurate — I
verified them in source:

- OpenClaw's index is real and as described: `files`/`chunks` tables, FTS5, embedding
  cache (`packages/memory-host-sdk/src/host/memory-schema.ts`), hybrid merge with MMR
  and temporal decay (`extensions/memory-core/src/memory/hybrid.ts`).
- Hermes's background self-review fork is real: a daemon thread replaying the
  conversation with a memory/skill tool whitelist (`agent/background_review.py`), and
  the bounded `USER.md`/`MEMORY.md` split (`tools/memory_tool.py`). The review prompts
  are indeed the most stealable artifact.

But the prescription over-reaches in three ways:

1. **It plans to build the wrong index.** OpenClaw's indexer is engineered for its own
   small memory folder and session logs (its two sources are literally `'memory'` and
   `'sessions'` — `manager-sync-ops.ts`), not a 50k-file office corpus, and the doc
   itself flags the full-scan fallback trap. Meanwhile Graph search over the same
   corpus already exists server-side, with content search, filters, and stable URIs
   for citations. Building a local crawl/parse/embed pipeline as *step one* is months
   of work, a privacy/IT review burden ("an app that reads and embeds every client
   file" is a hard sell to a firm's IT), and duplicates infrastructure the customer
   already pays Microsoft for.
2. **It stacks four unproven systems** — Memory Tree, dreaming loop, skill-learning,
   user-model dialectics — on top of the index before a single user question has been
   answered. The convergence argument ("everyone builds this shape") describes where
   mature systems *end up*, not where a two-person product starts.
3. **Its delivery options skip the cheap one.** White-glove vs. build-a-Tauri-app
   misses the middle that exists today: **claude.ai / Claude Desktop + the Microsoft
   365 connector + an uploaded skill** is already a zero-terminal, any-device delivery
   channel — including the user's phone, since the connector is server-side. If a
   local component is ever needed, Claude Desktop's one-click MCP extension bundles
   (.mcpb) deliver it without a terminal. No app build is required to reach this buyer.

---

## (c) Recommended architecture and build plan

### Principles

1. **The corpus stays where it lives.** Never copy, move, or transform the user's
   documents. Index and link in place (the repo already discovered this rule; obey it
   everywhere).
2. **Retrieval = map + search + just-in-time reading + citation.** Never bulk-load.
3. **"How their work is done" = precedents fetched at task time** + a small bounded
   memory of corrections. Never a stored style theory.
4. **The assistant's own state is a small markdown workspace stored *inside*
   OneDrive** ("Chief of Staff" folder): MAP.md, USER.md, per-client briefs, voice
   pointers. This makes the assistant's memory (i) visible, editable, deletable by the
   user — trust through transparency; (ii) synced to every device automatically;
   (iii) reachable through the same connector on mobile.
5. **Safety**: read and draft freely; write only to its own workspace; one explicit
   yes before anything that leaves the machine or can't be undone. (The
   chief-of-staff skill's rule, verbatim — it is correct and sufficient.)

### The four layers

**1. MAP.md (~150–250 lines, always loaded).**
What the operation *is*: clients/entities and their status, active matters, where each
kind of precedent lives, key people, recurring cadence. Built at onboarding by the
agent itself: walk the drive's top 2–3 folder levels via the connector, search recent
activity (`afterDateTime` filters), read a handful of representative files, then play
it back for confirmation. This read-back — "you run these clients, these matters are
live, this deadline is next Thursday" — is the felt-known onboarding moment the
strategy doc wants, achieved with zero crawler. Refreshed on a schedule or when the
agent notices staleness. On a machine where local execution exists (white-glove,
Cowork), `scan.mjs` accelerates this; it is an optimization, not a dependency.

**2. Search (the grep-equivalent).**
Primary: connector search — `sharepoint_search` (content + filename + metadata, file
type / folder / author / date filters), `outlook_email_search`, calendar, Teams
messages, meeting transcripts. The agent runs an agentic loop: several reformulated
queries, narrow with filters, open the top candidates with `read_resource`, answer
with the source URI cited. Claude's query reformulation compensates for lexical
search's phrasing gaps — the same reason grep suffices in Claude Code.
Fallback (Phase 2, only if recall measurably fails or local-only files matter): a
local extracted-text index — SQLite FTS5 over text extracted from docx/pdf/xlsx,
OpenClaw's `files`/`chunks` schema as the reference, shipped as a one-click MCP
desktop extension. Embeddings only if lexical + agentic loop provably fails on real
queries; that is a measurement, not an assumption.

**3. Memory (small, bounded, correctable).**
- `USER.md` (~100 lines, Hermes pattern): role, clients, stated priorities, explicit
  corrections and boundaries. Loaded every session as a frozen snapshot.
- Per-client briefs (one page each): living status notes the agent maintains —
  open items, deadlines, last contact, where the key documents are.
- Session audit on wrap-up (the vault's proven habit + Hermes's review prompts):
  capture corrections and new durable facts; dedupe on write; archive past ceilings,
  never delete.
- Rule: never store what can be derived from the corpus. Store only corrections,
  preferences, and pointers. This is the over-personalization guard: facts about the
  world are looked up fresh; only the user's *explicit* guidance persists.

**4. Voice (pointers, not profiles).**
A short list of exemplar documents per artifact type (their 3 best proposals, letters,
reports — chosen with the user at onboarding). At draft time, fetch and imitate.

### Delivery and onboarding (zero terminal)

1. **Org admin enables the Microsoft 365 connector** (one-time consent). This is the
   real setup gate and is IT-shaped, not user-shaped — for Andersen, the white-glove
   engagement handles it.
2. User opens claude.ai or Claude Desktop; the Chief of Staff skill is already
   available (uploaded once at org level). They say "set yourself up."
3. The agent builds the map (above), plays back what it sees, asks 3–4 plain-language
   questions (the skill's "job interview" framing is right: where is your work kept,
   how do you like things written, what matters most, what should I never do
   unasked).
4. With consent, it writes MAP.md / USER.md / client briefs into the "Chief of Staff"
   OneDrive folder.
5. It proves value in the same sitting: answers one real question with a citation and
   preps the next calendar meeting.

### Build plan

- **Phase 1 (1–2 weeks, white-glove with James):** rewrite `chief-of-staff/SKILL.md`
  to be connector-first (drop the node-script dependency from the critical path), run
  the onboarding above on his real account, measure (see (e)). No new infrastructure.
  This is also the Andersen revenue path the product-overview already identified.
- **Phase 2 (only as measurements demand):** local FTS extension for local-only files
  or recall gaps; scheduled morning brief (Claude scheduled runs where available;
  white-glove operator otherwise); hot/warm/cold archive tiering for the deep
  pre-2-year store.
- **Phase 3:** multi-seat rollout (per-user workspace, same skill), shared firm-level
  knowledge (a SharePoint "firm precedents" library the same search already covers),
  and only then the question of a packaged product for other firms.

---

## (d) What I would deliberately NOT build

1. **A custom OneDrive crawler / embedding pipeline (v1).** Duplicates Microsoft's
   server-side index; months of work; an IT-trust nightmare; the strategy doc's own
   cited trap (full-scan fallback) bites at exactly this scale. Revisit only with
   recall measurements in hand.
2. **A desktop app (Tauri or otherwise).** The delivery channel exists: claude.ai /
   Claude Desktop + connector + skill, with .mcpb extensions if a local component is
   ever justified. An app is a year of shell-building before the first unit of value.
3. **Vault transformation of the user's documents.** Their corpus stays in OneDrive.
   The markdown vault as *destination for their work* is the wrong premise for this
   buyer; markdown is for the assistant's own small state only.
4. **Jarvis machine-scanning** (git, task managers, browser history, activity
   trackers). Wrong persona entirely. Park the skill; harvest nothing from it but the
   diff-on-update pattern.
5. **Archetype inference + interview machinery + capability/adapter registries.**
   One named buyer: ask them. Generalize after the third paying user, from evidence.
6. **Memory Tree, dreaming loop, skill-learning loop.** Mature-system features.
   The bounded USER.md + session audit covers the need until usage proves otherwise.
7. **Notion views / multi-interface options.** One interface: the Claude client.
8. **Custom OAuth / Azure app registration.** The connector covers it; keep the doc
   as the documented edge case it already is.

Each of these is cut for the same reason: it spends build effort ahead of evidence,
on a layer the platform or the corpus already provides.

---

## (e) Open questions and what to test first

1. **Graph search recall on the real corpus — the load-bearing bet.** Week 1, with
   James: collect 20 real questions he'd actually ask ("what did we quote X last
   year," "where's the signed engagement letter for Y"). Measure: % answered with a
   correct citation. This single number decides whether Phase 2's local index moves
   forward. If the connector is blocked by Andersen IT, the same test runs against
   the local synced OneDrive folder with the FTS extension — the architecture
   survives, the phasing flips.
2. **Connector availability and consent at Andersen.** IT/admin question, not
   engineering. Resolve before writing more code.
3. **Spreadsheet reasoning.** A large share of professional-services work is xlsx.
   Test `read_resource` on his real (large) workbooks: token cost, fidelity, whether
   summaries suffice.
4. **MAP.md size at his scale.** How many areas/clients does a 15-year corpus
   collapse into? If the map can't stay under ~250 lines, it needs a two-level map
   (MAP.md → per-area maps), which the memory-architecture pattern already supports.
5. **Voice from precedents alone.** Draft 3 artifacts against his chosen exemplars;
   he grades them blind against his own drafts. If they fail, the fix is better
   exemplar selection before it is ever a "voice profile."
6. **Proactive delivery.** Can a scheduled morning brief reach a non-technical user
   on claude.ai today without an operator in the loop? If not, the brief is
   white-glove-delivered until the platform catches up — acceptable for one firm,
   not for the product.
7. **Workspace-in-OneDrive feedback loop.** The assistant's own notes become
   search-visible to itself (and to firm IT). Probably fine — it is work product —
   but verify it doesn't pollute retrieval (exclude the workspace folder from
   evidence searches) and that the user is comfortable with its visibility.

---

## Addendum (2026-06-10): accepted, with two refinements — now built

The recommendation was accepted and Phase 1 built (`skills/chief-of-staff/SKILL.md`,
rewritten connector-first), with two refinements from Christian:

1. **Quiet self-maintenance.** The workspace updates itself (session-audit into
   MAP/USER/client briefs, dated `LOG.md` lines) and the user is told in one passing
   line — never a ceremony. Hermes's restraint lessons are encoded directly: capture
   only explicit corrections and world-changes, never style theories or transient
   states, prefer editing an existing file over creating one, archive never delete.
   The skill states the why: Claude's own tuning covers the rest; every extra rule
   makes the assistant worse.
2. **Connect, look, then ask.** Per-client briefs are the join point tying folders,
   documents, meetings, and threads together. When something can't be confidently
   placed, the order is fixed: search first (asking what you could have found loses
   trust), ask once plainly if search can't settle it, record the answer so it is
   never asked again, and never invent a pattern silently.

## One-paragraph summary

The lean chief-of-staff direction in the latest commit is right and should be the
product; the bootstrapper/jarvis vault-transformation machinery is built for the wrong
persona and should be parked; the strategy doc's diagnosis (index, delivery,
proactivity) is right but its prescription — build a crawler, embeddings, Memory Tree,
dreaming, and an app — rebuilds infrastructure that Microsoft and the Claude platform
already provide to this exact buyer. Ship the chief-of-staff skill connector-first on
claude.ai/Claude Desktop: a small agent-built MAP.md, Graph search as the
grep-equivalent, just-in-time reading with citations, precedent-driven drafting, a
bounded USER.md, and an assistant workspace living inside OneDrive. White-glove it
with James in week one, measure recall on 20 real questions, and let those
measurements — not architecture convergence arguments — decide what gets built next.
