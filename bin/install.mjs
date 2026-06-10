#!/usr/bin/env node
// install.mjs — put the chief-of-staff skill where Claude looks for skills, then
// (if Claude Code is here and you're at a terminal) open Claude and start setup.
//
//   npx tars-chief-of-staff               # interactive at a terminal; sensible defaults otherwise
//   npx tars-chief-of-staff --project     # install into ./.claude/skills (this folder only)
//   npx tars-chief-of-staff --dest <dir>  # install somewhere explicit
//   npx tars-chief-of-staff --yes         # take defaults, no questions (user scope)
//   npx tars-chief-of-staff --no-launch   # install only, never open Claude
//   npx tars-chief-of-staff --uninstall   # remove an installed copy
//
// No dependencies, no network, no telemetry. Copies one folder; optionally launches Claude.

import { cp, mkdir, rm, stat, readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);

const SKILL_NAME = 'chief-of-staff';
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', SKILL_NAME);
const userDest = join(homedir(), '.claude', 'skills', SKILL_NAME);

// A real person at a terminal vs. an agent/CI running us through a pipe.
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY) && !has('--yes');

const ok = (m) => console.log(`  ${m}`);
const die = (m) => { console.error(`  error: ${m}`); process.exit(1); };

async function ask(question, def) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const a = (await rl.question(`  ${question} `)).trim();
    return a || def;
  } finally { rl.close(); }
}

function claudeAvailable() {
  try {
    const r = spawnSync('claude', ['--version'], { stdio: 'ignore' });
    return !r.error && r.status === 0;
  } catch { return false; }
}

// ---- uninstall -------------------------------------------------------------
if (has('--uninstall')) {
  const target = val('--dest') ? resolve(val('--dest')) : userDest;
  try { await stat(target); } catch { die(`nothing installed at ${target}`); }
  await rm(target, { recursive: true });
  ok(`removed ${target}`);
  process.exit(0);
}

// ---- sanity: we are shipping a real skill ----------------------------------
try {
  const head = await readFile(join(SRC, 'SKILL.md'), 'utf8');
  if (!head.includes(`name: ${SKILL_NAME}`)) die('source SKILL.md looks wrong — refusing to install');
} catch {
  die(`cannot read ${join(SRC, 'SKILL.md')} — run from the tars package`);
}

// ---- where does it go ------------------------------------------------------
let dest;
if (val('--dest')) dest = resolve(val('--dest'));
else if (has('--project')) dest = resolve('.claude', 'skills', SKILL_NAME);
else if (interactive) {
  const choice = await ask('Install for (1) just me, or (2) this folder only?  [1]', '1');
  dest = choice.startsWith('2') ? resolve('.claude', 'skills', SKILL_NAME) : userDest;
} else dest = userDest;

// ---- don't clobber an edited copy silently ---------------------------------
let exists = false;
try { await stat(dest); exists = true; } catch {}
if (exists && !has('--force')) {
  if (interactive) {
    const a = await ask('Already installed here — overwrite?  [y/N]', 'n');
    if (!a.toLowerCase().startsWith('y')) { ok('Left the existing install untouched.'); process.exit(0); }
  } else {
    die(`already installed at ${dest}\n  re-run with --force to overwrite (your workspace in OneDrive is untouched either way)`);
  }
}

// ---- copy ------------------------------------------------------------------
await mkdir(dirname(dest), { recursive: true });
if (exists) await rm(dest, { recursive: true });
await cp(SRC, dest, { recursive: true });

console.log('');
ok(`✓ chief-of-staff installed → ${dest}`);
console.log('');

// ---- if we got here the Node path succeeded; log it for the agent ----------
// (The curl/PowerShell paths in install.sh / Install-Tars.ps1 are the fallback
// for machines without Node. Agents that can't run npx should use those instead.)

// ---- now actually start it -------------------------------------------------
const claude = claudeAvailable();

if (interactive && claude && !has('--no-launch')) {
  const a = await ask('Open Claude now and set up your chief of staff?  [Y/n]', 'y');
  if (!a.toLowerCase().startsWith('n')) {
    ok('Opening Claude…');
    console.log('');
    const r = spawnSync('claude', ['set up my chief of staff'], { stdio: 'inherit' });
    process.exit(r.status ?? 0);
  }
}

// Not launching — tell whoever (or whatever) is reading how to start it.
if (!interactive) {
  // An agent ran us (no TTY). Speak directly to it.
  ok('Agent: do not stop here. The skill is installed. Read');
  ok(`  ${join(dest, 'SKILL.md')}`);
  ok('then follow it now — it checks for an existing setup and either adopts it');
  ok('or runs onboarding (first question: where their work is kept).');
  ok('The skill loads automatically in future sessions.');
} else if (claude) {
  ok('Start it any time with:');
  ok('  claude "set up my chief of staff"');
} else {
  ok('Open Claude (app, claude.ai, or mobile) and say:');
  ok('  set up my chief of staff');
}

console.log('');
ok('If your work lives in Microsoft 365, enable the Microsoft 365 connector in your');
ok('Claude client (Settings → Connectors) so it can read your files, mail, and calendar.');
console.log('');
