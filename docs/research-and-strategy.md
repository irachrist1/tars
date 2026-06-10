# TARS — Research & Strategy: The Index, the Agent, the Onboarding

Date: 2026-06-10. Status: strategy, supersedes the "kill the indexer" framing in earlier notes.

This is the step-back. It corrects how we were building, grounds the direction in what Apple, OpenAI, OpenHuman, OpenClaw, and Hermes are actually doing, and sets the architecture around the one thing that makes this work: the index.

---

## 0. Corrections to how we were building

Four things we had wrong, named plainly:

1. **The index was a file-count. Wrong.** The index is not a one-time tally of "46 files, 8 code files." The index is the product. It is a persistent map of where everything lives, so that when you ask a question the system knows exactly where to look.
2. **Delivery was a terminal clone + `claude` CLI. Wrong for the real user.** The buyer is non-technical corporate staff. They will never `git clone`. Onboarding has to be a beautiful, zero-terminal experience.
3. **The system was reactive scaffolding.** It set up folders and waited. The product is a proactive chief-of-staff that does things: retrieves and creates files, builds dashboards, drafts, surfaces what's due, goes and gets things done.
4. **The "wow" was generic.** A profile guessed from app names is not a wow. The wow is: it read their OneDrive and already knows them. The interview options should feel personalized, drawn from what it actually found, not boilerplate.

## 1. Who this is really for

Corporate staff at a firm like Andersen. Non-technical. They live in **OneDrive and Microsoft 365**. OneDrive is where everything is. They will set this up themselves or have it set up for them, and either way it must feel effortless. No terminals, no config files, no jargon.

The implication that drives everything below: **OneDrive is the primary index target.** We actively crawl and understand those documents, spot patterns, and surface them back in a way that makes the user feel known.

## 2. What everyone else is doing, and what we take

| System | The core idea | What we steal |
|---|---|---|
| **Apple (WWDC 2026 search rebuild)** | Apple rebuilt the **system search index** behind Spotlight, Mail, and Photos. It now indexes **all content on the device, old and new, continuously and almost immediately as it is captured**, and auto-reindexes after the OS update. | A device-wide index that is **always current**, not a one-time scan. This is the indexer you meant: it goes through everything and always knows where it is, so finding is instant. |
| **OpenAI (Company Knowledge)** | Searches across connected org apps (Drive, Slack, GitHub, O365) and answers **with citations back to the source**, so you can verify. Framed as "make decisions, take action, get things done." MCP connectors with search/fetch. | **Citations to source** are how you earn trust. The "get things done" framing is the chief-of-staff posture. The search/fetch connector contract. |
| **OpenHuman** (GPL-3.0, forkable) | Downloads connected sources, converts to Markdown, chunks (~3k tokens), indexes into a hierarchical **Memory Tree**: thematic nodes (work, finance, clients) → entities (people, companies, accounts) → raw documents. Relationships explicit, so cross-source queries work. Ships as a native Tauri desktop app. | The **Memory Tree** is the shape of your "index that knows where everything is." It also proves the **downloadable-app** delivery model for non-technical users. Near-reference architecture. |
| **OpenClaw** (Steinberger, ~345k stars) | **Markdown files as the source of truth**, plus a `memory.sqlite` using `sqlite-vec` for vector embeddings = hybrid semantic + keyword search. Transparent, human-readable, version-controllable. Auto-compaction with a "memory flush" that promotes durable facts into markdown before trimming context. | The **index implementation**: markdown source of truth + `sqlite-vec`/FTS5 over chunked content. This is the missing layer in TARS, and it keeps our markdown thesis intact. |
| **Hermes** (Nous, MIT) | Closed-loop **skill learning**: distills reusable skills after each task. Three-layer memory. **Dialectic user modeling** (Honcho) builds a deepening model of who you are across sessions. | The "it actually knows me" feeling = user modeling + skills that improve. MIT license is the most fork-friendly. |

**The convergence is the headline.** Five independent serious efforts, one shape:

> Markdown as the source of truth, a semantic index over it, a hierarchical pointer tree, a proactive agent that acts and cites its sources.

