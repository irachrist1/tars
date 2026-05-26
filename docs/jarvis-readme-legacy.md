# Jarvis — Your Claude Personal Machine Agent

> Claude that knows your whole life, not just what you typed last.

---

## What this is

Jarvis turns Claude into a personal machine agent — an AI that lives on your computer, knows your actual work, and can answer real questions about your real day without you having to explain anything.

Most AI tools are amnesiacs. You describe your situation, they help, you close the tab, they forget everything. Next session you start from zero.

Jarvis is different. It reads your machine — your tasks, calendar, browser history, code repos, app usage — and builds a persistent memory that Claude loads automatically every session. Ask it anything about your work and it already knows the context.

**This is not a chatbot. It is a personal agent.**

---

## What it can answer — real examples

These work out of the box after a 2-minute setup:

**For anyone in a team or consultancy:**
> "How many hours did I actually spend on the Andersen project this week?"

> "I need to fill in my timesheet for Monday. What was I working on?"

> "Do I have time to take on another client this week, or am I already overbooked?"

> "What did I last work on for this client before the meeting I'm about to join?"

**For developers:**
> "What did I commit yesterday across all my repos?"

> "Which project have I been neglecting? I feel like I haven't touched it in days."

> "I just got assigned a bug — what files was I last editing in this codebase?"

**For anyone with a to-do list:**
> "What's overdue right now across everything?"

> "I have 90 minutes free before my next meeting. What should I tackle?"

> "Did I forget anything from last week?"

**The honest ones nobody wants to ask:**
> "How much time did I spend on YouTube this week?"

> "What percentage of my day was actually productive vs. just looking busy?"

> "Am I spending time on the right things compared to what I said my priorities were?"

---

## Why this is new

AI assistants have a memory problem. Every session is a blank slate — you re-explain your role, your projects, your context, your tools. This is fine for writing an email. It breaks down for anything that requires knowing your life.

Jarvis solves this by connecting Claude directly to the data your machine already has:

- Your **task manager** knows what you committed to do
- Your **calendar** knows where your time is allocated  
- Your **browser history** knows where your attention actually went
- Your **activity tracker** knows which apps you used and for how long
- Your **git repos** know what you actually shipped

Claude can synthesize all of it, cross-reference it, and tell you things you didn't know about your own day. That gap — between what you planned, what you did, and what you shipped — is where Jarvis lives.

---

## Setup (2 minutes)

**Step 1 — Install the skill:**
```bash
mkdir -p ~/.claude/skills/jarvis
curl -o ~/.claude/skills/jarvis/SKILL.md \
  https://raw.githubusercontent.com/irachrist1/jarvis-claude/main/SKILL.md
```

**Step 2 — Run it:**

Open Claude Code and type:
```
/jarvis
```

Jarvis will scan your machine and set itself up. It takes about 60 seconds on the first run.

**Step 3 — Use it:**

From now on, just talk to Claude normally. It already knows your context. Run `/jarvis` any time you want it to refresh what it knows.

---

## What gets scanned

Jarvis scans your machine when you run `/jarvis`. This is what makes it work — and it's also what makes it powerful. Here's exactly what it looks at:

| Category | What it reads |
|---|---|
| **Tasks** | TickTick, Apple Reminders, Things 3, Todoist, Taskwarrior, Linear, Microsoft To Do |
| **Calendar** | Apple Calendar, Google Calendar (gcalcli), Outlook |
| **Activity** | Daylens, RescueTime, Toggl |
| **Browser** | Chrome, Firefox, Safari, Edge — domain-level summary only (e.g. "github.com — 23 visits"), no URLs or page content |
| **Code** | Git repos: names, branches, recent commits, remotes |
| **Identity** | git config name/email, GitHub username, OS, timezone |
| **Tech stack** | Installed languages, package managers |

**Everything stays on your machine.** Nothing is sent to any server. Claude reads your local files, builds memory files on your disk, and that's it.

**Browser note:** Jarvis never stores URLs or page titles. It summarizes to domain-level counts — "youtube.com — 47 visits this week." You'll know it immediately. That's the point.

---

## Commands

After setup, say these in any Claude session:

| Say this | What happens |
|---|---|
| `/jarvis` | Full scan and update — shows what changed |
| `Jarvis, refresh tasks` | Re-read your task managers |
| `Jarvis, refresh calendar` | Re-read today's calendar |
| `Jarvis, refresh everything` | Full re-scan |
| `Jarvis, status` | Show what tools are connected and last scan time |
| `Jarvis, reset` | Wipe memory and start fresh |

---

## Platform support

Works on **macOS** and **Windows**.

Requires Claude Code (free to install at claude.ai/code).

For activity tracker and browser history scanning, you need `sqlite3`:
- macOS: `brew install sqlite3`
- Windows: `winget install SQLite.SQLite`

Everything else is detected automatically.

---

## The bigger idea

Jarvis is a proof of concept for what personal AI agents should be: grounded in your actual data, running on your machine, and persistent across sessions.

The AI tools most people use today know nothing about you. Jarvis inverts that. It starts with everything your computer already knows — and Claude figures out what matters.

---

*Built with Claude Code · Designed with Claude Opus 4.6 · Open source at github.com/irachrist1/jarvis-claude*
