#!/usr/bin/env node
// local-index.mjs — the cheap wow. A consented, on-device scan of the user's
// document areas that reports SIGNAL ONLY: how many files, what kinds, which
// folders are active, what looks like a project or a meeting note.
//
// Hard rules:
//   - Default: reads filesystem METADATA only (name, size, mtime). NEVER opens a file.
//   - With --read-active: opens a CAPPED set of recent text files (md/txt/csv) for a
//     short preview, to combat lying filenames. Consent-gated by the skill.
//   - NEVER transmits anything. Prints to stdout for the local Claude session.
//   - Ruthless about noise: skips caches, system dirs, dependency trees.
//
// Usage:
//   node local-index.mjs                 # default doc roots for this OS
//   node local-index.mjs --days 30       # activity window (default 30)
//   node local-index.mjs --roots "/a,/b" # override roots
//   node local-index.mjs --read-active   # sample-read recent text files (capped)
//   node local-index.mjs --json          # machine-readable output for the skill
//
// Output is a summary the skill turns into: "Here's your last N days:
// X projects, Y meetings, Z deadlines-worth of files I can organize."

import { readdir, stat, open } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { join, extname, basename } from 'node:path';

// ---- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
const getArg = (flag, def) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const DAYS = parseInt(getArg('--days', '30'), 10);
const AS_JSON = argv.includes('--json');
const CUSTOM_ROOTS = getArg('--roots', '');
const READ_ACTIVE = argv.includes('--read-active');
const MAX_READ = parseInt(getArg('--max-read', '25'), 10);
const READABLE = new Set(['.md', '.txt', '.csv', '.tsv']);
const WINDOW_MS = DAYS * 24 * 60 * 60 * 1000;
const now = Date.now();
const recentReadable = []; // {path,name,mtimeMs} collected during walk for optional sampling

// ---- where to look --------------------------------------------------------
function defaultRoots() {
  const home = homedir();
  const common = ['Desktop', 'Documents', 'Downloads'].map((d) => join(home, d));
  if (platform() === 'win32') {
    const od = [process.env.OneDrive, process.env.OneDriveCommercial, process.env.OneDriveConsumer]
      .filter(Boolean);
    return [...common, ...od];
  }
  return common; // macOS / linux
}
const roots = CUSTOM_ROOTS
  ? CUSTOM_ROOTS.split(',').map((s) => s.trim()).filter(Boolean)
  : defaultRoots();

// ---- noise filter (be ruthless) -------------------------------------------
const SKIP_DIR = new Set([
  'node_modules', '.git', '.svn', '.hg', '.cache', 'cache', 'Caches',
  'Library', 'AppData', '.Trash', '.trash', '$RECYCLE.BIN', 'System Volume Information',
  'venv', '.venv', '__pycache__', 'dist', 'build', '.next', 'target',
  'Application Support', 'CrashReporter', 'tmp', '.tmp', 'vendor',
]);
const SKIP_HIDDEN = (name) => name.startsWith('.') && name !== '.obsidian';

const MAX_DEPTH = 4;
const MAX_ENTRIES = 60000;      // hard ceiling so a huge disk can't hang us
const TIME_BUDGET_MS = 20000;   // wall-clock budget
const startedAt = Date.now();

// ---- type buckets ---------------------------------------------------------
const CATEGORY = {
  doc: ['.md', '.txt', '.doc', '.docx', '.rtf', '.odt', '.pages'],
  note: ['.md', '.txt'],
  sheet: ['.xls', '.xlsx', '.csv', '.numbers', '.tsv'],
  slide: ['.ppt', '.pptx', '.key'],
  pdf: ['.pdf'],
  code: ['.js', '.mjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.swift', '.rb', '.sh', '.sql'],
  design: ['.fig', '.sketch', '.psd', '.ai', '.xd'],
  image: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.heic', '.webp'],
  data: ['.json', '.yaml', '.yml', '.xml', '.db', '.sqlite'],
};
function categoryOf(ext) {
  for (const [cat, exts] of Object.entries(CATEGORY)) {
    if (cat === 'note') continue; // 'note' is a sub-tag, handled separately
    if (exts.includes(ext)) return cat;
  }
  return 'other';
}

// filename signals (metadata only — we read the NAME, never the body)
const MEETING_RE = /(meeting|standup|stand-up|sync|1[:\s-]?1|one[\s-]?on[\s-]?one|notes|call|interview|retro|kickoff|review)/i;
const PROJECT_HINT_RE = /(project|proposal|spec|plan|draft|roadmap|deliverable|client)/i;
const DEADLINE_RE = /(due|deadline|deliver|final|submit|invoice|deck|q[1-4]|sprint)/i;

// ---- accumulators ---------------------------------------------------------
const stats = {
  scannedDirs: 0,
  totalFiles: 0,
  recentFiles: 0,
  byCategory: {},
  recentByCategory: {},
  meetingFiles: 0,
  deadlineFiles: 0,
  activeFolders: new Map(), // folder -> recent file count
  truncated: false,
};
let entryCount = 0;

