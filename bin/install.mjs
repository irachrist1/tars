#!/usr/bin/env node
// install.mjs — put the chief-of-staff skill where Claude looks for skills, then
// (if Claude Code is here and you're at a terminal) open Claude and start setup.
//
//   npx tars-chief-of-staff               # interactive at a terminal; sensible defaults otherwise
//   npx tars-chief-of-staff --project     # install into ./.claude/skills (this folder only)
//   npx tars-chief-of-staff --dest <dir>  # install somewhere explicit
//   npx tars-chief-of-staff --yes         # take defaults, no questions (user scope)
//   npx tars-chief-of-staff --update      # update an existing install in place
//   npx tars-chief-of-staff --no-launch   # install only, never open Claude
//   npx tars-chief-of-staff --uninstall   # remove an installed copy
//   npx tars-chief-of-staff --use         # paste-ready prompt for Cowork/claude.ai (skills.sh style)
//   npx tars-chief-of-staff --use --agent claude-code   # launch Claude Code with the skill loaded
//
// Short command (npm i -g tars-chief-of-staff → `tars` on PATH, works from any directory):
//   tars                  # install if needed, then open Claude with the right prompt
//   tars open             # same
//   tars install          # full interview + install (same as npx tars-chief-of-staff)
//   tars use              # paste-ready prompt for Cowork / claude.ai
//   tars help
//
// Re-running is safe: if the installed version matches it says so; if it's older
// it updates in place and keeps your onboarding-seed.md.
//
// No dependencies, no network, no telemetry. Copies one folder; optionally launches Claude.

import { cp, mkdir, rm, stat, readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, tmpdir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);

const invokedAs = process.argv[1]?.split(/[/\\]/).pop() ?? '';
const isTarsCmd = invokedAs === 'tars';

let subcommand = null;
if (argv[0] && !argv[0].startsWith('-')) {
  const subs = new Set(['open', 'start', 'install', 'use', 'help']);
  if (subs.has(argv[0])) subcommand = argv.shift();
}

const SKILL_NAME = 'chief-of-staff';
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', SKILL_NAME);
const userDest = join(homedir(), '.claude', 'skills', SKILL_NAME);

let dest = userDest;
if (val('--dest')) dest = resolve(val('--dest'));
else if (has('--project')) dest = resolve('.claude', 'skills', SKILL_NAME);

// A real person at a terminal vs. an agent/CI running us through a pipe.
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY) && !has('--yes');

const ok = (m) => console.log(`  ${m}`);
const die = (m) => { console.error(`  error: ${m}`); process.exit(1); };

const PROMPT_SETUP = 'set up my chief of staff';
const PROMPT_CONTINUE = 'continue as my chief of staff';

function printCopyablePrompt(prompt) {
  const inner = `  ${prompt}  `;
  const width = Math.max(inner.length, 42);
  const bar = '─'.repeat(width - 2);
  console.log('');
  ok('Copy and paste this into Claude (Cowork, claude.ai, Desktop, Code, or mobile):');
  console.log('');
  console.log(`  ┌${bar}┐`);
  console.log(`  │${inner.padEnd(width - 2)}│`);
  console.log(`  └${bar}┘`);
  console.log('');
}

function tryCopyToClipboard(text) {
  try {
    if (process.platform === 'darwin') {
      const r = spawnSync('pbcopy', { input: text });
      return !r.error && r.status === 0;
    }
    if (process.platform === 'win32') {
      const r = spawnSync('clip', { input: text, shell: true });
      return !r.error && r.status === 0;
    }
    for (const [cmd, ...args] of [['xclip', '-selection', 'clipboard'], ['wl-copy']]) {
      const r = spawnSync(cmd, args, { input: text });
      if (!r.error && r.status === 0) return true;
    }
  } catch {}
  return false;
}

function openClaudeDesktop() {
  if (process.platform !== 'darwin') return false;
  const r = spawnSync('open', ['-a', 'Claude'], { stdio: 'ignore' });
  return !r.error && r.status === 0;
}

