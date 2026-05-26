#!/usr/bin/env node
// detect.mjs — one cross-platform entrypoint for detection.
// Picks the right probe for the OS (windows-probe.ps1 on Windows,
// mac-probe.mjs on macOS), pipes it through normalize.mjs, and prints the
// capability map + archetype scores. It NEVER scaffolds and NEVER writes —
// this is the safe dry-run a Windows tester can run to verify the pipeline.
//
// Usage:
//   node scripts/detect/detect.mjs            # human-readable capability map
//   node scripts/detect/detect.mjs --json     # raw normalized JSON
//   node scripts/detect/detect.mjs --raw      # raw probe output (pre-normalize)

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { platform } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const showRaw = argv.includes('--raw');
const os = platform();

// --- choose + run the probe ------------------------------------------------
function runProbe() {
  if (os === 'win32') {
    const ps1 = join(here, 'windows-probe.ps1');
    for (const shell of ['pwsh', 'powershell']) {
      const r = spawnSync(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-Json'],
        { encoding: 'utf8' });
      if (r.status === 0 && r.stdout && r.stdout.trim()) return r.stdout;
    }
    fail('Could not run windows-probe.ps1 with pwsh or powershell.');
  } else {
    const r = spawnSync('node', [join(here, 'mac-probe.mjs')], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout) return r.stdout;
    fail('Could not run mac-probe.mjs.\n' + (r.stderr || ''));
  }
}

function fail(msg) { console.error('detect: ' + msg); process.exit(1); }

const rawOut = runProbe();
if (showRaw) { process.stdout.write(rawOut); process.exit(0); }

// --- normalize -------------------------------------------------------------
const norm = spawnSync('node', [join(here, 'normalize.mjs')], { input: rawOut, encoding: 'utf8' });
if (norm.status !== 0) fail('normalize failed:\n' + (norm.stderr || ''));
const data = JSON.parse(norm.stdout);

if (asJson) { process.stdout.write(JSON.stringify(data, null, 2) + '\n'); process.exit(0); }

// --- human report (dry run, nothing written) -------------------------------
const L = [];
L.push('');
L.push(`  Detection (dry run — nothing scaffolded)   OS: ${data.os}`);
L.push(`  ${'-'.repeat(50)}`);
L.push('  Capabilities found:');
const caps = data.capabilities || {};
const order = ['notes', 'tasks', 'calendar', 'meeting-notes', 'email', 'read-later', 'behavior-data', 'files', 'code'];
for (const c of order) {
  const cap = caps[c];
  if (cap && cap.present) {
    L.push(`    ${c.padEnd(15)} ${String(cap.chosen).padEnd(14)} [${cap.tier}]`);
  } else {
    L.push(`    ${c.padEnd(15)} —              [manual fallback]`);
  }
}
L.push('');
L.push(`  Inferred archetypes: ${data.archetypeRanked.join(' > ') || '(none — local-only)'}`);
if (data.tenantHints && data.tenantHints.length) L.push(`  Tenant hints: ${data.tenantHints.join(', ')}`);
L.push('');
L.push('  This is a dry run. Run the skill to index, confirm, and scaffold.');
L.push('');
process.stdout.write(L.join('\n') + '\n');
