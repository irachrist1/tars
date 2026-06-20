#!/usr/bin/env node
// connectors.mjs — map the user's connected context surface. Classifies each
// connector against a registry of what it holds and what a chief of staff uses
// it for, and emits a compact map. This is the connector half of TARS's
// operation map: files tell you WHERE documents live, connectors tell you WHERE
// everything else lives (projects, mail, meetings, docs, design).
//
// Two detection paths:
//   1. `claude mcp list` (when the `claude` CLI is on PATH).
//   2. Fallback: the `mcp__*` tool names visible to the agent in THIS session,
//      passed in — so the map still gets built on surfaces where the CLI can't
//      run (Claude Desktop, Cowork, claude.ai). This closes issue #6.
//
// Usage:
//   node connectors.mjs                       # markdown map to stdout
//   node connectors.mjs --json                # JSON for the assistant to reason over
//   node connectors.mjs --tools '["mcp__claude_ai_Gmail__search_threads", ...]'
//   echo '["mcp__..."]' | node connectors.mjs # tools via stdin
//   CONNECTOR_TOOLS_JSON='[...]' node connectors.mjs

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const AS_JSON = process.argv.includes('--json');

// What each known connector holds, and what a chief of staff opens it for.
// tier: 'work' = open first for real work; 'life' = personal/secondary;
// 'design' = visual/creative. Unknown connectors are documented generically.
const REGISTRY = {
  'linear':        { cat: 'Project management', tier: 'work', holds: 'projects, issues, cycles, roadmap, status', use: 'what am I working on, what is in progress, deadlines, planning' },
  'notion':        { cat: 'Docs & wiki',        tier: 'work', holds: 'docs, databases, notes, wikis',            use: 'written knowledge, specs, project pages, structured databases' },
  'gmail':         { cat: 'Mail',               tier: 'work', holds: 'email threads',                            use: 'live threads, who said what, follow-ups, sending drafts (ask first)' },
  'google calendar':{cat: 'Calendar',           tier: 'work', holds: 'meetings, events',                         use: 'schedule, meeting prep, the weekly rhythm' },
  'google drive':  { cat: 'Files',              tier: 'work', holds: 'docs, sheets, slides',                     use: 'documents, precedents, shared files' },
  'granola':       { cat: 'Meeting notes',      tier: 'work', holds: 'transcripts, AI meeting summaries',        use: 'what was actually said in meetings, prep, action items' },
  'microsoft 365': { cat: 'Mail + Calendar + Files', tier: 'work', holds: 'Outlook mail & calendar, SharePoint, OneDrive', use: 'the M365 stack — mail, meetings, and the work folder' },
  'microsoft learn':{cat: 'Docs reference',     tier: 'work', holds: 'Microsoft/Azure documentation',            use: 'official docs and code samples lookups' },
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

function normalize(name) { return name.replace(/^claude\.ai\s+/i, '').trim().toLowerCase(); }
function display(name) { return name.replace(/^claude\.ai\s+/i, '').trim(); }
function titleCase(s) { return s.replace(/\b\w/g, (c) => c.toUpperCase()); }

function withRegistry(c) {
  const reg = REGISTRY[c.key] || { cat: 'Other', tier: 'unknown', holds: '(infer from its tools)', use: 'infer from the tool names, or ask the user' };
  return { ...c, ...reg };
}

// Parse one `claude mcp list` line: "<name>: <url> - <status>"
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

// Derive a connector key from an `mcp__<server>__<tool>` name. The server segment
// encodes the connector: strip the `claude_ai_` / `plugin_` wrappers and collapse
// a duplicated segment (`linear_linear` → `linear`).
function keyFromTool(tool) {
  if (typeof tool !== 'string') return null;
  const m = tool.match(/^mcp__(.+?)__/);
  if (!m) return null;
  const parts = m[1].replace(/^claude_ai_/i, '').replace(/^plugin_/i, '').split('_').filter(Boolean);
  const deduped = parts.filter((p, i) => p.toLowerCase() !== (parts[i - 1] || '').toLowerCase());
  return deduped.join(' ').toLowerCase().trim() || null;
}

// Safe JSON → array of tool-name strings. Never throws; warns and returns null.
function parseToolsJson(raw, source) {
  if (!raw || !raw.trim()) return null;
  let v;
  try { v = JSON.parse(raw); }
  catch { console.error(`  warning: ignoring malformed JSON from ${source}`); return null; }
  const arr = Array.isArray(v) ? v : Array.isArray(v?.tools) ? v.tools : null;
  if (!arr) { console.error(`  warning: ${source} JSON is not a tool-name array`); return null; }
  return arr.filter((t) => typeof t === 'string');
}

// Collect the session's mcp__* tool names from --tools, env, or stdin.
function readTools() {
  const i = process.argv.indexOf('--tools');
  if (i >= 0) { const t = parseToolsJson(process.argv[i + 1], '--tools'); if (t) return t; }
  if (process.env.CONNECTOR_TOOLS_JSON) { const t = parseToolsJson(process.env.CONNECTOR_TOOLS_JSON, 'CONNECTOR_TOOLS_JSON'); if (t) return t; }
  if (!process.stdin.isTTY) {
    try { const t = parseToolsJson(readFileSync(0, 'utf8'), 'stdin'); if (t) return t; } catch {}
  }
  return null;
}

function connectorsFromTools(tools) {
  const seen = new Map();
  for (const tool of tools) {
    const key = keyFromTool(tool);
    if (key && !seen.has(key)) seen.set(key, withRegistry({ name: titleCase(key), key, status: 'connected' }));
  }
  return [...seen.values()];
}

function render(connected, attention, sourceNote) {
  const today = new Date().toISOString().slice(0, 10);
  if (AS_JSON) {
    console.log(JSON.stringify({ available: true, scannedAt: today, source: sourceNote, connected, attention }, null, 2));
    return;
  }
  const L = [];
  L.push('# Connectors — your connected context surface');
  L.push(`${sourceNote} on ${today}. ${connected.length} connected.`);
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

// ---- detect ----------------------------------------------------------------
const r = spawnSync('claude', ['mcp', 'list'], { encoding: 'utf8' });

if (!r.error && r.status === 0) {
  // Path 1: the CLI ran.
  const all = (r.stdout || '').split('\n').map((l) => l.trim()).map(parseLine).filter(Boolean).map(withRegistry);
  render(all.filter((c) => c.status === 'connected'), all.filter((c) => c.status !== 'connected'), 'Detected via `claude mcp list`');
} else {
  // Path 2: CLI unavailable — fall back to the session's mcp__* tools.
  const tools = readTools();
  if (tools && tools.length) {
    render(connectorsFromTools(tools), [], 'Detected from the session’s mcp__* tools');
  } else {
    const note = 'connector detection unavailable: `claude mcp list` did not run here, and no session tools were provided. '
      + 'Pass the mcp__* tool names you can see — `connectors.mjs --tools \'["mcp__...", ...]\'` (or via stdin) — to build the map anyway.';
    console.log(AS_JSON ? JSON.stringify({ available: false, note, connected: [] }, null, 2) : `> ${note}`);
    process.exit(0);
  }
}
