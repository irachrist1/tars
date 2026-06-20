# Handoff — start or continue on any Claude surface

After install or onboarding, never assume the user is in Claude Code. Offer **both**
a launch path and a copy/paste path, and pick the prompt by state:

| State | Prompt |
|-------|--------|
| Skill installed, workspace not built yet | `set up my chief of staff` |
| Workspace exists, switching surface/session | `continue as my chief of staff` |

## Launch (a shell is available)

- **Claude Code:** `claude "set up my chief of staff"`
- **Codex (fallback):** `codex "set up my chief of staff"`

The installer (`npx tars-chief-of-staff`, or `tars` after a global install) does this
automatically when Claude Code is on PATH.

## Copy/paste (Cowork, claude.ai, Claude Desktop — no shell, or skill not uploaded)

Two options:

1. **Skill already uploaded** to the account store (Customize → Skills → Upload) —
   just paste the prompt: `set up my chief of staff`.
2. **Skill not uploaded** — emit a self-contained wrap that carries SKILL.md and stages
   its supporting files, so it runs without any install:

   ```sh
   npx tars-chief-of-staff --use              # print the paste-ready prompt
   npx tars-chief-of-staff --use --continue   # for an existing workspace
   tars use                                    # same, after a global install
   ```

   Paste the whole output into Claude. This is the cross-surface answer until a skill
   publish API exists (issues #1, #3).

## When to offer

At the end of the installer interview, and at the end of onboarding when the user named
Cowork or claude.ai as a surface. Show the prompt in a clear, copyable block.
