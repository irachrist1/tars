#!/usr/bin/env node
// scaffold-vault.mjs — write the second brain from templates + a profile.
// Pure file work. Renders {{tokens}} (the scaffolder computes the markdown
// blocks; templates stay simple). Folder set is driven by archetypes and
// detected capabilities, so a developer-consultant gets different folders than
// a student. Produces a working vault even with zero integrations.
//
// Usage:
//   node scaffold-vault.mjs --profile profile.json --dest "/path/to/vault"
//   node scaffold-vault.mjs --profile profile.json --dest ./out --dry-run
//
// profile.json (all fields optional; synthetic defaults fill the gaps):
//   { "user_name", "identity_summary", "archetypes": [..],
//     "interface": "conversation|notion|obsidian",
//     "capabilities": <normalize.mjs output .capabilities> }

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const TPL = join(here, '../../templates/vault');

// ---- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (f, d) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const DRY = argv.includes('--dry-run');
const dest = arg('--dest', null);
const profilePath = arg('--profile', null);
if (!dest) { console.error('error: --dest <vault path> is required'); process.exit(1); }

// ---- profile + synthetic defaults -----------------------------------------
const profile = profilePath ? JSON.parse(readFileSync(profilePath, 'utf8')) : {};
const P = {
  user_name: profile.user_name || 'Jane Student',
  identity_summary: profile.identity_summary ||
    'A multi-hat operator who studies, builds, and ships. Lives across a few tools and wants one place that connects them. Optimizes for momentum over polish.',
  archetypes: profile.archetypes && profile.archetypes.length ? profile.archetypes : ['student'],
  interface: profile.interface || 'conversation',
  capabilities: profile.capabilities || {},
};

// ---- capability presentation ----------------------------------------------
const CONNECTOR_OF = {
  outlook: 'Microsoft 365', 'outlook-cal': 'Microsoft 365', onenote: 'Microsoft 365',
  'ms-todo': 'Microsoft 365', teams: 'Microsoft 365', onedrive: 'Microsoft 365',
  gmail: 'Google', gcal: 'Google', gdrive: 'Google',
  granola: 'Granola', notion: 'Notion',
  activitywatch: 'ActivityWatch (local DB)', dropbox: 'Dropbox (local folder)',
  raindrop: 'Raindrop (API)', pocket: 'Pocket (API)', instapaper: 'Instapaper (API)',
  ticktick: 'TickTick (API)', todoist: 'Todoist (API)',
  otter: 'Otter (manual)', fireflies: 'Fireflies (manual)', zoom: 'Zoom (manual)',
  obsidian: 'Obsidian (local files)', 'apple-mail': 'Apple Mail (local)',
  'apple-cal': 'Apple Calendar (local)', 'apple-notes': 'Apple Notes (local)',
  things: 'Things (local)', omnifocus: 'OmniFocus (local)', logseq: 'Logseq (local)',
  bear: 'Bear (local)', rescuetime: 'RescueTime (API)', vscode: 'VS Code', git: 'git',
  cursor: 'Cursor', jetbrains: 'JetBrains',
};
const label = (id) => CONNECTOR_OF[id] || id || 'manual';

const caps = P.capabilities;
const present = (c) => caps[c] && caps[c].present;
const chosen = (c) => (caps[c] && caps[c].chosen) || null;
const tier = (c) => (caps[c] && caps[c].tier) || 'manual';
const presentList = Object.keys(caps).filter((c) => caps[c] && caps[c].present);

const HOW = (c) => {
  const t = tier(c), prov = label(chosen(c));
  if (t === 'connector') return `${prov} connector`;
  if (t === 'local') return `${prov}`;
  return `${prov} — paste or small script (token kept outside vault)`;
};

// ---- token blocks ----------------------------------------------------------
const arche = new Set(P.archetypes);

// Notes subfolders by archetype + capabilities
const folders = ['Notes/Inbox', 'Notes/Ideas', 'Notes/Journal', '00_System', 'memory', 'Sources'];
if (arche.has('developer')) folders.push('Notes/Projects');
if (arche.has('consultant')) folders.push('Notes/Work', 'Notes/Clients');
if (arche.has('student')) folders.push('Notes/Learning');
if (arche.has('writer')) folders.push('Notes/Writing');
if (arche.has('researcher') || P.interface === 'obsidian') folders.push('Wiki/concepts', 'Wiki/entities');
if (present('meeting-notes')) folders.push('Notes/Meetings');
if (present('read-later')) folders.push('Sources/clippings');

// Intake routing rows (short, for CLAUDE.md)
const intake = [
  ['Journal / daily note', '`Notes/Journal/YYYY-MM-DD.md`'],
  ['Idea or "what if"', '`Notes/Ideas/`'],
];
if (present('meeting-notes')) intake.push(['Meeting notes', '`Notes/Meetings/YYYY-MM-DD <title>.md`']);
if (arche.has('developer')) intake.push(['Project / experiment doc', '`Notes/Projects/<project>/`']);
if (arche.has('consultant')) intake.push(['Client work', '`Notes/Clients/<client>/`']);
if (arche.has('student')) intake.push(['Class notes', '`Notes/Learning/<course>/`']);
if (arche.has('writer')) intake.push(['Draft / content', '`Notes/Writing/`']);
if (present('read-later')) intake.push(['Bookmark / article to keep', '`Sources/clippings/`']);
intake.push(['Person / relationship note', '`00_System/identity.md` (append)']);

