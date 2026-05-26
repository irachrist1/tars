#!/usr/bin/env node
// client-archive.mjs — index a deep client/entity archive WITHOUT moving anything.
// Built for the operator/CPA case: many client folders, years of files, names that lie.
//
// What it does:
//   - Walks a clients root one level deep to find per-client/entity folders.
//   - Tiers every file by recency: hot (active), warm (recent), cold (archive).
//   - Builds a per-client catalogue of LINKS to originals in place. Never moves/copies.
//   - Flags clients whose volume is too large to reason about, and suggests scoping.
//   - Optional --read-active: opens a CAPPED set of hot-tier text files for real content
//     signal (combats lying filenames). Consent-gated by the skill before this is run.
//
// Hard rules:
//   - Never moves, renames, copies, or writes into the user's files.
//   - Without --read-active: metadata only (name, size, mtime), never opens a file.
//   - Never transmits anything. Prints to stdout for the local Claude session.
//
// Usage:
//   node client-archive.mjs --root "/path/to/Clients"
//   node client-archive.mjs --root "/path/to/Clients" --hot-days 90 --warm-days 730
//   node client-archive.mjs --root "/path/to/Clients" --read-active --max-read 40
//   node client-archive.mjs --root "/path/to/Clients" --json

import { readdir, stat, open } from 'node:fs/promises';
import { join, extname, basename, relative } from 'node:path';

const argv = process.argv.slice(2);
const getArg = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = getArg('--root', '');
const HOT_DAYS = parseInt(getArg('--hot-days', '90'), 10);
const WARM_DAYS = parseInt(getArg('--warm-days', '730'), 10);
const READ_ACTIVE = argv.includes('--read-active');
const MAX_READ = parseInt(getArg('--max-read', '40'), 10);
const AS_JSON = argv.includes('--json');
const now = Date.now();
const HOT_MS = HOT_DAYS * 864e5;
const WARM_MS = WARM_DAYS * 864e5;

if (!ROOT) {
  process.stderr.write('client-archive: pass --root "/path/to/your/Clients folder"\n');
  process.exit(2);
}

const SKIP_DIR = new Set(['node_modules', '.git', '.cache', 'Caches', '.Trash', '$RECYCLE.BIN',
  'System Volume Information', '__pycache__', '.tmp', 'tmp']);
const READABLE = new Set(['.md', '.txt', '.csv', '.tsv']); // safe text types for sampling
const VOLUME_WARN = 800; // files in one client folder => suggest scoping

const MAX_ENTRIES = 120000, TIME_BUDGET_MS = 30000, startedAt = Date.now();
let entryCount = 0, truncated = false;

function tierOf(mtimeMs) {
  const age = now - mtimeMs;
  if (age <= HOT_MS) return 'hot';
  if (age <= WARM_MS) return 'warm';
  return 'cold';
}

async function sampleContent(path) {
  // read first ~1KB of a small text file; never the whole thing
  try {
    const fh = await open(path, 'r');
    const buf = Buffer.alloc(1024);
    const { bytesRead } = await fh.read(buf, 0, 1024, 0);
    await fh.close();
    return buf.toString('utf8', 0, bytesRead).replace(/\s+/g, ' ').trim().slice(0, 240);
  } catch { return null; }
}

async function walkClient(dir, acc, depth) {
  if (depth > 5 || entryCount > MAX_ENTRIES || Date.now() - startedAt > TIME_BUDGET_MS) {
    truncated = true; return;
  }
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const ent of entries) {
    entryCount++;
    if (ent.isDirectory()) {
      if (SKIP_DIR.has(ent.name) || ent.name.startsWith('.')) continue;
      await walkClient(join(dir, ent.name), acc, depth + 1);
    } else if (ent.isFile()) {
      if (ent.name.startsWith('.')) continue;
      const full = join(dir, ent.name);
      let st; try { st = await stat(full); } catch { continue; }
      const tier = tierOf(st.mtimeMs);
      acc.tiers[tier]++;
      acc.total++;
      if (tier === 'hot') {
        acc.hotFiles.push({
          path: full,
          name: ent.name,
          ext: extname(ent.name).toLowerCase(),
          modified: new Date(st.mtimeMs).toISOString().slice(0, 10),
          sizeKB: Math.round(st.size / 1024),
        });
      }
      if (st.mtimeMs > acc.lastActivityMs) acc.lastActivityMs = st.mtimeMs;
    }
  }
}