// skills.sh-style `--use`: wrap SKILL.md for paste into any Claude surface, or launch an agent.
async function emitUsePrompt(userRequest = PROMPT_SETUP) {
  const skillMd = await readFile(join(SRC, 'SKILL.md'), 'utf8');
  const staging = await mkdtemp(join(tmpdir(), 'tars-use-'));
  await cp(SRC, staging, { recursive: true });
  console.log(`You are being given a Skill to execute for the user's next request.

Use the following SKILL.md as your instructions:

<SKILL.md>
${skillMd.trimEnd()}
</SKILL.md>

Supporting files for this skill were copied to:
${staging}

When the SKILL.md references relative paths, read them from that directory.

User request: ${userRequest}`);
}

async function runUseMode() {
  const userRequest = val('--prompt') || (has('--continue') ? PROMPT_CONTINUE : PROMPT_SETUP);
  const agent = val('--agent');

  if (agent) {
    const cmd = agent === 'codex' ? 'codex' : 'claude';
    if (!cliAvailable(cmd)) die(`Could not launch ${cmd}: command not found`);
    const staging = await mkdtemp(join(tmpdir(), 'tars-use-'));
    await cp(SRC, staging, { recursive: true });
    const skillMd = await readFile(join(SRC, 'SKILL.md'), 'utf8');
    const wrapped = `You are being given a Skill to execute for the user's next request.

Use the following SKILL.md as your instructions:

<SKILL.md>
${skillMd.trimEnd()}
</SKILL.md>

Supporting files: ${staging}

User request: ${userRequest}`;
    const r = spawnSync(cmd, [wrapped], { stdio: 'inherit', cwd: staging });
    process.exit(r.status ?? 0);
  }

  await emitUsePrompt(userRequest);
}

function printHelp() {
  console.log(`
TARS — give your AI the context it needs to deliver.

Usage:
  tars                    Open in Claude from any directory (installs if needed)
  tars open               Same as tars
  tars install            Full setup interview + install
  tars use                Full skill wrap for Cowork / claude.ai (paste)
  tars use --continue     Handoff prompt after setup

  npx tars-chief-of-staff           Full install (same as tars install)
  npx tars-chief-of-staff --use     Paste-ready prompt
  npx tars-chief-of-staff --update  Refresh installed skill

Install globally for the short command:
  npm install -g tars-chief-of-staff
  tars                  # works anywhere

Options (install / open):
  --project             Install into ./.claude/skills (this repo only)
  --dest <dir>          Custom install path
  --yes                 Skip interview questions
  --no-launch           Install only, do not open Claude
  --agent claude-code   Launch agent with --use output
`);
}

async function skillInstalledAt(dir) {
  try { await stat(join(dir, 'SKILL.md')); return true; } catch { return false; }
}

async function workspaceMapExists() {
  const base = detectWorkFolder();
  if (!base) return false;
  try { await stat(join(base, 'Chief of Staff', 'MAP.md')); return true; } catch {}
  return false;
}

async function openPromptFor(dest) {
  try { await stat(join(dest, 'onboarding-seed.md')); return PROMPT_SETUP; } catch {}
  if (await workspaceMapExists()) return PROMPT_CONTINUE;
  return PROMPT_SETUP;
}

async function ensureSkillInstalled(dest) {
  if (await skillInstalledAt(dest)) return false;
  await mkdir(dirname(dest), { recursive: true });
  await cp(SRC, dest, { recursive: true });
  const v = (await readFile(join(SRC, 'VERSION'), 'utf8').catch(() => '')).trim();
  if (v) await writeFile(join(dest, 'VERSION'), v + '\n', 'utf8');
  return true;
}

async function launchAgent(prompt) {
  const claude = cliAvailable('claude');
  const codex = cliAvailable('codex');
  const runner = claude ? { cmd: 'claude', name: 'Claude Code' }
               : codex  ? { cmd: 'codex',  name: 'Codex' }
               : null;
  if (runner) {
    ok(`Opening ${runner.name}…`);
    console.log('');
    const r = spawnSync(runner.cmd, [prompt], { stdio: 'inherit' });
    process.exit(r.status ?? 0);
  }
  if (openClaudeDesktop()) {
    ok('Opened Claude Desktop — paste this when it\'s ready:');
    printCopyablePrompt(prompt);
    if (tryCopyToClipboard(prompt)) ok('(Copied to clipboard.)');
    process.exit(0);
  }
  printCopyablePrompt(prompt);
  ok('Install Claude Code for one-command launch, or:  tars use');
  if (tryCopyToClipboard(prompt)) ok('(Copied to clipboard.)');
  process.exit(0);
}

