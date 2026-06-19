# TARS

Give your AI the context it needs to deliver.

Years of docs, email, and meeting notes your AI can't touch. TARS indexes all of it and hands the right context to your AI on command. Say *"prep me for the 3pm call with last year's numbers"* and it's ready before you sit down. TARS never copies or moves your files.

Named after the robot in Interstellar that knew the mission and got things done without being told twice. TARS is a layer over your laptop, not a new app. It grows with you. Like Claude Cowork, without the setup.

---

## The problem is not memory.

ChatGPT has memory. Claude has memory. They remember your name, your preferences, what you told them last week.

What they cannot do is reach the work on your laptop. They cannot pull the right file, connect a meeting to an email to a proposal, or notice how you actually work. So you spell everything out, every time. Like teaching a toddler.

It should not be that way.

## TARS is a context indexer for the AI tools you already use.

Connect it once to your laptop. It indexes your files, email, calendar, and the tools you work in.

On your way to a meeting, say: *"prep me for 3pm ACME with last year's numbers and the open items."* It finds everything and has the brief ready before you sit down.

You keep your tools. TARS makes them know your work.

---

## Install

**Open from anywhere** (after global install):
```sh
npm install -g tars-chief-of-staff
tars                  # installs if needed, opens Claude with the right prompt
tars install          # full personalized setup interview
tars use              # copy-paste prompt for Cowork / claude.ai
tars doctor           # verify skill, index, connectors, workspace
tars publish          # zip + Cowork upload steps
```

**skills.sh:**
```sh
npx skills add irachrist1/tars
```

**Claude Code** (paste as a message, Claude runs it):
```
npx tars-chief-of-staff
```

**Mac or Linux** (no Node needed):
```sh
curl -fsSL https://raw.githubusercontent.com/irachrist1/tars/main/install.sh | sh
```

**Windows** (paste into PowerShell):
```powershell
irm https://raw.githubusercontent.com/irachrist1/tars/main/Install-Tars.ps1 | iex
```

Then open Claude and say: **"set up my chief of staff"**

---

## Here is how it works.

**It reads your work first.** First time you open it, TARS scans your files, seeds connector routes, and builds a local index before Claude opens. You explain nothing. It just reads. Verify anytime with `tars doctor`.

**It keeps a map, not a copy.** Your files stay where they are. TARS keeps a short index inside your own storage (`<work folder>/.tars-index` and `Chief of Staff/`). A new hire who walked every filing cabinet on day one and always knows which drawer to open.

**It spots patterns, not just keywords.** `tars context "prep ACME 3pm"` merges file hits with connector routes (mail, calendar, meetings). It connects your proposal to the meeting notes to the email thread. Asks once when it cannot place something. Records the answer. Never asks again.

**It drafts the way you do.** `scripts/precedents.mjs` pulls the last similar docs by client and type. Your structure, your voice, your precedents. Not a template.

**It stays current without making a thing out of it.** `tars open` refreshes the index and runs a quiet maintenance check. After each session, if anything changed, the skill updates its own notes and tells you in one line. No summary. No ceremony. Your tools just keep getting smarter.

---

## What's inside

```
skills/
  chief-of-staff/    the skill: index, search, memory, onboarding
  install/           bootstrap skill so any agent can self-install
docs/index.html      the landing page
install.sh           Mac and Linux installer
Install-Tars.ps1     Windows installer
bin/install.mjs      npx installer
```

MIT License · Built by [Christian Tonny](https://github.com/irachrist1)