// ---- discover client folders (one level under root) -----------------------
let clientDirs = [];
try {
  const top = await readdir(ROOT, { withFileTypes: true });
  clientDirs = top.filter((e) => e.isDirectory() && !SKIP_DIR.has(e.name) && !e.name.startsWith('.'))
    .map((e) => e.name);
} catch {
  process.stderr.write(`client-archive: cannot read root "${ROOT}"\n`);
  process.exit(2);
}

const clients = [];
for (const name of clientDirs) {
  const acc = { name, total: 0, tiers: { hot: 0, warm: 0, cold: 0 }, hotFiles: [], lastActivityMs: 0 };
  await walkClient(join(ROOT, name), acc, 0);
  // sort hot files newest first; keep top 25 as the "what's live" links
  acc.hotFiles.sort((a, b) => (b.modified < a.modified ? -1 : 1));
  acc.topHot = acc.hotFiles.slice(0, 25);
  acc.oversized = acc.total > VOLUME_WARN;
  acc.status = acc.tiers.hot > 0 ? 'active' : (acc.tiers.warm > 0 ? 'warm' : 'dormant');
  acc.lastActivity = acc.lastActivityMs ? new Date(acc.lastActivityMs).toISOString().slice(0, 10) : null;
  clients.push(acc);
}

// ---- optional content sampling of the ACTIVE set (combats lying names) ----
let readCount = 0;
if (READ_ACTIVE) {
  // pool hot, readable files across active clients, newest first, cap at MAX_READ
  const pool = [];
  for (const c of clients) for (const f of c.topHot) if (READABLE.has(f.ext)) pool.push({ c: c.name, f });
  pool.sort((a, b) => (b.f.modified < a.f.modified ? -1 : 1));
  for (const item of pool.slice(0, MAX_READ)) {
    item.f.preview = await sampleContent(item.f.path);
    readCount++;
  }
}

clients.sort((a, b) => b.tiers.hot - a.tiers.hot || b.total - a.total);

const result = {
  generatedAt: new Date().toISOString(),
  root: ROOT,
  tiering: { hotDays: HOT_DAYS, warmDays: WARM_DAYS },
  contentSampled: READ_ACTIVE ? readCount : 0,
  clientsFound: clients.length,
  clients: clients.map((c) => ({
    name: c.name, status: c.status, total: c.total, tiers: c.tiers,
    lastActivity: c.lastActivity, oversized: c.oversized,
    topHot: c.topHot.map((f) => ({ name: f.name, modified: f.modified, sizeKB: f.sizeKB, path: f.path, ...(f.preview ? { preview: f.preview } : {}) })),
  })),
  truncated,
  rules: 'Originals untouched. Links point in place. ' + (READ_ACTIVE ? 'Active text files sampled (first 1KB).' : 'Metadata only — no contents read.'),
};

if (AS_JSON) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else {
  const L = ['', `  Client archive — ${ROOT}`, `  ${'-'.repeat(50)}`,
    `  Clients/entities found: ${clients.length}   (hot=${HOT_DAYS}d, warm=${WARM_DAYS}d)`, ''];
  for (const c of clients.slice(0, 20)) {
    const flag = c.oversized ? '  ⚠ large — scope before deep work' : '';
    L.push(`  ${c.name.padEnd(28)} ${c.status.padEnd(8)} ${c.total} files  (hot ${c.tiers.hot} / warm ${c.tiers.warm} / cold ${c.tiers.cold})  last ${c.lastActivity || '—'}${flag}`);
  }
  L.push('');
  L.push('  Active = touched in the hot window. Cold = archive, read only on request.');
  L.push('  Originals were not moved, renamed, or copied.' + (READ_ACTIVE ? `  Sampled ${readCount} active text files.` : ''));
  if (truncated) L.push('  (scan hit its budget — counts are a floor)');
  L.push('');
  process.stdout.write(L.join('\n') + '\n');
}
