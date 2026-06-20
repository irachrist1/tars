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
//
// Re-running is safe: if the installed version matches it says so; if it's older
// it updates in place and keeps your onboarding-seed.md.
//
// No dependencies, no network, no telemetry. Copies one folder; optionally launches Claude.

import { cp, mkdir, rm, stat, readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { readdirSync, statSync, writeSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, tmpdir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);
// First non-flag arg is a subcommand (so `tars use`, `tars doctor` work too).
const subcommand = argv[0] && !argv[0].startsWith('-') ? argv[0] : null;

const SKILL_NAME = 'chief-of-staff';
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', SKILL_NAME);
const userDest = join(homedir(), '.claude', 'skills', SKILL_NAME);

const PROMPT_SETUP = 'set up my chief of staff';
const PROMPT_CONTINUE = 'continue as my chief of staff';

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
// Skip the banner on machine-output paths: `--use` prints a single copy-paste
// block (Cowork / claude.ai), so anything before it would get pasted too.
if (!(has('--use') || subcommand === 'use')) banner();

// ---- option-based prompt: returns the chosen option object ------------------
// Always offers a write-your-own path: if none of the options is flagged
// freeText, a "Something else — let me type it" entry is appended. Picking a
// freeText option prompts for text and returns it on `.custom` (and `.label`).
// Pass { other: false } for genuinely closed/binary questions.
async function choose(question, options, { other = true } = {}) {
  const opts = (other && !options.some(o => o.freeText))
    ? [...options, { label: 'Something else — let me type it', key: 'other', freeText: true }]
    : options;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(`  ${question}`);
    opts.forEach((o, i) => console.log(`    ${i + 1}) ${o.label}`));
    const def = opts.findIndex(o => o.recommended);
    const defN = def >= 0 ? def + 1 : 1;
    const raw = (await rl.question(`  ↳ pick a number  [${defN}]  `)).trim();
    const n = parseInt(raw, 10);
    const idx = (!raw || isNaN(n) || n < 1 || n > opts.length) ? defN - 1 : n - 1;
    const chosen = opts[idx];
    if (chosen.freeText) {
      const typed = (await rl.question('  ↳ type it in a few words:  ')).trim();
      if (typed) { console.log(''); return { ...chosen, label: typed, custom: typed }; }
    }
    console.log('');
    return chosen;
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

// ---- help ------------------------------------------------------------------
if (has('--help') || has('-h') || subcommand === 'help') {
  console.log(`  tars — your AI's chief of staff

  Install / open
    npx tars-chief-of-staff            install the skill, then open Claude
    npx tars-chief-of-staff --update   update an installed copy in place
    npx tars-chief-of-staff --uninstall

  Use on a surface without skill upload (Cowork, claude.ai)
    npx tars-chief-of-staff --use            print a paste-ready prompt (wraps SKILL.md)
    npx tars-chief-of-staff --use --continue same, for an existing workspace

  Check / search
    npx tars-chief-of-staff doctor           health-check an install
    npx tars-chief-of-staff index <build|update|query|stats> ...   drive the local index

  With a global install (npm i -g tars-chief-of-staff) the same commands are
  available as:  tars · tars use · tars doctor · tars index …
`);
  process.exit(0);
}

// ---- --use : the cross-surface paste-wrap (Cowork / claude.ai) --------------
// Some surfaces can't install a skill. This prints a self-contained prompt that
// wraps SKILL.md and stages its supporting files to a temp dir, so the skill
// runs anywhere you can paste — the pattern Matt Pocock's `skills use` uses.
if (has('--use') || subcommand === 'use') {
  try { await readFile(join(SRC, 'SKILL.md'), 'utf8'); }
  catch { die(`cannot read ${join(SRC, 'SKILL.md')} — run from the tars package`); }
  const skillMd = await readFile(join(SRC, 'SKILL.md'), 'utf8');
  const request = val('--prompt') || (has('--continue') ? PROMPT_CONTINUE : PROMPT_SETUP);
  const staging = await mkdtemp(join(tmpdir(), 'tars-use-'));
  await cp(SRC, staging, { recursive: true });
  // Plain stdout (no banner) so the whole output is copy-pasteable as one block.
  // Write synchronously to fd 1: process.exit() does not flush an async pipe, so
  // a plain stdout.write() can be truncated before exit (notably on macOS).
  writeSync(1, `You are being given a Skill to run for the user's next request.

Use the following SKILL.md as your instructions:

<SKILL.md>
${skillMd.trimEnd()}
</SKILL.md>

This skill's supporting files (references/, scripts/) were staged at:
${staging}
When SKILL.md points to a relative path, read it from there.

User request: ${request}
`);
  process.exit(0);
}

// ---- index : thin wrapper over the skill's indexer -------------------------
// `tars index query "..." --root <dir>` instead of the long node path.
if (subcommand === 'index') {
  const r = spawnSync('node', [join(SRC, 'scripts', 'indexer.mjs'), ...argv.slice(1)], { stdio: 'inherit' });
  process.exit(r.status ?? 0);
}

// ---- doctor : is the install actually wired up? ----------------------------
if (subcommand === 'doctor' || has('--doctor')) {
  const readV = async (d) => (await readFile(join(d, 'VERSION'), 'utf8').catch(() => '')).trim();
  const dest = val('--dest') ? resolve(val('--dest')) : userDest;
  const work = val('--root') ? resolve(val('--root')) : detectWorkFolder();
  const rows = [];
  const add = (level, label, detail) => rows.push({ level, label, detail });

  // 1) skill installed and current?
  const srcV = (await readV(SRC)) || 'dev';
  const destV = await readV(dest);
  let installed = false;
  try { await stat(join(dest, 'SKILL.md')); installed = true; } catch {}
  if (!installed) add('FAIL', 'skill', `not installed at ${dest} — run: npx tars-chief-of-staff`);
  else if (destV && destV !== srcV) add('WARN', 'skill', `installed v${destV}, v${srcV} available — run --update`);
  else add('OK', 'skill', `v${destV || srcV} at ${dest}`);

  // 2) work folder known?
  if (work) add('OK', 'work folder', work);
  else add('WARN', 'work folder', 'not detected — pass --root or confirm on first run');

  // 3) local index built for that work folder?
  if (work) {
    const store = join(work, '.tars-index');
    const r = spawnSync('node', [join(SRC, 'scripts', 'indexer.mjs'), 'stats', '--store', store], { encoding: 'utf8' });
    const m = r.stdout && r.stdout.match(/documents:\s+(\d+)/);
    if (m && Number(m[1]) > 0) add('OK', 'local index', `${m[1]} documents`);
    else add('WARN', 'local index', `not built — run: npx tars-chief-of-staff index build --root "${work}"`);
  } else {
    add('WARN', 'local index', 'unknown until the work folder is set');
  }

  // 4) connectors reachable? (forward --tools so the session's mcp__* list can
  // be used on surfaces where `claude mcp list` can't run)
  const connArgs = [join(SRC, 'scripts', 'connectors.mjs'), '--json'];
  if (val('--tools')) connArgs.push('--tools', val('--tools'));
  const c = spawnSync('node', connArgs, { encoding: 'utf8' });
  let connN = -1;
  try { const d = JSON.parse(c.stdout || '{}'); connN = (d.connected || d.connectors || []).length; } catch {}
  if (connN > 0) add('OK', 'connectors', `${connN} mapped`);
  else add('WARN', 'connectors', 'none mapped here — enable in Claude (Settings → Connectors)');

  console.log('');
  ok('TARS doctor');
  for (const r of rows) console.log(`    [${r.level.padEnd(4)}] ${r.label.padEnd(13)} ${r.detail}`);
  const failed = rows.filter((r) => r.level === 'FAIL').length;
  console.log('');
  ok(failed ? `${failed} blocking issue(s) — fix the FAIL line(s) above.` : 'No blocking issues. Warnings are optional improvements.');
  console.log('');
  process.exit(failed ? 1 : 0);
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
  ok('A handful of taps and TARS knows who it works for. Let\'s go.');
  console.log('');

  const name = (await ask('What should I call you?', '')) || 'there';
  console.log('');

  const work = await choose('What\'s your work?', [
    { label: 'Consulting or advisory', key: 'consulting' },
    { label: 'Accounting or audit', key: 'accounting' },
    { label: 'Legal', key: 'legal' },
    { label: 'Founder or executive', key: 'founder' },
    { label: 'Software or engineering', key: 'engineering' },
    { label: 'Product or operations', key: 'product' },
    { label: 'Something else', key: 'other', freeText: true },
  ]);

  const found = detectWorkFolder();
  let workFolder;
  if (found) {
    const c = await choose(`I found your work folder at:\n     ${found}`, [
      { label: 'Yes, that\'s the one', key: 'yes', recommended: true },
      { label: 'It\'s somewhere else — paste the path', key: 'other', freeText: true },
      { label: 'I\'ll point you later', key: 'later' },
    ], { other: false });
    workFolder = c.key === 'yes' ? found : (c.custom || '(to be confirmed on first run)');
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

  // Cross-surface is part of setup, not a footnote (issue #1). Skills can't be
  // uploaded on Cowork / claude.ai / mobile — those run via the `--use` paste path.
  const surfaces = await choose('Besides here, where else will you use TARS?', [
    { label: 'Just here (Claude Code / Desktop)', key: 'local', recommended: true },
    { label: 'Also Cowork', key: 'cowork' },
    { label: 'Also claude.ai or mobile', key: 'web' },
    { label: 'Everywhere I use Claude', key: 'all' },
  ], { other: false });
  const crossSurface = surfaces.key !== 'local';

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
  }[guard.key] || guard.custom || guard.label.toLowerCase();

  const meetingsConnector = {
    m365: 'Microsoft 365 (Outlook mail + calendar)',
    google: 'Google Calendar',
    granola: 'Granola (or their notes app)',
    none: 'none yet — nudge them to connect a calendar so meeting prep works',
  }[meetings.key] || meetings.custom || meetings.label;

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
- other_surfaces: ${crossSurface ? `${surfaces.label} — also offer the cross-surface paste path ("npx tars-chief-of-staff --use")` : 'just this client'}
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
  }[meetings.key] || `Enable the connector for ${meetings.custom || meetings.label} in Claude (Settings → Connectors) so I can read it.`;
  ok('One thing turns everything on:');
  ok(`  ${connectorHint}`);
  console.log('');

  // Cross-surface: shown here (before the launch handoff, which exits) so it's
  // never buried. Tailored when the user said they'll use Cowork / web / mobile.
  if (crossSurface) {
    const where = { cowork: 'Cowork', web: 'claude.ai or mobile', all: 'Cowork, claude.ai, and mobile' }[surfaces.key] || 'those surfaces';
    ok(`To use TARS on ${where} — where you can't upload a skill — run this`);
    ok('in any terminal and paste the output into that chat as your first message:');
  } else {
    ok('Want TARS on Cowork, claude.ai, or mobile later (no skill upload there)? Run this');
    ok('any time and paste the output in as your first message:');
  }
  ok('  npx tars-chief-of-staff --use            (add --continue once that workspace exists)');
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
ok('TARS commands (these work right now, no global install needed):');
ok('  npx tars-chief-of-staff doctor       health-check this install');
ok('  npx tars-chief-of-staff --use        paste-ready prompt for Cowork / claude.ai / mobile');
ok('  npx tars-chief-of-staff index query "…" --root "<work folder>"');
ok('Prefer a short `tars` command? Install it once:  npm i -g tars-chief-of-staff');
console.log('');
ok('If your work lives in Microsoft 365, enable the Microsoft 365 connector in your');
ok('Claude client (Settings → Connectors) so it can read your files, mail, and calendar.');
console.log('');
ok('Built by Christian Tonny · github.com/irachrist1');
console.log('');