We are already right on markdown. Our gaps are the **index**, the **agent loop**, and the **delivery**. That is the whole to-do list.

## 2b. Code-grounded findings (real repo clones, 2026-06-10)

We cloned and read the actual source of OpenClaw and Hermes. Both are real and MIT-licensed. This is the implementable blueprint, not a summary.

### OpenClaw (`github.com/openclaw/openclaw`, MIT) — the index blueprint

TypeScript, `node:sqlite`. Markdown is the source of truth; SQLite is a rebuildable derivative.

- **Schema:** `chunks(id, path, start_line, end_line, text, embedding TEXT, model, hash, ...)` is the row-of-record, with the embedding stored as JSON text so a no-`sqlite-vec` fallback works. Two pure index tables sit over it: `chunks_vec` (sqlite-vec `vec0`, `FLOAT[dims]`, KNN) and `chunks_fts` (FTS5). Plus `embedding_cache` (content-hash keyed) and `meta` (index identity).
- **Change detection:** a `files(path, hash, mtime, size)` table plus a file watcher re-chunks only changed files. Incremental and continuous, the same model as Apple's.
- **Chunking:** ~400 tokens, 80 overlap, line-based, preserves `start_line`/`end_line`, which is what powers citations as `path#Lx-Ly`.
- **Embeddings:** default OpenAI `text-embedding-3-small` (1536d), pluggable to local (Ollama / llama.cpp). A content-hash cache makes reindex cheap.
- **Hybrid retrieval:** vector (cosine via `vec_distance_cosine`) plus FTS5 BM25, fused at **0.7 vector / 0.3 keyword**, then temporal decay and MMR diversity. Every result carries a source citation.
- **"Dreaming":** a cron background process promotes durable, frequently-recalled facts from sessions into the markdown files, written inside HTML-comment-delimited managed blocks so the user's own edits survive.
- **Traps they document in code:** `vec0` defaults to L2 not cosine (compute cosine in the SELECT); the JS cosine fallback is a full scan (fine for a memory folder, painful for a large OneDrive, so make `sqlite-vec` a hard dependency at scale); FTS5 `MATCH` breaks on some tokenizers (carry a `LIKE` fallback).

This is essentially the index you described, already built and MIT-licensed. We adapt it by swapping the source from a local memory folder to **OneDrive** (use Microsoft Graph file id + cTag/eTag and delta query for change detection instead of mtime/hash), and keep the markdown pointer layer the user can edit.

### Hermes (`github.com/NousResearch/hermes-agent`, MIT) — the "knows you" blueprint

Python. Two things to lift:

- **Skills:** an interval-nudged **background self-review fork** (every ~10 tool-iterations) runs *after* the user response, with a tool whitelist limited to memory and skill management, and decides what to save or patch. A strict **preference ladder** (patch a loaded skill → patch an umbrella skill → add a support file → only then create new) prevents skill sprawl. A **"Do NOT capture" list** stops the agent from hardening transient or environment failures into permanent false constraints. Lifecycle: active → stale (30d) → archived (90d), **archive never delete**, with provenance separation so auto-curation never touches user-authored content. The review prompts themselves are the highest-value thing to steal.
- **User model:** a bounded **`USER.md`** (who they are) kept separate from **`MEMORY.md`** (state and how-to), injected as a **frozen snapshot** at session start to protect the prefix cache, written durably mid-session but only surfaced next session. SQLite + FTS5 for cross-session recall. An optional dialectic layer reasons *after* turns to build an evolving model of the user beyond what they explicitly said.

### OpenAI "Dreaming" + Apple's rebuild — the convergence, confirmed

- **OpenAI Dreaming (June 4, 2026):** a single **asynchronous background process** synthesizes memory across many conversations, captures context automatically, and **rewrites existing memories as circumstances change** ("going to Singapore in July" becomes "went to Singapore in July 2026"). Plus a readable memory-summary page and topic controls. 5x cheaper to serve than before.
- **Apple:** a rebuilt index covering old and new content, indexing **almost immediately as captured**.