// Retrieval rows
const retrieval = [['Vault (files)', 'search the markdown here first, always']];
for (const c of ['email', 'calendar', 'meeting-notes', 'files', 'tasks', 'read-later', 'behavior-data']) {
  if (present(c)) retrieval.push([`${c} (${label(chosen(c))})`, HOW(c)]);
}

// Integrations table (memory/reference_integrations.md)
const integ = [['Capability', 'Provider', 'Tier', 'How reached'], ['---', '---', '---', '---']];
for (const c of presentList) integ.push([c, label(chosen(c)), tier(c), HOW(c)]);

// Layout extra rows
const layoutExtra = [];
if (folders.some((f) => f.startsWith('Wiki/'))) layoutExtra.push(['`Wiki/`', 'AI-authored', 'LLM-maintained knowledge base, cross-linked']);
if (arche.has('writer')) layoutExtra.push(['`Notes/Writing/`', 'Human-authored', 'Drafts and published content']);

// Rituals extra
const ritualsExtra = [];
if (arche.has('consultant') || arche.has('operator')) ritualsExtra.push(['Morning brief', 'Daily or on request']);
if (arche.has('writer')) ritualsExtra.push(['Monthly retro', 'First of the month']);

// memory index extra lines (none beyond the three core for Phase 0)
const memoryIndexExtra = '';

// ---- render helpers --------------------------------------------------------
const rows = (arr) => arr.map((r) => `| ${r.join(' | ')} |`).join('\n');
const tableFull = (arr) => arr.map((r) => `| ${r.join(' | ')} |`).join('\n');

const tokens = {
  user_name: P.user_name,
  identity_summary: P.identity_summary,
  archetypes: P.archetypes.join(', '),
  interface: P.interface,
  date: new Date().toISOString().slice(0, 10),
  capabilities_present: presentList.length ? presentList.join(', ') : 'notes (local markdown only — zero integrations)',
  routing_intake_rows: rows(intake),
  routing_full_rows: rows([['Content type', 'Destination'], ['---', '---'], ...intake]),
  retrieval_rows: rows(retrieval),
  retrieval_full_rows: rows([['Source', 'How to query'], ['---', '---'], ...retrieval]),
  integrations_table: presentList.length ? tableFull(integ) : '_No integrations connected. This brain runs on local markdown. Connect a capability later from your Claude client._',
  layout_extra_rows: layoutExtra.length ? rows(layoutExtra) : '',
  rituals_extra_rows: ritualsExtra.length ? rows(ritualsExtra) : '',
  memory_index_extra: memoryIndexExtra,
};

function render(str) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in tokens ? tokens[k] : `{{${k}}}`));
}

// ---- file plan -------------------------------------------------------------
const fileplan = [
  ['CLAUDE.md.tmpl', 'CLAUDE.md'],
  ['MEMORY.md.tmpl', 'MEMORY.md'],
  ['memory/user_profile.md.tmpl', 'memory/user_profile.md'],
  ['memory/feedback_working_style.md.tmpl', 'memory/feedback_working_style.md'],
  ['memory/reference_integrations.md.tmpl', 'memory/reference_integrations.md'],
  ['00_System/identity.md.tmpl', '00_System/identity.md'],
  ['00_System/routing.md.tmpl', '00_System/routing.md'],
  ['00_System/archive.md.tmpl', '00_System/archive.md'],
];

// ---- execute ---------------------------------------------------------------
const created = [];
function ensureDir(d) { if (!DRY) mkdirSync(d, { recursive: true }); }

ensureDir(dest);
for (const f of folders) ensureDir(join(dest, f));

for (const [tpl, outRel] of fileplan) {
  const src = join(TPL, tpl);
  if (!existsSync(src)) { console.error(`warn: template missing ${tpl}`); continue; }
  const content = render(readFileSync(src, 'utf8'));
  const outPath = join(dest, outRel);
  if (!DRY) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, content);
  }
  created.push(outRel);
}

// ---- report ----------------------------------------------------------------
console.error(`\n  ${DRY ? '[dry-run] would scaffold' : 'Scaffolded'} second brain for ${P.user_name}`);
console.error(`  Dest: ${dest}`);
console.error(`  Interface: ${P.interface}   Archetypes: ${P.archetypes.join(', ')}`);
console.error(`  Capabilities: ${presentList.length ? presentList.join(', ') : 'none (local-only, still works)'}`);
console.error('\n  Folders:');
for (const f of folders) console.error(`    ${f}/`);
console.error('\n  Files:');
for (const f of created) console.error(`    ${f}`);
console.error('');
