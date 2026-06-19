#!/usr/bin/env node
// connectors.mjs — map the user's connected context surface. Runs `claude mcp
// list`, classifies each connector against a registry of what it holds and what
// a chief of staff uses it for, and emits a compact map. This is the connector
// half of TARS's operation map: files tell you WHERE documents live, connectors
// tell you WHERE everything else lives (projects, mail, meetings, docs, design).
//
// Usage:
//   node connectors.mjs                         # markdown map to stdout
//   node connectors.mjs --json                  # JSON for the assistant to reason over
//   node connectors.mjs --tools '["mcp__granola__list_meetings", ...]'
//   echo '["mcp__linear__list_issues"]' | node connectors.mjs --stdin
//
// When `claude mcp list` is unavailable (Claude Desktop, Cowork, mobile), pass the
// mcp__* tool names visible in the session via --tools, --stdin, or CONNECTOR_TOOLS_JSON.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const AS_JSON = process.argv.includes('--json');
const argv = process.argv.slice(2);
const arg = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);

// What each known connector holds, and what a chief of staff opens it for.
const REGISTRY = {
  'linear':        { cat: 'Project management', tier: 'work', holds: 'projects, issues, cycles, roadmap, status', use: 'what am I working on, what is in progress, deadlines, planning' },
  'notion':        { cat: 'Docs & wiki',        tier: 'work', holds: 'docs, databases, notes, wikis',            use: 'written knowledge, specs, project pages, structured databases' },
  'gmail':         { cat: 'Mail',               tier: 'work', holds: 'email threads',                            use: 'live threads, who said what, follow-ups, sending drafts (ask first)' },
  'google calendar':{cat: 'Calendar',           tier: 'work', holds: 'meetings, events',                         use: 'schedule, meeting prep, the weekly rhythm' },
  'google drive':  { cat: 'Files',              tier: 'work', holds: 'docs, sheets, slides',                     use: 'documents, precedents, shared files' },
  'granola':       { cat: 'Meeting notes',      tier: 'work', holds: 'transcripts, AI meeting summaries',        use: 'what was actually said in meetings, prep, action items' },
  'microsoft 365': { cat: 'Mail + Calendar + Files', tier: 'work', holds: 'Outlook mail & calendar, SharePoint, OneDrive', use: 'the M365 stack — mail, meetings, and the work folder' },
  'slack':         { cat: 'Team comms',         tier: 'work', holds: 'channels, DMs, threads',                   use: 'team discussion, decisions, who owns what' },
  'figma':         { cat: 'Design',             tier: 'design', holds: 'design files, components, specs',        use: 'design source of truth, handoff specs' },
  'canva':         { cat: 'Design & decks',     tier: 'design', holds: 'designs, brand templates',               use: 'decks, social, branded assets' },
  'gamma':         { cat: 'Presentations',      tier: 'design', holds: 'presentations, docs, sites',             use: 'generating decks and one-pagers' },
  'excalidraw':    { cat: 'Diagrams',           tier: 'design', holds: 'diagrams, sketches',                     use: 'whiteboard diagrams, architecture sketches' },
  'strava':        { cat: 'Fitness',            tier: 'life', holds: 'runs, rides, training data',               use: 'training load, race prep, weekly mileage' },
  'spotify':       { cat: 'Music',              tier: 'life', holds: 'playback, playlists, library',             use: 'rarely work-relevant; focus playlists at most' },
  'vercel':        { cat: 'Deploys',            tier: 'work', holds: 'projects, deployments, logs',              use: 'ship status, build logs, what is live' },
  'lennysdata':    { cat: 'PM research',        tier: 'work', holds: "Lenny's newsletter + podcast archive",     use: 'product/startup/growth frameworks, operator case studies' },
  'learning commons knowledge graph': { cat: 'Education KG', tier: 'work', holds: 'standards, learning components', use: 'curriculum and standards lookups' },
};

function normalize(name) {
  return name.replace(/^claude\.ai\s+/i, '').trim().toLowerCase();
}
function display(name) {
  return name.replace(/^claude\.ai\s+/i, '').trim();
}

