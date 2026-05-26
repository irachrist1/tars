#!/usr/bin/env node
// first-brief.mjs — format and file the first-run brief.
//
// Connector-first design: a Node script cannot call the user's Claude
// connectors (those are the skill's MCP tools). So the SKILL fetches the data
// — last meeting, today's calendar, recent threads — through the connected
// Microsoft 365 / Granola / Google tools, hands it here as JSON, and this
// script does the deterministic part: render a clean brief and file it.
//
// Usage:
//   echo '<brief.json>' | node first-brief.mjs --dest "/path/to/vault"
//   node first-brief.mjs --file brief.json --dest "/path/to/vault" [--stdout]
//
// brief.json (all optional):
//   { "now": "2026-05-26T09:00:00Z",
//     "lastMeeting": { "title", "when", "attendees": [..], "summary", "actions": [..] },
//     "today": [ { "when", "title" } ],
//     "recentThreads": [ { "from", "subject", "received" } ],
//     "openLoops": [ "..." ] }

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const argv = process.argv.slice(2);
const arg = (f, d) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const dest = arg('--dest', null);
const toStdout = argv.includes('--stdout');
const fileArg = arg('--file', null);

let data = {};
try {
  const raw = fileArg ? readFileSync(fileArg, 'utf8') : readFileSync(0, 'utf8');
  if (raw.trim()) data = JSON.parse(raw);
} catch { /* no input — produce an empty-but-valid brief */ }

const now = data.now ? new Date(data.now) : new Date();
const day = now.toISOString().slice(0, 10);
const fmt = (s) => { try { return new Date(s).toLocaleString(); } catch { return s; } };

const L = [];
L.push(`# Brief — ${day}`);
L.push('');

if (data.lastMeeting && data.lastMeeting.title) {
  const m = data.lastMeeting;
  L.push('## Last meeting');
  L.push(`**${m.title}**${m.when ? ` — ${fmt(m.when)}` : ''}`);
  if (m.attendees && m.attendees.length) L.push(`Attendees: ${m.attendees.join(', ')}`);
  if (m.summary) { L.push(''); L.push(m.summary); }
  if (m.actions && m.actions.length) {
    L.push('');
    L.push('Action items:');
    for (const a of m.actions) L.push(`- [ ] ${a}`);
  }
  L.push('');
}

if (data.today && data.today.length) {
  L.push('## Today');
  for (const e of data.today) L.push(`- ${e.when ? fmt(e.when) + ' — ' : ''}${e.title}`);
  L.push('');
}

if (data.recentThreads && data.recentThreads.length) {
  L.push('## Recent threads worth a look');
  for (const t of data.recentThreads) L.push(`- ${t.subject}${t.from ? ` (from ${t.from})` : ''}`);
  L.push('');
}

if (data.openLoops && data.openLoops.length) {
  L.push('## Open loops');
  for (const o of data.openLoops) L.push(`- ${o}`);
  L.push('');
}

if (L.length <= 2) {
  L.push('_No connector data supplied. Connect Microsoft 365 / Granola / Google in your Claude client, then re-run. This brain still works without it._');
  L.push('');
}

const out = L.join('\n');

if (toStdout || !dest) {
  process.stdout.write(out + '\n');
} else {
  const outPath = join(dest, 'Notes', 'Journal', `${day}-brief.md`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, out);
  console.error(`brief filed: ${outPath}`);
}
