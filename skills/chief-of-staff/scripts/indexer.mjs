#!/usr/bin/env node
// indexer.mjs — TARS's own local content index. The thing that makes "pull last
// year's numbers" answer in a fraction of a second without re-scanning the disk
// and without burning tokens on a walk.
//
// What it is: a persistent, incremental, ranked full-text index over the user's
// work folder. Pure Node, no dependencies, cross-platform — so it works where
// macOS Spotlight (`mdfind`) does not (Windows, Linux, headless). The index is a
// few small JSON files inside the user's OWN storage; nothing is transmitted.
//
//   node indexer.mjs build  --root "<work folder>" [--store <dir>]   # full build
//   node indexer.mjs update --root "<work folder>" [--store <dir>]   # re-index only changed files
//   node indexer.mjs query  "<text>" [--store <dir>] [--top 8] [--json]
//   node indexer.mjs stats  [--store <dir>]
//
// Design:
//   - Text files (md/txt/csv/code/json…) are full-text indexed (capped per file).
//     Everything else (docx/xlsx/pdf/images) is indexed by filename + path tokens,
//     so it's still findable by name. Body extraction for office/pdf is a
//     documented extension point (see EXTRACTORS) — add it without changing the
//     index format.
//   - Ranking is BM25. Filename/path tokens get a boost so "the ACME proposal"
//     surfaces ACME's proposal file even if the body never repeats the word.
//   - Incremental: `update` re-indexes only files whose mtime changed and drops
//     files that disappeared. This is the "doesn't re-scan your whole laptop"
//     property — the heavy walk happens once.
//   - Query loads the index from disk and scores in memory: milliseconds on tens
//     of thousands of docs, and it returns only the top N hits with a snippet —
//     a handful of lines, not a scan. That's what keeps it cheap on tokens.
//
// Hard rules: never moves/renames/writes the user's files; never transmits.
// The only thing written is the index under --store (default: <root>/.tars-index).

import { readdir, stat, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, extname, basename, relative, sep, isAbsolute, resolve } from 'node:path';

// ---- args ------------------------------------------------------------------
const argv = process.argv.slice(2);
const cmd = argv[0];
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (f) => argv.includes(f);
const ROOT = arg('--root', null);
const TOP = parseInt(arg('--top', '8'), 10);
const AS_JSON = has('--json');
const STORE = arg('--store', ROOT ? join(resolve(ROOT), '.tars-index') : null);

const INDEX_FORMAT = 1;
const MAX_TEXT_BYTES = 512 * 1024;   // index at most 512KB of any one file's body
const MAX_FIELD_TERMS = 4000;        // cap terms per doc so one giant file can't dominate
const SNIPPET_RADIUS = 90;           // chars of context on each side of a hit

// Body-readable text types. Everything else → filename/path tokens only.
const TEXT_EXT = new Set([
  '.md', '.markdown', '.txt', '.text', '.csv', '.tsv', '.json', '.yaml', '.yml',
  '.xml', '.html', '.htm', '.rtf', '.log', '.ini', '.cfg', '.toml',
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java',
  '.c', '.h', '.cpp', '.cs', '.rb', '.php', '.swift', '.sh', '.sql',
]);

// Extension point: map an extension to an async (path)->string extractor to pull
// body text from binary formats (docx/xlsx/pptx/pdf). Left empty on purpose —
// wiring a converter here (e.g. `textutil` on macOS, or an optional dependency)
// upgrades those files from filename-only to full-text WITHOUT any other change.
const EXTRACTORS = Object.create(null);

const SKIP_DIR = new Set([
  '.git', '.svn', '.hg', 'node_modules', '.obsidian', '.trash', '.Trash', '.tmp',
  '.cache', 'Caches', '__pycache__', '.venv', 'venv', 'dist', 'build', '.next',
  'target', 'vendor', 'Library', 'AppData', '$RECYCLE.BIN',
  'System Volume Information', '.tars-index',
]);

// ---- tokenization ----------------------------------------------------------
const STOP = new Set(('a an and are as at be but by for if in into is it no not of on or '
  + 'such that the their then there these they this to was will with i you we he she').split(' '));

function tokenize(text) {
  const out = [];
  // letters/digits, allow internal apostrophes; lowercase; drop stopwords & len<2
  const re = /[\p{L}\p{N}][\p{L}\p{N}'_-]*/gu;
  let m, n = 0;
  while ((m = re.exec(text)) && n < MAX_FIELD_TERMS) {
    const t = m[0].toLowerCase();
    if (t.length < 2 || t.length > 40 || STOP.has(t)) continue;
    out.push(t);
    n++;
  }
  return out;
}

// path/filename tokens (split camelCase, separators) — these get a boost
function pathTokens(relPath) {
  return tokenize(relPath.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[\/\\._-]+/g, ' '));
}

// ---- store I/O -------------------------------------------------------------
const META = () => join(STORE, 'index.json');     // format, root, docs, df, stats
const POST = () => join(STORE, 'postings.json');   // term -> [[docId, weightedTf], ...]