function parseLine(line) {
  const m = line.match(/^(.+?):\s+(.*?)\s+-\s+(.+)$/);
  if (!m) return null;
  const [, name, , statusRaw] = m;
  let status = 'connected';
  if (/needs? authentication/i.test(statusRaw)) status = 'needs-auth';
  else if (/failed/i.test(statusRaw)) status = 'failed';
  else if (/connected/i.test(statusRaw)) status = 'connected';
  else status = 'unknown';
  return { name: display(name), key: normalize(name), status };
}

function classify(name, status = 'connected') {
  const reg = REGISTRY[name] || { cat: 'Other', tier: 'unknown', holds: '(infer from its tools)', use: 'infer from the tool names, or ask the user' };
  return { name: display(name), key: name, status, ...reg };
}

// mcp__granola__list_meetings → granola
function connectorsFromToolNames(tools) {
  const seen = new Map();
  for (const t of tools) {
    const m = String(t).match(/^mcp__([^_]+)__/);
    if (!m) continue;
    const key = m[1].toLowerCase().replace(/-/g, ' ');
    if (!seen.has(key)) seen.set(key, classify(key));
  }
  return [...seen.values()];
}

function loadToolFallback() {
  const fromArg = arg('--tools');
  if (fromArg) return JSON.parse(fromArg);
  if (process.env.CONNECTOR_TOOLS_JSON) return JSON.parse(process.env.CONNECTOR_TOOLS_JSON);
  if (argv.includes('--stdin')) {
    const raw = readFileSync(0, 'utf8').trim();
    if (raw) return JSON.parse(raw);
  }
  return null;
}

let connectors = [];
let source = 'claude mcp list';
let available = true;

const r = spawnSync('claude', ['mcp', 'list'], { encoding: 'utf8' });
if (!r.error && r.status === 0 && (r.stdout || '').trim()) {
  connectors = (r.stdout || '')
    .split('\n')
    .map((l) => l.trim())
    .map(parseLine)
    .filter(Boolean)
    .map((c) => classify(c.key, c.status));
} else {
  const tools = loadToolFallback();
  if (tools && tools.length) {
    source = 'session tool list';
    connectors = connectorsFromToolNames(tools);
  } else {
    available = false;
    const note = 'connector detection unavailable: `claude mcp list` did not run here. Re-run with `--tools \'["mcp__…"]\'` or pass the mcp__* tool names from your session. The assistant can also document visible tools directly in CONNECTORS.md.';
    console.log(AS_JSON ? JSON.stringify({ available: false, note, connectors: [] }, null, 2) : `> ${note}`);
    process.exit(0);
  }
}

const connected = connectors.filter((c) => c.status === 'connected');
const attention = connectors.filter((c) => c.status !== 'connected');
const today = new Date().toISOString().slice(0, 10);

if (AS_JSON) {
  console.log(JSON.stringify({ available: true, source, scannedAt: today, connected, attention }, null, 2));
} else {
  const L = [];
  L.push('# Connectors — your connected context surface');
  L.push(`Detected via ${source} on ${today}. ${connected.length} connected.`);
  L.push('');
  const section = (title, list) => {
    if (!list.length) return;
    L.push(`## ${title}`);
    for (const c of list) L.push(`- **${c.name}** — ${c.cat}. Holds ${c.holds}. Open for: ${c.use}.`);
    L.push('');
  };
  section('Work context (open these first)', connected.filter((c) => c.tier === 'work'));
  section('Design & visual', connected.filter((c) => c.tier === 'design'));
  section('Personal / life', connected.filter((c) => c.tier === 'life'));
  section('Other connected', connected.filter((c) => c.tier === 'unknown'));
  if (attention.length) {
    L.push('## Needs your attention (locked context)');
    for (const c of attention) {
      const why = c.status === 'needs-auth' ? 'needs authentication' : 'failed to connect';
      const what = c.cat === 'Other' ? 'its context' : c.cat.toLowerCase();
      L.push(`- **${c.name}** — ${why}. Connect it in Claude → Settings → Connectors to unlock ${what}.`);
    }
    L.push('');
  }
  L.push('> Regenerated mechanically. Fold the work-tier connectors into your search ladder: route each kind of question to the tool that holds the answer.');
  console.log(L.join('\n'));
}
