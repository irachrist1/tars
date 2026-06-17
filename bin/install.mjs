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

import { cp, mkdir, rm, stat, readFile, writeFile } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
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

// ---- branding --------------------------------------------------------------
function banner() {
  console.log('');
  console.log('  ████████╗ █████╗ ██████╗ ███████╗');
  console.log('  ╚══██╔══╝██╔══██╗██╔══██╗██╔════╝');
  console.log('     ██║   ███████║██████╔╝███████╗');
  console.log('     ██║   ██╔══██║██╔══██╗╚════██║');
  console.log('     ██║   ██║  ██║██║  ██║███████║');
  console.log('     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝');
  console.log('  Give your AI the context it needs to deliver.');
  console.log('  by Christian Tonny · github.com/irachrist1/tars');
  console.log('');
}
banner();

// ---- option-based prompt: returns the chosen option object ------------------
async function choose(question, options) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(`  ${question}`);
    options.forEach((o, i) => console.log(`    ${i + 1}) ${o.label}`));
    const def = options.findIndex(o => o.recommended);
    const defN = def >= 0 ? def + 1 : 1;
    const raw = (await rl.question(`  ↳ pick a number  [${defN}]  `)).trim();
    const n = parseInt(raw, 10);
    const idx = (!raw || isNaN(n) || n < 1 || n > options.length) ? defN - 1 : n - 1;
    console.log('');
    return options[idx];
  } finally { rl.close(); }
}

// ---- auto-detect the work folder (OneDrive) --------------------------------
function detectWorkFolder() {
  const home = homedir();
  const candidates = [];
  if (process.platform === 'darwin') {
    const cs = join(home, 'Library', 'CloudStorage');
    try {
      for (const d of readdirSync(cs)) {
        if (/^OneDrive/i.test(d)) candidates.push(join(cs, d));
      }
    } catch {}
  }
  for (const name of ['OneDrive', 'OneDrive - Personal']) {
    const p = join(home, name);
    try { if (statSync(p).isDirectory()) candidates.push(p); } catch {}
  }
  // prefer an org variant ("OneDrive - <Company>") — that's the work one
  const org = candidates.find(p => /OneDrive\s*-\s*\S/i.test(p));
  return org || candidates[0] || null;
}

async function ask(question, def) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const a = (await rl.question(`  ${question} `)).trim();
    return a || def;
  } finally { rl.close(); }
}

function claudeAvailable() { return cliAvailable('claude'); }

// Is a CLI on PATH and runnable?
function cliAvailable(cmd) {
  try {
    const r = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
    return !r.error && r.status === 0;
  } catch { return false; }
}