async function loadIndex() {
  try {
    const meta = JSON.parse(await readFile(META(), 'utf8'));
    const postings = JSON.parse(await readFile(POST(), 'utf8'));
    return { meta, postings };
  } catch { return null; }
}

async function saveIndex(meta, postings) {
  await mkdir(STORE, { recursive: true });
  await writeFile(META(), JSON.stringify(meta));
  await writeFile(POST(), JSON.stringify(postings));
}

// ---- read one doc into a term-frequency map --------------------------------
async function indexDoc(absPath, relPath) {
  const ext = extname(absPath).toLowerCase();
  const tf = Object.create(null);
  const add = (tokens, weight) => { for (const t of tokens) tf[t] = (tf[t] || 0) + weight; };

  // filename + path always indexed, boosted (a filename is a strong signal)
  add(pathTokens(relPath), 3);

  let body = '';
  if (TEXT_EXT.has(ext)) {
    try {
      const buf = await readFile(absPath);
      body = buf.slice(0, MAX_TEXT_BYTES).toString('utf8');
    } catch { /* unreadable — keep filename tokens only */ }
  } else if (EXTRACTORS[ext]) {
    try { body = (await EXTRACTORS[ext](absPath)) || ''; } catch { /* extractor failed */ }
  }
  if (body) add(tokenize(body), 1);

  let len = 0;
  for (const t in tf) len += tf[t];
  return { tf, len };
}

// ---- walk the corpus -------------------------------------------------------
async function* walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.isDirectory() && e.name !== '.obsidian') continue;
    if (SKIP_DIR.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) { yield* walk(p); continue; }
    if (!e.isFile()) continue;
    yield p;
  }
}

// ---- build / update --------------------------------------------------------
async function build({ incremental }) {
  if (!ROOT) die('build/update need --root "<work folder>"');
  const rootAbs = resolve(ROOT);
  try { if (!(await stat(rootAbs)).isDirectory()) die(`not a folder: ${rootAbs}`); }
  catch { die(`cannot read: ${rootAbs}`); }

  const prev = incremental ? await loadIndex() : null;
  // docs keyed by relPath: { id, mtimeMs, len }
  const docs = prev?.meta?.docs ? { ...prev.meta.docs } : Object.create(null);
  const postings = prev?.postings ? prev.postings : Object.create(null);
  let nextId = prev?.meta?.nextId ?? 0;
  const df = prev?.meta?.df ? { ...prev.meta.df } : Object.create(null);

  // remove a doc's contributions from postings + df (for re-index / deletion)
  const dropDoc = (relPath) => {
    const d = docs[relPath];
    if (!d) return;
    for (const term in postings) {
      const arr = postings[term];
      const i = arr.findIndex((e) => e[0] === d.id);
      if (i >= 0) { arr.splice(i, 1); df[term]--; if (df[term] <= 0) delete df[term]; if (arr.length === 0) delete postings[term]; }
    }
    delete docs[relPath];
  };

  const t0 = Date.now();
  const seen = new Set();
  let added = 0, updated = 0, skipped = 0;

  for await (const absPath of walk(rootAbs)) {
    const relPath = relative(rootAbs, absPath);
    seen.add(relPath);
    let st; try { st = await stat(absPath); } catch { continue; }
    const existing = docs[relPath];
    if (incremental && existing && existing.mtimeMs === st.mtimeMs) { skipped++; continue; }
    if (existing) dropDoc(relPath); // changed → drop old contributions first

    const { tf, len } = await indexDoc(absPath, relPath);
    const id = existing ? existing.id : nextId++;
    docs[relPath] = { id, mtimeMs: st.mtimeMs, len, name: basename(relPath) };
    for (const term in tf) {
      (postings[term] ||= []).push([id, tf[term]]);
      df[term] = (df[term] || 0) + 1;
    }
    existing ? updated++ : added++;
  }

  // drop files that disappeared since last build (incremental only)
  let removed = 0;
  if (incremental) {
    for (const relPath of Object.keys(docs)) {
      if (!seen.has(relPath)) { dropDoc(relPath); removed++; }
    }
  }

  // recompute corpus stats
  let totalLen = 0; const ids = Object.values(docs);
  for (const d of ids) totalLen += d.len;
  const meta = {
    format: INDEX_FORMAT,
    builtAt: new Date().toISOString(),
    root: rootAbs,
    nextId,
    docCount: ids.length,
    avgdl: ids.length ? totalLen / ids.length : 0,
    df,
    docs,
  };
  await saveIndex(meta, postings);

  const secs = ((Date.now() - t0) / 1000).toFixed(2);
  if (AS_JSON) {
    console.log(JSON.stringify({ ok: true, root: rootAbs, store: STORE, docCount: meta.docCount, added, updated, skipped, removed, seconds: Number(secs) }));
  } else {
    console.log('');
    console.log(`  ${incremental ? 'Updated' : 'Built'} index → ${STORE}`);
    console.log(`  ${meta.docCount} documents indexed  (+${added} new, ~${updated} changed, ${skipped} unchanged, -${removed} gone)`);
    console.log(`  ${Object.keys(postings).length} unique terms · ${secs}s`);
    console.log('');
    console.log('  Query it:  node indexer.mjs query "<text>" --store ' + STORE);
    console.log('');
  }
}

