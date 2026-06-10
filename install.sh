#!/bin/sh
# install.sh — install the chief-of-staff skill without Node or npm.
# Works on any Mac or Linux with curl (macOS 10.15+, Ubuntu 18+, WSL).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/irachrist1/tars/main/install.sh | sh
#
# Options (pass as env vars):
#   DEST=/path   — install somewhere other than ~/.claude/skills/chief-of-staff
#   FORCE=1      — overwrite an existing install

set -e

DEST="${DEST:-$HOME/.claude/skills/chief-of-staff}"
BASE="https://raw.githubusercontent.com/irachrist1/tars/main/skills/chief-of-staff"

# Don't clobber an edited install without being asked.
if [ -f "$DEST/SKILL.md" ] && [ -z "$FORCE" ]; then
  echo "  already installed at $DEST"
  echo "  re-run with FORCE=1 to overwrite"
  exit 1
fi

mkdir -p "$DEST/references" "$DEST/scripts"

echo "  Fetching chief-of-staff…"
curl -fsSL "$BASE/SKILL.md"                          -o "$DEST/SKILL.md"
curl -fsSL "$BASE/references/onboarding.md"          -o "$DEST/references/onboarding.md"
curl -fsSL "$BASE/references/workspace-shapes.md"    -o "$DEST/references/workspace-shapes.md"
curl -fsSL "$BASE/scripts/scan.mjs"                  -o "$DEST/scripts/scan.mjs"

echo ""
echo "  ✓ chief-of-staff installed → $DEST"
echo ""
echo "  Open Claude and say:  set up my chief of staff"
echo ""
echo "  If your work lives in Microsoft 365, enable the Microsoft 365 connector"
echo "  in your Claude client (Settings → Connectors) so it can read your files,"
echo "  mail, and calendar."
echo ""