async function runOpenMode(dest = userDest) {
  const fresh = await ensureSkillInstalled(dest);
  if (fresh) {
    ok('✓ chief-of-staff installed');
    ok('  Tip: run `tars install` once for a personalized setup.');
    console.log('');
  }
  const prompt = await openPromptFor(dest);
  if (has('--no-launch')) {
    await offerHandoff(prompt);
    return;
  }
  if (interactive && !has('--yes')) {
    await offerHandoff(prompt);
    return;
  }
  await launchAgent(prompt);
}

// ---- routing ---------------------------------------------------------------
if (has('--use') || subcommand === 'use') {
  await runUseMode();
  process.exit(0);
}

if (subcommand === 'help' || has('--help') || has('-h')) {
  printHelp();
  process.exit(0);
}

if (has('--uninstall')) {
  const target = val('--dest') ? resolve(val('--dest')) : userDest;
  try { await stat(target); } catch { die(`nothing installed at ${target}`); }
  await rm(target, { recursive: true });
  ok(`removed ${target}`);
  process.exit(0);
}

const wantsOpen = isTarsCmd && (!subcommand || subcommand === 'open' || subcommand === 'start');
if (wantsOpen) {
  await runOpenMode(dest);
  process.exit(0);
}

// `tars install` and `npx tars-chief-of-staff` fall through to full setup below.

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
function findNestedOrgOneDrive(dir, depth = 0, maxDepth = 2) {
  const found = [];
  if (depth > maxDepth) return found;
  let entries;
  try { entries = readdirSync(dir); } catch { return found; }
  for (const name of entries) {
    const p = join(dir, name);
    try { if (!statSync(p).isDirectory()) continue; } catch { continue; }
    if (/^OneDrive\s*-\s*\S/i.test(name) && !/personal/i.test(name)) found.push(p);
    if (depth < maxDepth) found.push(...findNestedOrgOneDrive(p, depth + 1, maxDepth));
  }
  return found;
}

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
  if (process.platform === 'win32') {
    try {
      for (const name of readdirSync(home)) {
        if (!/^OneDrive/i.test(name)) continue;
        const top = join(home, name);
        try { if (statSync(top).isDirectory()) candidates.push(top); } catch {}
        candidates.push(...findNestedOrgOneDrive(top));
      }
    } catch {}
  } else {
    for (const name of ['OneDrive', 'OneDrive - Personal']) {
      const p = join(home, name);
      try { if (statSync(p).isDirectory()) candidates.push(p); } catch {}
    }
  }
  const unique = [...new Set(candidates)];
  const org = unique.find(p => /OneDrive\s*-\s*\S/i.test(p) && !/personal/i.test(p));
  return org || unique[0] || null;
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

async function offerHandoff(prompt) {
  if (!interactive) {
    ok('Agent: do not stop here. The skill is installed. Read');
    ok(`  ${join(dest, 'SKILL.md')}`);
    ok('then follow it now — it checks for an existing setup and either adopts it');
    ok('or runs onboarding (first question: where their work is kept).');
    ok('The skill loads automatically in future sessions.');
    printCopyablePrompt(prompt);
    return;
  }

  if (has('--no-launch')) {
    ok('Start in Claude — pick one:');
    ok(`  1. Claude Code:  claude "${prompt}"`);
    ok('  2. Cowork / claude.ai — copy the prompt below:');
    printCopyablePrompt(prompt);
    return;
  }

  const claude = claudeAvailable();
  const codex = cliAvailable('codex');
  const runner = claude ? { cmd: 'claude', name: 'Claude Code' }
               : codex  ? { cmd: 'codex',  name: 'Codex' }
               : null;

  const handoff = await choose('How do you want to start in Claude?', [
    { label: runner
        ? `Open ${runner.name} now — launch it with the prompt`
        : 'Open Claude Desktop — then paste the prompt (macOS)',
      key: 'launch',
      recommended: Boolean(runner || process.platform === 'darwin'),
    },
    { label: 'Copy the prompt — I\'ll paste it into Cowork or claude.ai myself', key: 'copy' },
  ]);

  if (handoff.key === 'launch') {
    if (runner) {
      ok(`Opening ${runner.name} with your prompt…`);
      console.log('');
      const r = spawnSync(runner.cmd, [prompt], { stdio: 'inherit' });
      process.exit(r.status ?? 0);
    }
    if (openClaudeDesktop()) {
      ok('Opened Claude Desktop. Paste this when it\'s ready:');
      printCopyablePrompt(prompt);
      if (tryCopyToClipboard(prompt)) ok('(Also copied to your clipboard.)');
      return;
    }
    ok('Could not launch Claude from here. Use the copyable prompt instead:');
    printCopyablePrompt(prompt);
    if (tryCopyToClipboard(prompt)) ok('(Copied to your clipboard.)');
    return;
  }

  if (handoff.key === 'copy') {
    printCopyablePrompt(prompt);
    ok('For Cowork without the skill uploaded yet, run:  tars use');
    if (tryCopyToClipboard(prompt)) ok('Copied the short prompt to your clipboard.');
    return;
  }
}