The lesson across all four: the index is not a one-time event. It is **continuously maintained**, and a **background synthesis loop** keeps it fresh and promotes durable facts. OpenClaw literally already calls its loop "dreaming," the same name OpenAI just used. We are not guessing at the architecture. It has converged, it is proven, and two implementations are MIT-licensed and sitting in our temp dir.

### Engineering recommendation, sharpened

Base TARS's index directly on **OpenClaw's architecture** (study the real schema we cloned): markdown source of truth, `chunks` / `chunks_vec` / `chunks_fts`, `files` change-detection, content-hash embedding cache, 0.7/0.3 hybrid fusion, `path#Lx-Ly` citations. Point the source adapter at **OneDrive via Microsoft Graph** using delta queries. Add a **near-real-time refresh** (Apple) and a **background "dreaming" synthesis** that keeps the map current and promotes durable facts (OpenAI/OpenClaw). Layer **Hermes's `USER.md` model, skills, and background self-review** on top so the chief-of-staff feels like it knows the person and improves. Do not fork a whole agent. The index is one layer, and we now have the exact, license-clean blueprint for it.

## 3. The architecture, centered on the index

### 3.1 The index is the core

A persistent map of the machine, OneDrive-first. Two coupled parts:

- **Human layer (markdown, editable):** plain-markdown pointer files. The root `.md` is the map. Scoped memory files point to locations (a client archive, another drive, a shared folder). The user can edit these to tell the system where to look. This is OpenClaw's transparency and your pointer idea.
- **Machine layer (searchable):** a local `index.sqlite` with `sqlite-vec` for embeddings plus FTS5 for keyword search, over chunked document content. This is what makes "knows exactly where to look" real, instead of re-reading everything every time.

On top sits a **Memory Tree** (OpenHuman's shape): themes → entities → documents, each node carrying the location of the real file. Ask "what's the status with the Mima audit," and it filters to the Mima entity under the audit theme and fetches just those chunks, then answers with a citation to the OneDrive path.

### 3.2 OneDrive deep-read (the part we under-built)

Not a filename scan. Actively crawl OneDrive, parse the real formats (docx, pdf, xlsx, pptx), and reason over them: cluster into clients and projects, extract entities, spot recurring document types, surface deadlines and stale work, notice patterns ("you touch these three folders weekly, this client has gone quiet"). This is the engine behind the personalized onboarding in section 5.

### 3.3 Retrieval

Question → filter the Memory Tree by theme/entity → fetch the relevant chunks from `index.sqlite` → answer **with a citation to the source file/location**. Never a bare answer; always "here, and it's from this file."

## 4. The agent: chief-of-staff, not note-taker

The output you described: a busy-CEO's chief of staff. Concretely the agent must be:

- **Proactive.** A morning brief. Surfaces what's due, what's stale, where there's a conflict. Doesn't wait to be asked.
- **Action-oriented.** Retrieve and create files, draft emails, assemble dashboards, package documents, go get things done. Not "here's where it is" but "done, here it is."
- **Self-improving.** Distill repeatable skills (Hermes) and build a user model so the options it offers and the way it talks feel personal, not boilerplate.
- **Citing.** Every claim points to its source (OpenAI). This is the trust contract for corporate use.
- **Bounded.** OpenClaw's lesson is the cautionary one: huge capability, catastrophic security posture (the "lethal trifecta"). Consent gates and on-device-by-default are non-negotiable, especially for a firm's data.

## 5. Onboarding redesign: the hook

For a non-technical corporate user, the journey is:

1. **Get it** (download or white-glove, see section 6). Zero terminal.
2. **Connect OneDrive** in one click.
3. **It deep-reads OneDrive** and builds the index. Shows progress, feels alive.
4. **It comes back uncannily specific:** "You're running 4 client engagements. The Mima audit has 3 open items and a deadline next Thursday. Two proposals are sitting unfinished. This folder has gone quiet for 6 weeks." Drawn from their real documents, not a template.
5. **The questions are tailored from what it found.** "You handle the Mima and Vecta accounts, and most of your work is audit and advisory, right?" Confirmations, personal. Never a generic five-option list.
6. **Consent, then it sets up the chief-of-staff** and files the first brief in under 60 seconds.

The test for every onboarding screen: does the user feel *seen*? If a question could have been asked of anyone, it's a bug.

## 6. Delivery for non-technical corporate users

The terminal-clone path is dead for this buyer. Three options:

- **A) White-glove managed rollout.** Christian's team runs the setup per person/team. Fastest to revenue, fits Andersen, monetizes as a service today. No engineering required.
- **B) Downloadable app.** A native installer (the OpenHuman/Hermes model is a Tauri desktop app). The real product, the bigger build.
- **C) Hybrid.** White-glove now to land Andersen and prove value, build the app in parallel.

