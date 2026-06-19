#!/usr/bin/env node
// context-engine.mjs — merge local index + workspace map + connector routes for a question.
//
//   node scripts/context-engine.mjs "prep me for ACME 3pm" --root "<work>" [--workspace "<CoS>"] [--json]
//   node scripts/context-engine.mjs "..." --tools '["mcp__granola__list_meetings"]'

import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (f) => argv.includes(f);
const QUESTION = argv.find(a => !a.startsWith('--')) || null;
const ROOT = arg('--root', null);
const WS = arg('--workspace', ROOT ? join(ROOT, 'Chief of Staff') : null);
const AS_JSON = has('--json');
const TOOLS = arg('--tools', null);

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexer = join(REPO, 'skills', 'chief-of-staff', 'scripts', 'indexer.mjs');
const connectors = join(REPO, 'skills', 'chief-of-staff', 'scripts', 'connectors.mjs');

const ENTITY_RE = /\b([A-Z][A-Za-z0-9&.-]{1,30})\b|(?:with|for|about)\s+([a-zA-Z][\w.-]{2,20})/g;
const ROUTE_HINTS = [
  { re: /meeting|call|3pm|calendar|schedule|prep/i, connector: 'granola', alt: 'microsoft 365', use: 'meeting notes and calendar' },
  { re: /email|mail|thread|inbox|sent/i, connector: 'gmail', alt: 'microsoft 365', use: 'mail threads' },
  { re: /issue|ticket|linear|deadline|sprint/i, connector: 'linear', use: 'project status' },
  { re: /notion|wiki|spec|doc page/i, connector: 'notion', use: 'structured docs' },
  { re: /proposal|report|contract|numbers|file|document|folder/i, source: 'local-index', use: 'files on disk' },
];

function tokenizeEntities(q) {
  const out = new Set();
  let m;
  while ((m = ENTITY_RE.exec(q))) {
    for (const g of m.slice(1)) if (g && g.length > 2) out.add(g);
  }
  return [...out];
}

async function readAliases(ws) {
  const map = Object.create(null);
  try {
    const text = await readFile(join(ws, 'ALIASES.md'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^[-*]\s*`?([^`→]+)`?\s*→\s*(.+)$/);
      if (m) map[m[1].trim().toLowerCase()] = m[2].trim();
    }
  } catch {}
  return map;
}

async function clientBriefs(ws, entities) {
  const hits = [];
  try {
    const dir = join(ws, 'Clients');
    const files = await readdir(dir);
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      const name = basename(f, '.md');
      const match = entities.some(e => name.toLowerCase().includes(e.toLowerCase()) || e.toLowerCase().includes(name.toLowerCase()));
      if (match || !entities.length) hits.push({ client: name, path: join('Clients', f) });
    }
  } catch {}
  return hits.slice(0, 5);
}

function runJson(script, args) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
}

async function connectorCache(store, toolsArg) {
  const cacheDir = join(store, 'connectors');
  await mkdir(cacheDir, { recursive: true });
  const cacheFile = join(cacheDir, 'latest.json');
  const args = ['--json'];
  if (toolsArg) args.push('--tools', toolsArg);
  const data = runJson(connectors, args);
  if (data) {
    await writeFile(cacheFile, JSON.stringify({ ...data, cachedAt: new Date().toISOString() }, null, 2));
    return data;
  }
  try {
    return JSON.parse(await readFile(cacheFile, 'utf8'));
  } catch { return { connectors: [], available: false }; }
}

async function indexQuery(root, q, top = 8) {
  return runJson(indexer, ['query', q, '--root', root, '--top', String(top), '--json']);
}

async function run() {
  if (!QUESTION) { console.error('usage: context-engine.mjs "<question>" --root "<work folder>"'); process.exit(1); }
  if (!ROOT) { console.error('error: --root required'); process.exit(1); }

  const store = join(ROOT, '.tars-index');
  const aliases = WS ? await readAliases(WS) : {};
  let entities = tokenizeEntities(QUESTION);
  entities = entities.map(e => aliases[e.toLowerCase()] || e);

  const routes = ROUTE_HINTS.filter(h => h.re.test(QUESTION)).map(h => ({
    route: h.connector || h.source,
    use: h.use,
    alt: h.alt || null,
  }));

  const clients = WS ? await clientBriefs(WS, entities) : [];
  const conn = await connectorCache(store, TOOLS);
  const connected = (conn.connected || []).map(c => c.key || c.name?.toLowerCase());

  const indexHits = await indexQuery(ROOT, entities.length ? entities.join(' ') : QUESTION);
  const fileHits = (indexHits?.hits || []).map(h => ({
    type: 'file',
    path: h.path,
    score: h.score,
    snippet: h.snippet,
    modified: h.modified,
    cite: `file:${h.path}`,
  }));

  const connectorRoutes = routes.map(r => ({
    type: 'connector',
    connector: r.route,
    available: connected.some(c => c.includes(r.route)) || connected.some(c => r.alt && c.includes(r.alt)),
    use: r.use,
    cite: `connector:${r.route}`,
  }));

  const sources = [...fileHits.slice(0, 6), ...connectorRoutes];
  const result = {
    question: QUESTION,
    entities,
    routes: connectorRoutes,
    clients,
    sources,
    guidance: 'Cite real sources (file path, mail, or meeting). Do not cite workspace map alone.',
  };

  if (AS_JSON) console.log(JSON.stringify(result, null, 2));
  else {
    console.log('');
    console.log(`  Context for: "${QUESTION}"`);
    if (entities.length) console.log(`  entities: ${entities.join(', ')}`);
    console.log('');
    console.log('  Routes:');
    for (const r of connectorRoutes) {
      console.log(`  · ${r.connector} (${r.available ? 'connected' : 'check connector'}) — ${r.use}`);
    }
    console.log('');
    console.log('  File hits:');
    for (const h of fileHits.slice(0, 5)) console.log(`  · ${h.path}  score=${h.score}`);
    console.log('');
  }
}

await run();
