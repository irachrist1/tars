# Handoff — start or continue in Claude

After install or onboarding, the user picks how to reach Claude. Always offer **both**
paths — never assume they use Claude Code.

## The prompts

| When | Prompt |
|------|--------|
| **First setup** (skill installed, workspace not built yet) | `set up my chief of staff` |
| **After setup** (workspace exists, switching surfaces) | `continue as my chief of staff` |

## Option 1 — Open Claude with the prompt

- **Claude Code** (terminal): `claude "set up my chief of staff"`
- **Codex** (fallback): `codex "set up my chief of staff"`
- **Claude Desktop** (macOS): open the app, then paste the prompt from Option 2
- **Cowork / claude.ai**: no shell launch — use Option 2

The installer (`tars` or `npx tars-chief-of-staff`) can launch Claude Code automatically when
the user picks this option and the CLI is on PATH.

From any directory after a global install:

```bash
npm install -g tars-chief-of-staff
tars                  # install if needed, then open Claude with the right prompt
tars open             # same
tars install          # full personalized setup interview
```

## Option 2 — Copy and paste

**Short prompt** (skill already uploaded to the account store):

```
set up my chief of staff
```

**Full skill wrap** (Cowork/claude.ai without the skill installed yet — mirrors
`skills use` from skills.sh):

```bash
tars use | pbcopy                        # macOS (after npm i -g tars-chief-of-staff)
tars use                                  # print to terminal, paste into Claude
tars use --continue                       # after setup: continue as my chief of staff
npx tars-chief-of-staff --use             # same without a global install
```

This emits the SKILL.md inside a `<SKILL.md>` block plus supporting files in a
temp directory — the same pattern Matt Pocock's `npx skills@latest use` uses.

Show the prompt in a clear, copyable block. On macOS/Windows the installer may also
copy the short prompt to the clipboard.

## When to offer this

- **End of the terminal installer** — always, after the interview (or after a
  non-interactive install, print both options).
- **End of onboarding Phase 4** — when the user named Cowork or claude.ai, or when
  they might continue on another device. If they already finished setup in this
  session, offer the **continue** prompt instead of **set up**.

## What not to do

- Don't assume Claude Code is where they'll work.
- Don't end setup with only "open Claude" — always show the copyable prompt too.
- Don't launch or send anything without the user choosing Option 1.
