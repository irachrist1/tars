# Memory Architecture

This is the part most "paste everything into one giant file" systems get wrong. A second brain that dumps everything into `CLAUDE.md` rots within weeks: it blows the context budget, rules contradict each other, and nobody can find anything. TARS generates a system engineered to stay maintainable.

## Two surfaces, different jobs

**`CLAUDE.md` — the operating manual (≤ 300 lines).**
A pointer, not a store. It holds only what must be true every session: identity in three sentences, how to collaborate, the vault layout, the routing map, output standards, and prescriptive **always/never** rules. When it approaches 300 lines, detail moves into `00_System/` files and `CLAUDE.md` keeps just the pointer.

**`MEMORY.md` — the memory index (≤ 150 lines).**
Always loaded, but it is an *index*, not the memory itself. One line per memory file. When a topic comes up, the matching `memory/*.md` file is opened. This keeps the always-loaded footprint tiny while the actual memory scales without bound.

## Memory files: one topic each

`memory/` holds single-topic files, each with frontmatter so relevance can be judged before loading:

```markdown
---
name: short-kebab-slug
description: one line — used to decide whether to load this file
metadata:
  type: user | feedback | reference | project
---
```

| Type | Holds | Example |
|---|---|---|
| `user_*` | who the person is | `user_profile.md` |
| `feedback_*` | how to work with them, corrections | `feedback_working_style.md` |
| `reference_*` | facts, ids, configs that change | `reference_integrations.md` |
| `project_*` | ongoing work, goals, constraints | `project_q3_rollout.md` |

Files link each other with `[[name]]`. A `[[name]]` that doesn't exist yet is a fine marker for something worth writing later.

## The split rule (no duplication)

- **Prescriptive and stable** ("always deliver finished output", "never sync private notes") → `CLAUDE.md`.
- **Factual and changing** ("current client is ACME", "the integrations are X") → `memory/`.
- **Never the same rule in two places.** If a fact appears in a memory file, `CLAUDE.md` does not restate it.

## Maintenance behaviors (generated into the system)

1. **Session audit on wrap-up.** Scan the session for corrections, new facts, and implied rules. File them into the right surface silently. This is how the system learns without being told to.
2. **Dedupe on write.** Before adding a memory, check for an existing file that covers it. Update in place rather than create a duplicate.
3. **Archive past the ceiling.** When `MEMORY.md` or `CLAUDE.md` nears its line cap, move the stalest entries to `00_System/archive.md` with a date and reason. Never delete a working rule.
4. **Verify before trusting.** A memory written months ago reflects what was true then. If it names a file or config, confirm it still exists before acting on it.

## Why these ceilings

300 and 150 are not arbitrary. They keep the always-loaded context small enough to stay cheap and fast every single session, which is the difference between a brain someone actually uses and one they abandon because it got slow and noisy.
