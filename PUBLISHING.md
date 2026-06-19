# Publishing & updating TARS

How a release reaches users, and how users update. There are two distribution
worlds because Claude has two: **local** (Claude Code, on your machine) and
**cloud** (Cowork, claude.ai). They update differently.

## The one source of truth

`scripts/package.mjs` walks `skills/chief-of-staff/`, then writes:

- `skills/chief-of-staff/MANIFEST` — version line + every file path to ship.
- `skills/chief-of-staff/VERSION` — the version, carried inside the skill so it
  travels to every surface (including the cloud zip).
- `dist/chief-of-staff.zip` — the upload-ready bundle (SKILL.md folder at root).

All three installers read MANIFEST/VERSION, so **adding a file to the skill is
all it takes to ship it** — no installer ever drifts out of sync again. (This is
the bug that shipped curl/PowerShell installs without `connectors.mjs`.)

## Cutting a release

```sh
# 1. bump the version
npm version patch   # or minor / major  (updates package.json)

# 2. regenerate MANIFEST + VERSION + the cloud zip
npm run package

# 3. commit, tag, push
git add -A && git commit -m "vX.Y.Z: …" && git tag vX.Y.Z && git push --tags

# 4. publish the npm package (npx + `tars-chief-of-staff`)
npm publish
```

Always run `npm run package` after bumping the version, before committing — the
MANIFEST/VERSION must match `package.json`.

## How users get it / update it

### Local — Claude Code (auto-updating by re-run)

```
npx tars-chief-of-staff            # always pulls latest from npm; --update to refresh in place
curl -fsSL .../install.sh | sh     # reads MANIFEST, updates if a newer VERSION is published
irm .../Install-Tars.ps1 | iex     # same, on Windows
```

Re-running any of these is safe: same version → "already up to date"; newer
version → updates in place and **keeps the user's `onboarding-seed.md`**. The
user's actual workspace (their `Chief of Staff/` folder in OneDrive) is never
touched by any installer.

### Cloud — Cowork & claude.ai (manual upload, manual refresh)

There is **no publish API** for cloud skills — it is a web-UI upload only:

1. Run `npm run package` to build `dist/chief-of-staff.zip`.
2. In Claude: **Customize → Skills → + → Upload a skill** → pick that zip.
3. Choose visibility: **personal** (just you) or **org/shared** (everyone on the
   workspace — this is what makes "set up once, works everywhere" real).

Cloud uploads **do not auto-update**. To ship a new version, re-run
`npm run package` and re-upload the zip. The VERSION file inside the zip lets you
confirm which version is live.

> This manual cloud step is the open gap behind issues #1 and #3. Until Anthropic
> exposes a publish API, "works everywhere from one command" ends at generating
> the zip and walking the user through the upload — which is what onboarding now
> does.
