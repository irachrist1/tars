#!/usr/bin/env node
// install.mjs — put the chief-of-staff skill where Claude looks for skills.
//
//   npx tars-chief-of-staff               # install for the current user (~/.claude/skills)
//   npx tars-chief-of-staff --project     # install into ./.claude/skills (this repo only)
//   npx tars-chief-of-staff --dest <dir>  # install somewhere explicit
//   npx tars-chief-of-staff --uninstall   # remove an installed copy
//
// No dependencies, no network, no telemetry. Copies one folder, prints next steps.

import { cp, mkdir, rm, stat, readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);

const SKILL_NAME = 'chief-of-staff';
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', SKILL_NAME);

const dest = val('--dest')
  ? resolve(val('--dest'))
  : has('--project')
    ? resolve('.claude', 'skills', SKILL_NAME)
    : join(homedir(), '.claude', 'skills', SKILL_NAME);

const ok = (m) => console.log(`  ${m}`);
const die = (m) => { console.error(`  error: ${m}`); process.exit(1); };

if (has('--uninstall')) {
  try { await stat(dest); } catch { die(`nothing installed at ${dest}`); }
  await rm(dest, { recursive: true });
  ok(`removed ${dest}`);
  process.exit(0);
}

// Sanity: make sure we're shipping a real skill, not an empty folder.
try {
  const head = await readFile(join(SRC, 'SKILL.md'), 'utf8');
  if (!head.includes(`name: ${SKILL_NAME}`)) die('source SKILL.md looks wrong — refusing to install');
} catch {
  die(`cannot read ${join(SRC, 'SKILL.md')} — run from the tars package`);
}

// Refuse to silently clobber a copy the user may have edited, unless --force.
let exists = false;
try { await stat(dest); exists = true; } catch {}
if (exists && !has('--force')) {
  die(`already installed at ${dest}\n  re-run with --force to overwrite (your workspace in OneDrive is untouched either way)`);
}

await mkdir(dirname(dest), { recursive: true });
if (exists) await rm(dest, { recursive: true });
await cp(SRC, dest, { recursive: true });

console.log('');
ok(`chief-of-staff installed → ${dest}`);
console.log('');
ok('Next steps:');
ok('  1. If your work email/calendar/files are Microsoft 365: enable the');
ok('     Microsoft 365 connector in your Claude client (Settings → Connectors).');
ok('     Ask IT/admin if it is not listed — that is the only technical step.');
ok('  2. Open Claude and say:  "set up my chief of staff"');
ok('');
ok('It interviews you like a new hire, reads your work folder with consent,');
ok('and proves itself on a real question before the first session ends.');
console.log('');
