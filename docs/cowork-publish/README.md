# Cowork / claude.ai — publish TARS

Cloud Claude surfaces (Cowork, claude.ai, mobile) do not read `~/.claude/skills/`. Upload the skill bundle once per account.

## Quick path

```sh
tars publish
```

This runs `npm run package`, builds `dist/chief-of-staff.zip`, and prints upload steps.

## Manual steps

1. **Build the bundle** (from the TARS repo or after `npm install -g tars-chief-of-staff` with dev checkout):
   ```sh
   npm run package
   ```
2. **Open Claude** → **Customize** → **Skills** → **+** → **Upload a skill**
3. Select `dist/chief-of-staff.zip`
4. Confirm — the skill appears in your account store

## After updates

Re-run `tars publish` and **re-upload** the zip. Cloud skills do not auto-update (unlike `tars open` on Claude Code).

## Verify

- In Cowork/claude.ai, start a chat and say: **"set up my chief of staff"**
- Or run locally: `tars use` and paste the wrapped prompt

## Screenshots

Add screenshots of Customize → Skills → Upload here when capturing a release walkthrough.
