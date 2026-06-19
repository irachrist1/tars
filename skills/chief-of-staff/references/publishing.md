# Publishing the Chief of Staff skill

TARS installs locally to `~/.claude/skills/chief-of-staff/` (Claude Code). **Cowork,
claude.ai, and mobile do not read that folder** — they use the account skill store.
Setup is not complete until the skill is available on every surface you use.

There is **no CLI or API** to publish skills. Upload is web-UI only.

## Get the upload bundle

The zip has the required layout (`chief-of-staff/SKILL.md` at root):

```
chief-of-staff/
  SKILL.md
  references/
  scripts/
```

**Option A — from the TARS repo** (if you have it):

```bash
npm run package
# → dist/chief-of-staff.zip
```

**Option B — download a release** from
[github.com/irachrist1/tars/releases](https://github.com/irachrist1/tars/releases)
and use `chief-of-staff.zip`.

## Upload

1. Open Claude (claude.ai, Cowork, or Desktop).
2. **Customize → Skills → + → Upload a skill**
3. Select `chief-of-staff.zip`.
4. Confirm it appears in your skills list on each surface you use.

## Personal vs org visibility

- **Personal upload** — visible to your account on every device where you're signed in.
- **Org / shared upload** — if your org admin enables shared skills, they can upload once
  for everyone. Ask IT whether your firm uses this.

The local install (`~/.claude/skills/`) and the account upload are **separate copies**.
Changing one does not update the other.

## Refreshing after changes

Cloud uploads do **not** auto-update. Local installs (curl / PowerShell / npx) compare
`VERSION` and update in place when you re-run the installer.

To refresh the **cloud** copy after a new release:

1. Download or build a fresh `chief-of-staff.zip`.
2. Re-upload (same flow as above).

Your **workspace** in OneDrive (`Chief of Staff/`) is independent — it syncs on its own
and does not need re-uploading.

## Completion check

Setup is done when:

- [ ] Workspace exists in OneDrive (`MAP.md`, `USER.md`, …)
- [ ] Skill is installed locally (Claude Code) **or** you don't use Code
- [ ] Skill is uploaded to the account store (Cowork / claude.ai / mobile)
- [ ] Connectors enabled on each surface you use (Settings → Connectors)

Maintainers: see `PUBLISHING.md` at the repo root for the full release workflow.
