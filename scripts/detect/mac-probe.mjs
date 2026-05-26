#!/usr/bin/env node
// mac-probe.mjs — macOS detection (Phase 1 second adapter).
// Read-only. Enumerates installed apps + Homebrew packages and emits a raw
// detection JSON that normalize.mjs maps to capabilities. No file contents.
//
// Usage: node mac-probe.mjs            # JSON to stdout
//        node mac-probe.mjs --pretty

import { readdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const pretty = process.argv.includes('--pretty');
const apps = new Set();

async function appsIn(dir) {
  try {
    const ents = await readdir(dir, { withFileTypes: true });
    for (const e of ents) {
      if (e.name.endsWith('.app')) apps.add(e.name.replace(/\.app$/, ''));
    }
  } catch { /* dir absent */ }
}

await appsIn('/Applications');
await appsIn('/Applications/Utilities');
await appsIn(join(homedir(), 'Applications'));

function safe(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return ''; }
}

// Homebrew (formulae + casks) — strong signal for dev tooling
const brew = safe('brew list --formula -1 2>/dev/null').split('\n').filter(Boolean);
const casks = safe('brew list --cask -1 2>/dev/null').split('\n').filter(Boolean);

// Default browser via LaunchServices (best-effort, may be empty without perms)
let defaultBrowser = '';
const ls = safe("defaults read com.apple.LaunchServices/com.apple.launchservices.secure 2>/dev/null");
const m = ls.match(/https?[\s\S]*?LSHandlerRoleAll\s*=\s*"([^"]+)"/);
if (m) defaultBrowser = m[1];

const result = {
  os: 'darwin',
  generatedAt: new Date().toISOString(),
  apps: [...apps].sort(),
  brewFormulae: brew,
  brewCasks: casks,
  defaultBrowser,
  tenantHints: [],
  note: 'Application names and package ids only. No file contents read.',
};

process.stdout.write(JSON.stringify(result, null, pretty ? 2 : 0) + '\n');