// ---- sanity: we are shipping a real skill ----------------------------------
try {
  const head = await readFile(join(SRC, 'SKILL.md'), 'utf8');
  if (!head.includes(`name: ${SKILL_NAME}`)) die('source SKILL.md looks wrong — refusing to install');
} catch {
  die(`cannot read ${join(SRC, 'SKILL.md')} — run from the tars package`);
}

// ---- where does it go (dest resolved at top; --dest / --project already applied) -
// ---- version awareness: install fresh, update in place, or skip if current -
const readVersion = async (dir) =>
  (await readFile(join(dir, 'VERSION'), 'utf8').catch(() => '')).trim();
const srcVersion = (await readVersion(SRC)) || 'dev';

let exists = false;
try { await stat(join(dest, 'SKILL.md')); exists = true; } catch {}
const destVersion = exists ? await readVersion(dest) : '';

if (exists && destVersion === srcVersion && !has('--force') && !has('--update')) {
  ok(`✓ already up to date (v${srcVersion}) at ${dest}`);
  if (interactive) {
    const a = await ask('Reinstall anyway?  [y/N]', 'n');
    if (!a.toLowerCase().startsWith('y')) { ok('Nothing to do.'); process.exit(0); }
  } else {
    ok('Re-run with --force to reinstall.');
    process.exit(0);
  }
} else if (exists && destVersion && destVersion !== srcVersion) {
  ok(`Updating v${destVersion} → v${srcVersion} (keeping your onboarding-seed.md)…`);
}

// ---- copy (preserving the user's onboarding seed across updates) -----------
await mkdir(dirname(dest), { recursive: true });
const seedPath = join(dest, 'onboarding-seed.md');
let savedSeed = null;
if (exists) { try { savedSeed = await readFile(seedPath, 'utf8'); } catch {} }
if (exists) await rm(dest, { recursive: true });
await cp(SRC, dest, { recursive: true });
if (savedSeed !== null) { try { await writeFile(seedPath, savedSeed, 'utf8'); } catch {} }

console.log('');
ok(`✓ installed v${srcVersion} → ${dest}`);
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

  const surfaces = await choose('Where will you use your chief of staff?', [
    { label: 'Claude Code (terminal) + Cowork + claude.ai — everywhere', key: 'all', recommended: true },
    { label: 'Mostly Cowork / claude.ai (browser)', key: 'web' },
    { label: 'Claude Code only (terminal)', key: 'code' },
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
- surfaces: ${surfaces.label} (${surfaces.key})
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
  ok(`  · Surfaces: ${surfaces.label}`);
  ok(`  · I'll never ${guardText} without asking`);
  console.log('');

  if (surfaces.key !== 'code') {
    ok('One more step so it works on Cowork and claude.ai (not just this machine):');
    ok('  npm run package  → dist/chief-of-staff.zip  (from the TARS repo)');
    ok('  Claude → Customize → Skills → + → Upload a skill');
    ok('  See references/publishing.md in the skill folder for details.');
    console.log('');
  }

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
  if (macAppInstalled('Daylens') === false) {
    suggestions.push('Daylens — automatic memory of what you actually did on your laptop. Feeds TARS real behavior, so "what did I get done this week" answers itself.  github.com/irachrist1/daylens');
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

// ---- hand off into Claude: launch or copyable prompt -----------------------
await offerHandoff(PROMPT_SETUP);

console.log('');
ok('If your work lives in Microsoft 365, enable the Microsoft 365 connector in your');
ok('Claude client (Settings → Connectors) so it can read your files, mail, and calendar.');
console.log('');
ok('Built by Christian Tonny · github.com/irachrist1');
console.log('');
