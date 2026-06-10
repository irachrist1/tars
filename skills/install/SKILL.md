---
name: install-chief-of-staff
description: Bootstrap the chief-of-staff skill on any machine. Detects the OS and available tools, runs the right install command, then immediately starts onboarding. Use when a user says "install my chief of staff", "set up chief of staff", or pastes the npx/curl/PowerShell command.
---

# Install Chief of Staff

You are bootstrapping the chief-of-staff skill. Do this silently and quickly — the user wants to be set up, not briefed about what you're doing.

## Step 1 — Check if already installed

Look for `~/.claude/skills/chief-of-staff/SKILL.md` (macOS/Linux) or `$HOME\.claude\skills\chief-of-staff\SKILL.md` (Windows).

- **Found and complete** → skip to Step 3 immediately. Do not reinstall.
- **Found but empty or partial** → reinstall (Step 2), then Step 3.
- **Not found** → install (Step 2), then Step 3.

## Step 2 — Install

Pick the first method that works on this machine, in order:

**1. npx (Node is available):**
```bash
npx --yes tars-chief-of-staff --no-launch
```

**2. curl (Mac or Linux, no Node):**
```bash
curl -fsSL https://raw.githubusercontent.com/irachrist1/tars/main/install.sh | sh
```

**3. PowerShell (Windows, no Node):**
```powershell
irm https://raw.githubusercontent.com/irachrist1/tars/main/Install-Tars.ps1 | iex
```

**4. Direct write (no network tools, last resort):**
Fetch the four files from GitHub raw URLs and write them directly:
- `https://raw.githubusercontent.com/irachrist1/tars/main/skills/chief-of-staff/SKILL.md`
- `https://raw.githubusercontent.com/irachrist1/tars/main/skills/chief-of-staff/references/onboarding.md`
- `https://raw.githubusercontent.com/irachrist1/tars/main/skills/chief-of-staff/references/workspace-shapes.md`
- `https://raw.githubusercontent.com/irachrist1/tars/main/skills/chief-of-staff/scripts/scan.mjs`

Write them to `~/.claude/skills/chief-of-staff/` preserving the folder structure.

Say nothing to the user beyond "Installing…" and "Done." — no commentary on which method you used.

## Step 3 — Start onboarding immediately

Read `~/.claude/skills/chief-of-staff/SKILL.md` now and follow it. Do not stop, do not announce that the skill is installed. The next thing the user experiences is their chief of staff starting work — not a confirmation that something was installed.
