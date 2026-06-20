#!/usr/bin/env node
// smoke.mjs — cross-platform smoke test for the parts that must never regress:
// the packager, the indexer lifecycle, and the CLI surface (--use / doctor /
// index). Pure Node, no deps, no network. Run with: npm test
//
// Exits non-zero on the first failure so CI fails loudly.

import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEXER = join(ROOT, 'skills', 'chief-of-staff', 'scripts', 'indexer.mjs');
const CONNECTORS = join(ROOT, 'skills', 'chief-of-staff', 'scripts', 'connectors.mjs');
const INSTALL = join(ROOT, 'bin', 'install.mjs');
const PACKAGE = join(ROOT, 'scripts', 'package.mjs');

let passed = 0;
const failures = [];
function check(name, cond) {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}`); }
}
function node(args, opts = {}) {
  return spawnSync('node', args, { encoding: 'utf8', ...opts });
}

const work = await mkdtemp(join(tmpdir(), 'tars-smoke-'));
const store = join(work, '.tars-index');
try {
  // --- corpus ---------------------------------------------------------------
  await mkdir(join(work, 'Clients'), { recursive: true });
  await writeFile(join(work, 'Clients', 'acme.md'), '# ACME\nQ3 audit fees were 12,400. Proposal sent 2024-03.\n');
  await writeFile(join(work, 'notes.md'), 'standup: shipped the indexer; zephyrine reconciliation pending.\n');
  await writeFile(join(work, '.env'), 'SECRET=should-never-be-indexed-xyz\n'); // must be ignored

  // --- packager -------------------------------------------------------------
  const pkg = node([PACKAGE, '--no-zip']);
  check('package.mjs runs', pkg.status === 0);
  const manifest = await readFile(join(ROOT, 'skills', 'chief-of-staff', 'MANIFEST'), 'utf8');
  check('manifest has a version line', /^version\s+\d+\.\d+\.\d+/m.test(manifest));
  check('manifest lists indexer.mjs', manifest.includes('scripts/indexer.mjs'));
  check('manifest lists connectors.mjs', manifest.includes('scripts/connectors.mjs'));

  // --- indexer lifecycle ----------------------------------------------------
  check('index build', node([INDEXER, 'build', '--root', work, '--store', store]).status === 0);

  const q = node([INDEXER, 'query', 'ACME audit fees', '--store', store, '--json']);
  const hits = JSON.parse(q.stdout).hits;
  check('query returns hits', hits.length > 0);
  check('top hit is the ACME file', hits[0].path.includes('acme.md'));

  const secret = node([INDEXER, 'query', 'should-never-be-indexed-xyz', '--store', store, '--json']);
  check('hidden .env is NOT indexed', JSON.parse(secret.stdout).hits.length === 0);

  await writeFile(join(work, 'new.md'), 'fresh mango harvest figures\n');
  const upd = node([INDEXER, 'update', '--root', work, '--store', store]);
  check('incremental update succeeds', upd.status === 0 && /\+1 new/.test(upd.stdout));
  check('new file is queryable', node([INDEXER, 'query', 'mango harvest', '--store', store, '--json']).stdout.includes('new.md'));

  check('query without locator errors cleanly', /needs --store/.test(node([INDEXER, 'query', 'x']).stderr));
  check('--top rejects non-positive', /positive integer/.test(node([INDEXER, 'query', 'x', '--store', store, '--top', '-1']).stderr));

  // --- connectors fallback (issue #6) ---------------------------------------
  // Force the `claude` CLI to be unreachable by pointing PATH at the (binary-free)
  // work dir, then invoke node by absolute path so the script itself still runs.
  const conn = spawnSync(process.execPath,
    [CONNECTORS, '--json', '--tools', JSON.stringify(['mcp__claude_ai_Gmail__x', 'mcp__plugin_linear_linear__y'])],
    { encoding: 'utf8', env: { ...process.env, PATH: work } });
  const connData = JSON.parse(conn.stdout);
  check('connectors fallback builds a map from session tools', connData.available === true && connData.connected.length === 2);
  check('connectors fallback classifies Gmail + Linear', connData.connected.map((c) => c.key).sort().join(',') === 'gmail,linear');
  const connBad = spawnSync(process.execPath, [CONNECTORS, '--json', '--tools', 'NOT-JSON{'],
    { encoding: 'utf8', env: { ...process.env, PATH: work } });
  check('connectors handles malformed --tools gracefully', connBad.status === 0 && JSON.parse(connBad.stdout).available === false);

  // --- CLI surface ----------------------------------------------------------
  const use = node([INSTALL, '--use']);
  check('--use wraps SKILL.md', use.stdout.includes('<SKILL.md>') && use.stdout.includes('</SKILL.md>'));
  check('--use carries the setup request', use.stdout.includes('set up my chief of staff'));

  check('help mentions the subcommands', node([INSTALL, '--help']).stdout.includes('doctor'));

  const dest = join(work, 'skill');
  check('install to --dest', node([INSTALL, '--dest', dest, '--yes', '--no-launch']).status === 0);
  const doctor = node([INSTALL, 'doctor', '--dest', dest, '--root', work]);
  check('doctor passes on a good install', doctor.status === 0 && doctor.stdout.includes('skill'));
  check('doctor fails when skill missing', node([INSTALL, 'doctor', '--dest', join(work, 'nope')]).status === 1);
} finally {
  await rm(work, { recursive: true, force: true });
}

console.log('');
if (failures.length) {
  console.log(`✗ ${failures.length} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`✓ all ${passed} smoke checks passed`);
