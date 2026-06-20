#!/bin/sh
# install.sh — install or update the chief-of-staff skill without Node or npm.
# Works on any Mac or Linux with curl (macOS 10.15+, Ubuntu 18+, WSL).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/irachrist1/tars/main/install.sh | sh
#
# Re-running is safe: if a newer version is published it updates in place and
# keeps your local onboarding-seed.md. The file list is read from the published
# MANIFEST, so the installer never drifts out of sync with the skill.
#
# Options (pass as env vars):
#   DEST=/path   — install somewhere other than ~/.claude/skills/chief-of-staff
#   FORCE=1      — reinstall even if already up to date

set -e

printf '\n'
printf '  T A R S\n'
printf '  Make your AI actually know your work.\n'
printf '  by Christian Tonny · github.com/irachrist1/tars\n\n'

DEST="${DEST:-$HOME/.claude/skills/chief-of-staff}"
BASE="https://raw.githubusercontent.com/irachrist1/tars/main/skills/chief-of-staff"

# --- fetch the manifest FIRST: it carries both the version line and the file
# list, so the version we stamp and the files we install always agree (no
# separate VERSION fetch that could drift out of sync with the manifest). ------
MANIFEST="$(curl -fsSL "$BASE/MANIFEST" 2>/dev/null || true)"
if [ -z "$MANIFEST" ]; then
  echo "  error: could not fetch the manifest from $BASE/MANIFEST" >&2
  echo "         check your connection and try again." >&2
  exit 1
fi
REMOTE_VERSION="$(echo "$MANIFEST" | sed -n 's/^version //p' | tr -d ' \r\n')"
[ -z "$REMOTE_VERSION" ] && REMOTE_VERSION="unknown"
files=$(echo "$MANIFEST" | grep -v '^#' | grep -v '^version ' | grep -v '^[[:space:]]*$')

# --- what (if anything) is installed? ----------------------------------------
LOCAL_VERSION=""
[ -f "$DEST/VERSION" ] && LOCAL_VERSION="$(tr -d ' \r\n' < "$DEST/VERSION")"

if [ -f "$DEST/SKILL.md" ]; then
  if [ "$LOCAL_VERSION" = "$REMOTE_VERSION" ] && [ -z "$FORCE" ]; then
    echo "  ✓ already up to date (v${LOCAL_VERSION:-?}) at $DEST"
    echo "    re-run with FORCE=1 to reinstall."
    echo ""
    exit 0
  fi
  if [ -n "$LOCAL_VERSION" ]; then
    echo "  Updating v${LOCAL_VERSION} → v${REMOTE_VERSION}…"
  else
    echo "  Updating to v${REMOTE_VERSION} (keeping your onboarding-seed.md)…"
  fi
else
  echo "  Installing v${REMOTE_VERSION}…"
fi

# --- download every file the manifest lists ----------------------------------
# Loop in the main shell (not a pipe subshell) so a failed download actually
# stops the installer. Manifest paths never contain spaces, so word-splitting
# the list is safe.
mkdir -p "$DEST"
for rel in $files; do
  mkdir -p "$DEST/$(dirname "$rel")"
  if ! curl -fsSL "$BASE/$rel" -o "$DEST/$rel"; then
    echo "  error: failed to download $rel — install aborted (nothing claimed)" >&2
    exit 1
  fi
  echo "    · $rel"
done

# --- prune files removed in newer releases (keep VERSION + onboarding-seed.md)-
# An overlay update would otherwise leave behind files that no longer ship,
# drifting the install away from the released skill.
keep="$(printf '%s\nVERSION\nonboarding-seed.md\n' "$files")"
( cd "$DEST" && find . -type f 2>/dev/null | sed 's#^\./##' ) | while IFS= read -r existing; do
  if ! printf '%s\n' "$keep" | grep -qxF "$existing"; then
    rm -f "$DEST/$existing"
    echo "    - removed $existing (no longer in release)"
  fi
done
find "$DEST" -mindepth 1 -type d -empty -delete 2>/dev/null || true

# stamp the installed version so the next run can compare
echo "$REMOTE_VERSION" > "$DEST/VERSION"

echo ""
echo "  ✓ chief-of-staff v${REMOTE_VERSION} → $DEST"
echo ""
echo "  Open Claude and say:  set up my chief of staff"
echo ""
echo "  Use it in Cowork or claude.ai too?  Upload the skill once via"
echo "  Customize → Skills → + → Upload a skill (see PUBLISHING.md)."
echo ""
echo "  If your work lives in Microsoft 365, enable the Microsoft 365 connector"
echo "  in your Claude client (Settings → Connectors) so it can read your files,"
echo "  mail, and calendar."
echo ""
echo "  Built by Christian Tonny · github.com/irachrist1"
echo ""
