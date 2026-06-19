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

# --- what version is published, and what (if anything) is installed? ---------
REMOTE_VERSION="$(curl -fsSL "$BASE/VERSION" 2>/dev/null | tr -d ' \r\n' || true)"
[ -z "$REMOTE_VERSION" ] && REMOTE_VERSION="unknown"

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

# --- fetch the manifest, then every file it lists ----------------------------
# The manifest is the source of truth — add a file to the skill and it ships
# here automatically once package.mjs regenerates the manifest.
MANIFEST="$(curl -fsSL "$BASE/MANIFEST" 2>/dev/null || true)"
if [ -z "$MANIFEST" ]; then
  echo "  error: could not fetch the manifest from $BASE/MANIFEST" >&2
  echo "         check your connection and try again." >&2
  exit 1
fi

mkdir -p "$DEST"
# Build the file list first, then loop in the main shell (not a pipe subshell) so
# a failed download actually stops the installer instead of being swallowed.
# Manifest paths never contain spaces, so word-splitting the list is safe.
files=$(echo "$MANIFEST" | grep -v '^#' | grep -v '^version ' | grep -v '^[[:space:]]*$')
for rel in $files; do
  mkdir -p "$DEST/$(dirname "$rel")"
  if ! curl -fsSL "$BASE/$rel" -o "$DEST/$rel"; then
    echo "  error: failed to download $rel — install aborted (nothing claimed)" >&2
    exit 1
  fi
  echo "    · $rel"
done

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
