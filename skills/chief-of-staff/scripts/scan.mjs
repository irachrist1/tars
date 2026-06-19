#!/usr/bin/env node
// scan.mjs — the mechanical half of the map. Walks a folder at scale (tens of
// thousands of files) using stat only (never opens a file), and emits a compact
// skeleton the assistant can read to know WHERE to look. Claude does the
// understanding half: it reads this skeleton, samples the key areas, and writes
// the human MAP.md. Script handles scale; Claude handles meaning.
//
// Usage:
//   node scan.mjs --root "/path/to/folder"            # markdown skeleton to stdout
//   node scan.mjs --root "/path" --json               # JSON for the assistant to reason over
//   node scan.mjs --root "/path" --recent 15 --top 12 # tune list sizes

import { readdir, stat } from 'node:fs/promises';
import { join, basename, extname, relative } from 'node:path';

const argv = process.argv.slice(2);
const arg = (f, d) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const ROOT = arg('--root', null);
const AS_JSON = argv.includes('--json');
const RECENT_N = Number(arg('--recent', 15));
const TOP_N = Number(arg('--top', 12));
const HUB_DEPTH = Number(arg('--hub-depth', 4));
if (!ROOT) { console.error('error: --root <folder> is required'); process.exit(1); }

// Noise we never want in a work map.
const SKIP_DIRS = new Set([
  '.git', '.svn', 'node_modules', '.obsidian', '.trash', '.tmp', '.cache',
  '__pycache__', '.venv', 'venv', 'dist', 'build', '.next', '.DS_Store',
  'Library', 'AppData', '.npm', '.cargo', '.idea', '.vscode',
]);
// Files that look like reusable precedents / "how we do things".
const PRECEDENT_WORDS = /\b(template|proposal|report|contract|letter|invoice|engagement|sow|deck|policy|playbook|checklist|agreement|memo|brief|plan|model)\b/i;
const PRECEDENT_EXT = new Set(['.docx', '.dotx', '.xlsx', '.xltx', '.pptx', '.potx', '.pdf', '.md']);

const prefixStats = new Map();   // path prefix -> rollup
let totalFiles = 0, totalBytes = 0, scanned = 0;
const recent = [];                // {path, mtime}
const precedents = [];            // {path, mtime, hub}

function relParts(absPath) {
  return relative(ROOT, absPath).split(/[/\\]/).filter(Boolean);
}
function relSlash(absPath) {
  return relParts(absPath).join('/');
}

function touchPrefix(prefix, size, mtimeMs) {
  if (!prefixStats.has(prefix)) {
    prefixStats.set(prefix, { files: 0, bytes: 0, newest: 0, depth: prefix.split('/').length });
  }
  const d = prefixStats.get(prefix);
  d.files++; d.bytes += size; d.newest = Math.max(d.newest, mtimeMs);
}

function hubFor(relPath) {
  const parts = relPath.split('/');
  if (parts.length <= 1) return '(root)';
  for (let d = Math.min(parts.length - 1, HUB_DEPTH); d >= 1; d--) {
    const prefix = parts.slice(0, d).join('/');
    const s = prefixStats.get(prefix);
    if (s && s.files >= 5) return prefix;
  }
  return parts[0];
}

async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.isDirectory()) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) { await walk(p); continue; }
    if (!e.isFile()) continue;
    let s; try { s = await stat(p); } catch { continue; }
    scanned++;
    totalFiles++; totalBytes += s.size;
    const ext = extname(e.name).toLowerCase() || '(none)';
    const rel = relSlash(p);
    const parts = relParts(p);
    for (let d = 1; d <= Math.min(parts.length - 1, HUB_DEPTH); d++) {
      touchPrefix(parts.slice(0, d).join('/'), s.size, s.mtimeMs);
    }
    const hub = hubFor(rel);
    if (!prefixStats.has(`__hub__${hub}`)) {
      prefixStats.set(`__hub__${hub}`, { files: 0, bytes: 0, newest: 0, depth: hub === '(root)' ? 0 : hub.split('/').length, exts: new Map() });
    }
    const h = prefixStats.get(`__hub__${hub}`);
    h.files++; h.bytes += s.size; h.newest = Math.max(h.newest, s.mtimeMs);
    if (!h.exts) h.exts = new Map();
    h.exts.set(ext, (h.exts.get(ext) || 0) + 1);
    recent.push({ path: p, mtime: s.mtimeMs });
    if (PRECEDENT_WORDS.test(e.name) || PRECEDENT_EXT.has(ext)) {
      precedents.push({ path: p, mtime: s.mtimeMs, hub });
    }
  }
}