function bump(obj, key) { obj[key] = (obj[key] || 0) + 1; }

async function walk(dir, depth) {
  if (depth > MAX_DEPTH) return;
  if (entryCount > MAX_ENTRIES || Date.now() - startedAt > TIME_BUDGET_MS) {
    stats.truncated = true;
    return;
  }
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // permission denied / gone — skip silently, never crash a scan
  }
  stats.scannedDirs++;
  for (const ent of entries) {
    entryCount++;
    const name = ent.name;
    if (ent.isDirectory()) {
      if (SKIP_DIR.has(name) || SKIP_HIDDEN(name)) continue;
      await walk(join(dir, name), depth + 1);
    } else if (ent.isFile()) {
      if (SKIP_HIDDEN(name)) continue;
      const ext = extname(name).toLowerCase();
      const cat = categoryOf(ext);
      stats.totalFiles++;
      bump(stats.byCategory, cat);
      let st;
      try { st = await stat(join(dir, name)); } catch { continue; }
      const recent = now - st.mtimeMs <= WINDOW_MS;
      if (recent) {
        stats.recentFiles++;
        bump(stats.recentByCategory, cat);
        const folder = basename(dir);
        stats.activeFolders.set(folder, (stats.activeFolders.get(folder) || 0) + 1);
        if (MEETING_RE.test(name)) stats.meetingFiles++;
        if (DEADLINE_RE.test(name)) stats.deadlineFiles++;
        if (READ_ACTIVE && READABLE.has(ext)) recentReadable.push({ path: join(dir, name), name, mtimeMs: st.mtimeMs });
      }
    }
  }
}

// ---- run ------------------------------------------------------------------
const seenRoots = [];
for (const root of roots) {
  try {
    const s = await stat(root);
    if (s.isDirectory()) { seenRoots.push(root); await walk(root, 0); }
  } catch { /* root absent on this machine — fine */ }
}

const topFolders = [...stats.activeFolders.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12)
  .map(([folder, count]) => ({ folder, recentFiles: count }));

// ---- optional content sampling (combats lying filenames) ------------------
let samples = [];
if (READ_ACTIVE && recentReadable.length) {
  recentReadable.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const f of recentReadable.slice(0, MAX_READ)) {
    try {
      const fh = await open(f.path, 'r');
      const buf = Buffer.alloc(1024);
      const { bytesRead } = await fh.read(buf, 0, 1024, 0);
      await fh.close();
      const preview = buf.toString('utf8', 0, bytesRead).replace(/\s+/g, ' ').trim().slice(0, 200);
      samples.push({ name: f.name, modified: new Date(f.mtimeMs).toISOString().slice(0, 10), preview });
    } catch { /* unreadable — skip */ }
  }
}

const result = {
  generatedAt: new Date().toISOString(),
  os: platform(),
  windowDays: DAYS,
  rootsScanned: seenRoots,
  totals: {
    files: stats.totalFiles,
    recentFiles: stats.recentFiles,
    scannedDirs: stats.scannedDirs,
  },
  recentByCategory: stats.recentByCategory,
  signals: {
    projectCandidates: topFolders.length,
    meetingNoteFiles: stats.meetingFiles,
    deadlineFlavoredFiles: stats.deadlineFiles,
  },
  topActiveFolders: topFolders,
  contentSamples: samples,
  truncated: stats.truncated,
  note: READ_ACTIVE
    ? `Metadata for all; first 1KB sampled from up to ${MAX_READ} recent text files. Nothing transmitted.`
    : 'Metadata only. No file contents were read. Nothing was transmitted.',
};

if (AS_JSON) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else {
  const L = [];
  L.push('');
  L.push(`  On-device index — last ${DAYS} days  (${platform()})`);
  L.push(`  ${'-'.repeat(46)}`);
  if (!seenRoots.length) {
    L.push('  No standard document folders found. Pass --roots to point me somewhere.');
  } else {
    L.push(`  Scanned: ${seenRoots.join(', ')}`);
    L.push(`  Files seen: ${stats.totalFiles}   |   touched in window: ${stats.recentFiles}`);
    L.push('');
    L.push('  Recent activity by kind:');
    for (const [cat, n] of Object.entries(stats.recentByCategory).sort((a, b) => b[1] - a[1])) {
      L.push(`    ${cat.padEnd(8)} ${n}`);
    }
    L.push('');
    L.push(`  Project candidates (active folders): ${topFolders.length}`);
    for (const t of topFolders.slice(0, 6)) L.push(`    ${t.folder}  (${t.recentFiles})`);
    L.push('');
    L.push(`  Meeting-note files:   ${stats.meetingFiles}`);
    L.push(`  Deadline-flavored:    ${stats.deadlineFiles}`);
    if (stats.truncated) L.push('\n  (scan hit its budget — counts are a floor, not a ceiling)');
  }
  L.push('');
  L.push('  Metadata only. Nothing was opened or sent anywhere.');
  L.push('');
  process.stdout.write(L.join('\n') + '\n');
}
