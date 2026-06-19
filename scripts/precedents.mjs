#!/usr/bin/env node
// precedents.mjs — find last N similar docs by client + document type from local index.
//
//   node scripts/precedents.mjs --root "<work>" --client ACME --type proposal [--top 3] [--json]

import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (f) => argv.includes(f);
const ROOT = arg('--root', null);
const CLIENT = arg('--client', '');
const TYPE = arg('--type', 'document');
const TOP = parseInt(arg('--top', '3'), 10);
const AS_JSON = has('--json');

if (!ROOT) { console.error('error: --root required'); process.exit(1); }

const indexer = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'chief-of-staff', 'scripts', 'indexer.mjs');
const query = [CLIENT, TYPE].filter(Boolean).join(' ');
const r = spawnSync(process.execPath, [indexer, 'query', query, '--root', ROOT, '--top', String(TOP), '--json'], { encoding: 'utf8' });

let hits = [];
if (r.status === 0 && r.stdout) {
  try {
    const data = JSON.parse(r.stdout);
    hits = (data.hits || []).filter(h => {
      const p = h.path.toLowerCase();
      const typeMatch = !TYPE || p.includes(TYPE.toLowerCase()) || /proposal|report|contract|letter|memo|brief|deck/.test(p);
      const clientMatch = !CLIENT || p.includes(CLIENT.toLowerCase());
      return typeMatch && clientMatch;
    });
  } catch {}
}

const out = { client: CLIENT || null, type: TYPE, query, hits: hits.slice(0, TOP) };
if (AS_JSON) console.log(JSON.stringify(out, null, 2));
else {
  console.log('');
  console.log(`  Precedents for ${CLIENT || '(any)'} / ${TYPE}`);
  for (const h of out.hits) console.log(`  · ${h.path}${h.modified ? ` (${h.modified})` : ''}`);
  if (!out.hits.length) console.log('  (none found — try broader client or type)');
  console.log('');
}
