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

const dirs = new Map();           // top-level area -> rollup
let totalFiles = 0, totalBytes = 0, scanned = 0;
const recent = [];                // {path, mtime}
const precedents = [];            // {path, mtime, area}

function areaOf(absPath) {
  const rel = relative(ROOT, absPath);
  if (!rel.includes('/')) return '(root)';
  const seg = rel.split('/')[0];
  return seg && seg !== '..' ? seg : '(root)';
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
    const area = areaOf(p);
    if (!dirs.has(area)) dirs.set(area, { files: 0, bytes: 0, exts: new Map(), newest: 0 });
    const d = dirs.get(area);
    d.files++; d.bytes += s.size; d.newest = Math.max(d.newest, s.mtimeMs);
    d.exts.set(ext, (d.exts.get(ext) || 0) + 1);
    recent.push({ path: p, mtime: s.mtimeMs });
    if (PRECEDENT_WORDS.test(e.name) || PRECEDENT_EXT.has(ext)) {
      precedents.push({ path: p, mtime: s.mtimeMs, area });
    }
  }
}

const t0 = Date.now();
await walk(ROOT);
const secs = ((Date.now() - t0) / 1000).toFixed(1);

recent.sort((a, b) => b.mtime - a.mtime);
precedents.sort((a, b) => b.mtime - a.mtime);
const areas = [...dirs.entries()]
  .map(([name, d]) => ({
    name, files: d.files, bytes: d.bytes, newest: d.newest,
    topExts: [...d.exts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
  }))
  .sort((a, b) => b.files - a.files);

const mb = (b) => (b / 1e6).toFixed(1) + ' MB';
const when = (ms) => new Date(ms).toISOString().slice(0, 10);
const rel = (p) => relative(ROOT, p);

if (AS_JSON) {
  console.log(JSON.stringify({
    root: ROOT, scannedFiles: totalFiles, totalSize: totalBytes, scanSeconds: Number(secs),
    areas, recent: recent.slice(0, RECENT_N).map((r) => ({ path: rel(r.path), mtime: when(r.mtime) })),
    precedents: precedents.slice(0, TOP_N).map((r) => ({ path: rel(r.path), area: r.area, mtime: when(r.mtime) })),
  }, null, 2));
} else {
  const L = [];
  L.push(`# Map skeleton — ${basename(ROOT)}`);
  L.push(`Root: ${ROOT}`);
  L.push(`${totalFiles.toLocaleString()} files, ${mb(totalBytes)}, scanned in ${secs}s. ${areas.length} top-level areas.`);
  L.push('');
  L.push('## Areas (where things live)');
  for (const a of areas) {
    const exts = a.topExts.map(([e, n]) => `${e}×${n}`).join(', ');
    L.push(`- **${a.name}** — ${a.files} files, ${mb(a.bytes)}, last touched ${when(a.newest)}. Mostly ${exts}.`);
  }
  L.push('');
  L.push('## Likely precedents / "how we do things"');
  for (const p of precedents.slice(0, TOP_N)) L.push(`- ${rel(p.path)}  _(in ${p.area}, ${when(p.mtime)})_`);
  L.push('');
  L.push('## In flight (most recently touched)');
  for (const r of recent.slice(0, RECENT_N)) L.push(`- ${rel(r.path)}  _(${when(r.mtime)})_`);
  L.push('');
  L.push('> This is the mechanical skeleton. The assistant reads it, samples the key areas, and writes the human MAP.md with what each area is actually about.');
  console.log(L.join('\n'));
}