function pickHubs() {
  const now = Date.now();
  const DAY = 864e5;
  const prefixes = [...prefixStats.entries()]
    .filter(([k]) => !k.startsWith('__hub__'));

  function scored(name, d) {
    const recency = Math.max(0, 1 - (now - d.newest) / (90 * DAY));
    return { name, ...d, score: d.files * (0.5 + recency) };
  }

  function childrenOf(parent) {
    const depth = parent.split('/').length + 1;
    return prefixes
      .filter(([name, d]) => d.depth === depth && name.startsWith(parent + '/'))
      .map(([name, d]) => scored(name, d))
      .filter((c) => c.files >= 3)
      .sort((a, b) => b.score - a.score);
  }

  function drillDownChain(start) {
    let current = start;
    while (current.depth < HUB_DEPTH) {
      const kids = childrenOf(current.name);
      if (kids.length > 1) return kids.slice(0, TOP_N);
      if (kids.length === 1) { current = kids[0]; continue; }
      break;
    }
    return [current];
  }

  function drillFrom(level) {
    const atLevel = prefixes
      .filter(([, d]) => d.depth === level && d.files >= 5)
      .map(([name, d]) => scored(name, d))
      .sort((a, b) => b.score - a.score);
    if (!atLevel.length) return [];

    const dominant = atLevel[0];
    if (atLevel.length === 1 && dominant.files >= totalFiles * 0.7 && dominant.depth < HUB_DEPTH) {
      return drillDownChain(dominant);
    }
    return atLevel.slice(0, TOP_N);
  }

  const drilled = drillFrom(1);
  if (drilled.length) return drilled;

  const candidates = prefixes
    .filter(([, d]) => d.depth >= 1 && d.files >= 10)
    .map(([name, d]) => scored(name, d))
    .sort((a, b) => b.score - a.score);

  const picked = [];
  for (const c of candidates) {
    if (picked.some((p) => c.name.startsWith(p.name + '/') || p.name.startsWith(c.name + '/'))) {
      const existing = picked.find((p) => c.name.startsWith(p.name + '/') || p.name.startsWith(c.name + '/'));
      if (existing && c.score > existing.score * 1.5) {
        picked[picked.indexOf(existing)] = c;
      }
      continue;
    }
    picked.push(c);
    if (picked.length >= TOP_N) break;
  }
  return picked.sort((a, b) => b.files - a.files);
}

const t0 = Date.now();
await walk(ROOT);
const secs = ((Date.now() - t0) / 1000).toFixed(1);

recent.sort((a, b) => b.mtime - a.mtime);
precedents.sort((a, b) => b.mtime - a.mtime);

const hubs = pickHubs();
const hubRollup = hubs.map((h) => {
  const key = `__hub__${h.name}`;
  const roll = prefixStats.get(key);
  const topExts = roll?.exts
    ? [...roll.exts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    : [];
  return {
    name: h.name, files: h.files, bytes: h.bytes, newest: h.newest, depth: h.depth, topExts,
  };
});

// Fallback: if hub detection found nothing meaningful, use depth-1 prefixes.
const areas = hubRollup.length
  ? hubRollup
  : [...prefixStats.entries()]
    .filter(([k, d]) => !k.startsWith('__hub__') && d.depth === 1)
    .map(([name, d]) => ({
      name, files: d.files, bytes: d.bytes, newest: d.newest, depth: 1, topExts: [],
    }))
    .sort((a, b) => b.files - a.files);

const mb = (b) => (b / 1e6).toFixed(1) + ' MB';
const when = (ms) => new Date(ms).toISOString().slice(0, 10);
const rel = (p) => relSlash(p);
const flatRoot = areas.length === 1 && areas[0].name === '(root)';

if (AS_JSON) {
  console.log(JSON.stringify({
    root: ROOT, scannedFiles: totalFiles, totalSize: totalBytes, scanSeconds: Number(secs),
    hubDetection: !flatRoot, areas, recent: recent.slice(0, RECENT_N).map((r) => ({ path: rel(r.path), mtime: when(r.mtime) })),
    precedents: precedents.slice(0, TOP_N).map((r) => ({ path: rel(r.path), hub: r.hub, mtime: when(r.mtime) })),
  }, null, 2));
} else {
  const L = [];
  L.push(`# Map skeleton — ${basename(ROOT)}`);
  L.push(`Root: ${ROOT}`);
  L.push(`${totalFiles.toLocaleString()} files, ${mb(totalBytes)}, scanned in ${secs}s. ${areas.length} working hub${areas.length === 1 ? '' : 's'}.`);
  if (flatRoot) {
    L.push('');
    L.push('> **Note:** everything sits at the scan root with no subfolders — the work may live deeper (e.g. a nested org OneDrive). Try scanning the confirmed work folder, not the personal OneDrive parent.');
  }
  L.push('');
  L.push('## Working hubs (where activity clusters)');
  for (const a of areas) {
    const exts = a.topExts.length ? a.topExts.map(([e, n]) => `${e}×${n}`).join(', ') : '(mixed)';
    L.push(`- **${a.name}** — ${a.files} files, ${mb(a.bytes)}, last touched ${when(a.newest)}, depth ${a.depth}. Mostly ${exts}.`);
  }
  L.push('');
  L.push('## Likely precedents / "how we do things"');
  for (const p of precedents.slice(0, TOP_N)) L.push(`- ${rel(p.path)}  _(in ${p.hub}, ${when(p.mtime)})_`);
  L.push('');
  L.push('## In flight (most recently touched)');
  for (const r of recent.slice(0, RECENT_N)) L.push(`- ${rel(r.path)}  _(${when(r.mtime)})_`);
  L.push('');
  L.push('> This is the mechanical skeleton. The assistant reads it, samples the key hubs, and writes the human MAP.md with what each area is actually about.');
  console.log(L.join('\n'));
}