// Is a GUI app installed? macOS only — returns null elsewhere so we never give
// install advice on a platform we can't actually check.
function macAppInstalled(name) {
  if (process.platform !== 'darwin') return null;
  for (const base of ['/Applications', join(homedir(), 'Applications')]) {
    try { if (statSync(join(base, `${name}.app`)).isDirectory()) return true; } catch {}
  }
  return false;
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
else dest = userDest; // default to user scope; the interview can refine nothing here

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
ok(`✓ installed → ${dest}`);
console.log('');

// ---- the interview: get most of the setup done before Claude opens ---------
// Short, mostly taps, no typing except your name. Writes a seed the skill reads
// on first run so it skips the questions and goes straight to proving itself.
if (interactive) {
  ok('Five taps and TARS knows who it works for. Let\'s go.');
  console.log('');

  const name = (await ask('What should I call you?', '')) || 'there';
  console.log('');

  const work = await choose('What\'s your work?', [
    { label: 'Consulting or advisory', key: 'consulting' },
    { label: 'Accounting or audit', key: 'accounting' },
    { label: 'Legal', key: 'legal' },
    { label: 'Founder or executive', key: 'founder' },
    { label: 'Something else', key: 'other' },
  ]);

  const found = detectWorkFolder();
  let workFolder;
  if (found) {
    const c = await choose(`I found your work folder at:\n     ${found}`, [
      { label: 'Yes, that\'s the one', key: 'yes', recommended: true },
      { label: 'It\'s somewhere else (I\'ll point you later)', key: 'later' },
    ]);
    workFolder = c.key === 'yes' ? found : '(to be confirmed on first run)';
  } else {
    workFolder = '(to be detected on first run)';
  }

  // Meetings/notes are the spine of "prep me for the 3pm call" — capture where
  // they live so the skill knows which connector to lean on on first run.
  const meetings = await choose('Where do your meetings and notes live?  (this is what makes "prep me for the 3pm call" work)', [
    { label: 'Outlook / Microsoft 365', key: 'm365', recommended: true },
    { label: 'Google Calendar', key: 'google' },
    { label: 'Granola or another notes app', key: 'granola' },
    { label: 'Mostly in my head — nothing set up yet', key: 'none' },
  ]);

  // TARS runs inside Claude today. Be honest about that rather than implying
  // a ChatGPT path that doesn't exist yet.
  const tools = await choose('TARS runs inside Claude today (ChatGPT is coming). Do you also use ChatGPT?', [
    { label: 'Just Claude', key: 'claude', recommended: true },
    { label: 'Claude and ChatGPT', key: 'both' },
    { label: 'Mostly ChatGPT — I\'ll try it in Claude', key: 'chatgpt' },
  ]);

  const guard = await choose('What should TARS never do without asking you first?', [
    { label: 'Send email', key: 'email' },
    { label: 'Delete or overwrite my files', key: 'files' },
    { label: 'Post anywhere on my behalf', key: 'post' },
    { label: 'All of the above', key: 'all', recommended: true },
  ]);

  const guardText = {
    email: 'send email',
    files: 'delete or overwrite files',
    post: 'post anywhere on my behalf',
    all: 'send email, delete or overwrite files, or post anywhere on my behalf',
  }[guard.key];

  const meetingsConnector = {
    m365: 'Microsoft 365 (Outlook mail + calendar)',
    google: 'Google Calendar',
    granola: 'Granola (or their notes app)',
    none: 'none yet — nudge them to connect a calendar so meeting prep works',
  }[meetings.key];

  // write the seed the skill reads on first run
  const seed = `# Onboarding seed
Captured by the installer on ${new Date().toISOString().slice(0, 10)}. This is the
user's own setup. On first run, adopt these answers, do NOT re-ask them. Confirm
the work folder, make sure the connector for their meetings is enabled, then
prove yourself on a real meeting prep ("prep me for the 3pm call") with a citation.

- name: ${name}
- work: ${work.label} (${work.key})
- work_folder: ${workFolder}
- meetings_and_notes: ${meetingsConnector}
- primary_ai: ${tools.label}
- never_without_asking: ${guardText}
`;
  try {
    await writeFile(join(dest, 'onboarding-seed.md'), seed, 'utf8');
  } catch {}

  console.log('');
  ok(`Perfect, ${name}. Here's what I've got:`);
  ok(`  · ${work.label}`);
  ok(`  · Work folder: ${workFolder}`);
  ok(`  · Meetings & notes: ${meetings.label}`);
  ok(`  · Running in Claude${tools.key === 'claude' ? '' : ' (ChatGPT support is coming)'}`);
  ok(`  · I'll never ${guardText} without asking`);
  console.log('');

  // The connector is what unlocks meeting prep — make it step one, not a footnote.
  const connectorHint = {
    m365: 'Enable the Microsoft 365 connector in Claude (Settings → Connectors) so I can read your mail, calendar, and files.',
    google: 'Enable the Google Calendar connector in Claude (Settings → Connectors) so I can see your meetings.',
    granola: 'Enable the Granola connector in Claude (Settings → Connectors) so I can read your meeting notes.',
    none: 'When you\'re ready, connect a calendar in Claude (Settings → Connectors) and meeting prep switches on.',
  }[meetings.key];
  ok('One thing turns everything on:');
  ok(`  ${connectorHint}`);
  console.log('');

  // Suggest (never push) the apps that make TARS materially better. Only on
  // macOS, where we can actually check; one plain line on WHY each helps.
  const suggestions = [];
  if (macAppInstalled('Obsidian') === false) {
    suggestions.push('Obsidian (free) — a home for your notes in plain files you own. TARS can read and write it, so your context never gets locked in one app.  obsidian.md');
  }
  if (macAppInstalled('Granola') === false) {
    suggestions.push('Granola — it writes your meeting notes for you. Then "prep me for the 3pm call" has the real transcript to work from, not your memory.  granola.ai');
  }
  if (!claudeAvailable() && macAppInstalled('Claude') === false) {
    suggestions.push('Claude (Desktop or Code) — TARS lives inside it. This is the one worth installing first.  claude.ai/download');
  }
  if (suggestions.length) {
    ok('A few apps would make TARS noticeably sharper (all optional, all your call):');
    for (const s of suggestions) ok(`  · ${s}`);
    console.log('');
  }

  ok('Then I\'ll read your work and prep you for a real meeting.');
  console.log('');
}

// ---- if we got here the Node path succeeded; log it for the agent ----------
// (The curl/PowerShell paths in install.sh / Install-Tars.ps1 are the fallback
// for machines without Node. Agents that can't run npx should use those instead.)

// ---- now actually start it -------------------------------------------------
// Prefer Claude Code, fall back to Codex — either way we hand off into a coding
// agent that reads the seed and continues with all the context just captured.
const claude = claudeAvailable();
const codex = cliAvailable('codex');
const runner = claude ? { cmd: 'claude', name: 'Claude Code' }
             : codex  ? { cmd: 'codex',  name: 'Codex' }
             : null;

if (interactive && runner && !has('--no-launch')) {
  const a = await ask(`Continue in ${runner.name} now and set up your chief of staff?  [Y/n]`, 'y');
  if (!a.toLowerCase().startsWith('n')) {
    ok(`Opening ${runner.name}…  it picks up everything you just told me.`);
    console.log('');
    const r = spawnSync(runner.cmd, ['set up my chief of staff'], { stdio: 'inherit' });
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
} else if (runner) {
  ok('Pick it back up any time with:');
  ok(`  ${runner.cmd} "set up my chief of staff"`);
} else {
  ok('Open Claude (Desktop, Code, claude.ai, or mobile) and say:');
  ok('  set up my chief of staff');
}

console.log('');
ok('If your work lives in Microsoft 365, enable the Microsoft 365 connector in your');
ok('Claude client (Settings → Connectors) so it can read your files, mail, and calendar.');
console.log('');
ok('Built by Christian Tonny · github.com/irachrist1');
console.log('');