// ---- query -----------------------------------------------------------------
async function query() {
  // the query text is the first non-flag arg (always passed as one quoted phrase)
  const q = (argv[1] && !argv[1].startsWith('--')) ? argv[1] : null;
  if (!q) die('query needs text: indexer.mjs query "last year ACME numbers"');
  const idx = await loadIndex();
  if (!idx) die(`no index at ${STORE} — run: indexer.mjs build --root "<work folder>"`);
  const { meta, postings } = idx;

  const t0 = Date.now();
  const qTerms = [...new Set(tokenize(q).concat(pathTokens(q)))];
  const N = meta.docCount || 1;
  const k1 = 1.5, b = 0.75, avgdl = meta.avgdl || 1;
  const scores = new Map(); // id -> score

  // id -> relPath for output
  const byId = new Map();
  for (const [relPath, d] of Object.entries(meta.docs)) byId.set(d.id, { relPath, len: d.len });

  for (const term of qTerms) {
    const arr = postings[term];
    if (!arr) continue;
    const dft = meta.df[term] || arr.length;
    const idf = Math.log(1 + (N - dft + 0.5) / (dft + 0.5));
    for (const [id, tf] of arr) {
      const dl = byId.get(id)?.len || avgdl;
      const denom = tf + k1 * (1 - b + b * (dl / avgdl));
      const s = idf * (tf * (k1 + 1)) / denom;
      scores.set(id, (scores.get(id) || 0) + s);
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP);
  const hits = [];
  for (const [id, score] of ranked) {
    const info = byId.get(id);
    if (!info) continue;
    const absPath = join(meta.root, info.relPath);
    let mtime = null, snippet = null;
    try { mtime = new Date((await stat(absPath)).mtimeMs).toISOString().slice(0, 10); } catch {}
    snippet = await makeSnippet(absPath, qTerms);
    hits.push({ path: info.relPath, score: Number(score.toFixed(3)), modified: mtime, snippet });
  }

  const ms = Date.now() - t0;
  if (AS_JSON) {
    console.log(JSON.stringify({ query: q, store: STORE, ms, hits }, null, 2));
  } else {
    console.log('');
    console.log(`  "${q}"  →  ${hits.length} hits in ${ms}ms  (index: ${meta.docCount} docs)`);
    console.log('');
    for (const h of hits) {
      console.log(`  • ${h.path}${h.modified ? `  (${h.modified})` : ''}`);
      if (h.snippet) console.log(`      …${h.snippet}…`);
    }
    if (!hits.length) console.log('  (nothing matched — try other words, or rebuild if files changed)');
    console.log('');
  }
}

// pull a short context window around the first query-term hit in the body
async function makeSnippet(absPath, qTerms) {
  const ext = extname(absPath).toLowerCase();
  if (!TEXT_EXT.has(ext)) return null; // body not indexed → no snippet, the path is the hit
  let body;
  try { body = (await readFile(absPath)).slice(0, MAX_TEXT_BYTES).toString('utf8'); }
  catch { return null; }
  const lower = body.toLowerCase();
  let at = -1;
  for (const t of qTerms) { const i = lower.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
  if (at < 0) return null;
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(body.length, at + SNIPPET_RADIUS);
  return body.slice(start, end).replace(/\s+/g, ' ').trim();
}

// ---- stats -----------------------------------------------------------------
async function stats() {
  const idx = await loadIndex();
  if (!idx) die(`no index at ${STORE}`);
  const { meta, postings } = idx;
  console.log('');
  console.log(`  TARS index — ${STORE}`);
  console.log(`  root:       ${meta.root}`);
  console.log(`  built:      ${meta.builtAt}`);
  console.log(`  documents:  ${meta.docCount}`);
  console.log(`  terms:      ${Object.keys(postings).length}`);
  console.log(`  avg length: ${Math.round(meta.avgdl)} terms/doc`);
  console.log('');
}

// ---- dispatch --------------------------------------------------------------
function die(m) { console.error(`  error: ${m}`); process.exit(1); }

switch (cmd) {
  case 'build':  await build({ incremental: false }); break;
  case 'update': await build({ incremental: true }); break;
  case 'query':  await query(); break;
  case 'stats':  await stats(); break;
  default:
    console.log('usage: indexer.mjs <build|update|query|stats> [options]');
    console.log('  build  --root "<work folder>" [--store <dir>]');
    console.log('  update --root "<work folder>" [--store <dir>]');
    console.log('  query  "<text>" [--store <dir>] [--top 8] [--json]');
    console.log('  stats  [--store <dir>]');
    process.exit(cmd ? 1 : 0);
}