**Recommendation: C.** Sell the rollout as a service immediately (warm buyer, named budget), and let the paid pilots fund and inform the app.

## 7. Fork vs build

- **OpenHuman (GPL-3.0):** closest match (Memory Tree, connectors, native app). GPL is fine for an internal Andersen rollout (no distribution), a real constraint if we ever SaaS-distribute.
- **Hermes (MIT):** skill-learning, user modeling, desktop app, most license-friendly.
- **OpenClaw:** best *reference* for the index specifically (markdown + `sqlite-vec`). Study it, don't adopt its security baggage wholesale.

**Recommendation: don't fork a whole agent yet.** The missing piece is one layer, the index, not an entire app. Build the index into TARS now, stealing OpenClaw's markdown + `sqlite-vec`/FTS5 pattern and OpenHuman's Memory Tree shape, pointed hard at OneDrive. Forking a full agent to get an app shell you then have to fight is slower than adding the one layer to a system we already control and understand. Re-evaluate forking OpenHuman or Hermes for the desktop shell *after* the index proves out.

## 8. Workflows (concrete)

- **Onboarding** (section 5): get it → connect OneDrive → deep-read → personalized read-back → tailored confirmations → consent → first brief.
- **Index build / refresh:** crawl OneDrive, parse, chunk, embed, update the Memory Tree. Runs on setup and on a schedule so the map stays current.
- **Ask (find/answer):** query → filter tree → fetch chunks → cited answer.
- **Do (act):** draft an email, build a dashboard, retrieve and package files, complete a task end to end.
- **Brief:** proactive daily surface of due/stale/conflicts.
- **Meeting → proposal** (Andersen's decided workflow): record → draft in the firm's voice → cite the source meeting.

## 9. Agents (or modes of one agent)

- **Indexer:** crawls OneDrive, builds and refreshes the map. Headless, scheduled.
- **Chief-of-staff:** the daily driver. Proactive, acts, cites, asks for consent on anything consequential.
- **Skill-learner:** distills repeatable skills from completed tasks (Hermes pattern) and maintains the user model.

## 10. Open decisions (need Christian)

1. **Delivery model:** white-glove, app, or hybrid? (Recommend hybrid.)
2. **License posture:** will we ever SaaS-distribute this? That decides whether GPL OpenHuman is usable or we need MIT Hermes or our own.
3. **Fork or build-the-index-first?** (Recommend build the index into TARS first; fork an app shell later if needed.)
4. **Index scope for v1:** OneDrive only, or OneDrive + Outlook + Teams from the start?

## Sources

- **OpenClaw, real source cloned and read:** `github.com/openclaw/openclaw` (MIT). Schema, hybrid retrieval, and dreaming verified in code on 2026-06-10.
- **Hermes, real source cloned and read:** `github.com/NousResearch/hermes-agent` (MIT). Skills, USER.md/MEMORY.md, FTS5 recall, Honcho dialectic verified in code on 2026-06-10.
- Apple WWDC 2026 search-infrastructure rebuild: macrumors.com/2026/06/08/apple-rebuilds-search-infrastructure; techcrunch WWDC 2026 recap.
- OpenAI "Dreaming" memory (June 4, 2026): openai.com blog "Dreaming: Better memory for a more helpful ChatGPT"; 9to5mac.com/2026/06/04 coverage.
- OpenAI Company Knowledge: openai.com/index/introducing-company-knowledge.
- OpenHuman architecture: pasqualepillitteri.it/en/news/2704 (OpenHuman local memory).
