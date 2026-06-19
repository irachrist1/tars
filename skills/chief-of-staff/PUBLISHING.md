# Publishing the Chief of Staff skill

TARS installs locally to `~/.claude/skills/chief-of-staff/` (Claude Code). **Cowork,
claude.ai, and mobile do not read that folder** — they use the account skill store.
Setup is not complete until the skill is available on every surface you use.

There is **no CLI or API** to publish skills. Upload is web-UI only.

## Build the upload bundle

From this skill folder:

```bash
node scripts/package.mjs
```

This writes `chief-of-staff.zip` with the required layout:

```
chief-of-staff/
  SKILL.md
  references/
  scripts/
```

## Upload

1. Open Claude (claude.ai or Desktop).
2. **Customize → Skills → + → Upload a skill**
3. Select `chief-of-staff.zip`.
4. Confirm it appears in your skills list.

## Personal vs org visibility

- **Personal upload** — visible to your account on every device where you're signed in.
- **Org / shared upload** — if your org admin enables shared skills, they can upload once
  for everyone. Ask IT whether your firm uses this.

The local install (`~/.claude/skills/`) and the account upload are **separate copies**.
Changing one does not update the other.

## Refreshing after changes

Uploads do **not** auto-update. After you edit the skill locally:

1. Re-run `node scripts/package.mjs`.
2. Re-upload the new zip (same flow as above).

Your **workspace** in OneDrive (`Chief of Staff/`) is independent — it syncs on its own
and does not need re-uploading.

## Completion check

Setup is done when:

- [ ] Workspace exists in OneDrive (`MAP.md`, `USER.md`, …)
- [ ] Skill is installed locally (Claude Code) **or** you don't use Code
- [ ] Skill is uploaded to the account store (Cowork / claude.ai / mobile)
- [ ] Connectors enabled on each surface you use (Settings → Connectors)
