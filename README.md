# TARS — Chief of Staff on Claude

A Claude skill for professionals whose work lives in Microsoft 365. It reads your actual files, learns your operation, and acts like the person who knows where everything is.

---

## The problem

You open Claude. You describe a client. Claude gives you a generic answer.

It doesn't know that the ACME proposal is due Friday. It doesn't know the asset register has a version conflict. It doesn't know you've been waiting three days on a reply from their controller. It doesn't know any of this, because you never told it — and you shouldn't have to.

Most AI assistants are smart strangers. This one reads your work first.

---

## What it does

On first run, it reads your OneDrive, calendar, email, and meetings — then comes back specific:

> *"You're running four engagements. ACME has a proposal due Friday and two open items waiting on their side. This folder — `RWA-Restructure` — is that ACME or Globex work?"*

Every answer cites the source file. Every draft pulls from your real past proposals, not a generic template. It keeps a small map of your operation and updates it quietly as things change.

---

## Install

**Claude Code** — paste this as a message, Claude runs it:
```
npx tars-chief-of-staff
```

**Mac or Linux** — no Node required:
```sh
curl -fsSL https://raw.githubusercontent.com/irachrist1/tars/main/install.sh | sh
```

**Windows** — paste into PowerShell (right-click Start → Terminal):
```powershell
irm https://raw.githubusercontent.com/irachrist1/tars/main/Install-Tars.ps1 | iex
```

Then open Claude and say: **"set up my chief of staff"**

> Enable the **Microsoft 365 connector** in your Claude client (Settings → Connectors) so it can reach your files, mail, and calendar.

---

## How it works

- **A map, not a dump.** It builds a lightweight `MAP.md` of your operation — what areas exist, what's live, where precedents live. Reads it at the start of every session. Never tries to load everything at once.
- **Finds things, doesn't guess.** Uses Microsoft's own content search (the same index that powers M365 search) plus agentic query reformulation. Always cites the source file.
- **Drafts from precedent.** Need a proposal? It pulls your last two, follows the structure, matches the voice. No stored style profiles — the real document is the ground truth.
- **Stays current quietly.** After each session it files any corrections or changes into its small workspace (inside your own OneDrive). Tells you in one line what it updated. Never re-onboards.
- **Asks before it acts.** Reads, drafts, and prepares freely. Sends nothing, deletes nothing, overwrites nothing without an explicit yes.

---

## For teams

Someone technical runs the install once per machine. Non-technical users never touch a terminal — they open Claude and talk.

For a firm-wide rollout, install the skill at the org level via a shared Claude project. Every operator gets the same chief of staff, configured to their own files.

---

## What's inside

```
skills/
  chief-of-staff/    # the skill — map, search, memory, onboarding
  install/           # bootstrap skill: any agent can install from here
install.sh           # curl pipe install for Mac/Linux
Install-Tars.ps1     # PowerShell install for Windows
bin/install.mjs      # npx installer (Node)
```

---

MIT License · Built by [Christian Tonny](https://github.com/irachrist1)
