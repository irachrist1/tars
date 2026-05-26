#!/usr/bin/env node
// normalize.mjs — turn a raw detection blob into the capability model.
// Reads raw JSON from a --file or stdin (output of windows-probe / mac-probe),
// matches every detected name against config/app-registry.json, and emits
// capabilities.json: which capabilities are present, by which provider, at
// which adapter tier, plus archetype scores for the profile stage.
//
// Usage:
//   node mac-probe.mjs | node normalize.mjs
//   node normalize.mjs --file raw.json [--pretty]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(readFileSync(join(here, '../../config/app-registry.json'), 'utf8'));

// ---- read raw input -------------------------------------------------------
const argv = process.argv.slice(2);
const fileArg = argv[argv.indexOf('--file') + 1];
const pretty = argv.includes('--pretty');
let raw;
if (fileArg && argv.includes('--file')) {
  raw = JSON.parse(readFileSync(fileArg, 'utf8'));
} else {
  raw = JSON.parse(readFileSync(0, 'utf8')); // stdin
}

// Flatten every detected name into one searchable list.
const names = [
  ...(raw.apps || []),
  ...(raw.packages || []),
  ...(raw.brewFormulae || []),
  ...(raw.brewCasks || []),
  ...(raw.startMenu || []),
  ...(raw.uninstall || []),
  raw.defaultBrowser || '',
  raw.defaultMail || '',
].filter(Boolean);
const hay = names.join('\n');
const os = raw.os || 'unknown';

// ---- match providers ------------------------------------------------------
const TIER_RANK = { connector: 3, local: 2, manual: 1 };
const CAPS = ['notes', 'tasks', 'calendar', 'meeting-notes', 'email', 'read-later', 'behavior-data', 'files', 'code'];
const caps = {};
for (const c of CAPS) caps[c] = { present: false, providers: [], chosen: null };

const matchedCapsForArchetype = new Set();

for (const p of registry.providers) {
  if (p.os && p.os !== os) continue;
  const re = new RegExp(p.match, 'i');
  if (re.test(hay)) {
    const cap = caps[p.capability];
    if (!cap) continue;
    cap.present = true;
    cap.providers.push({ id: p.id, tier: p.tier, interface: !!p.interface, note: p.note || '' });
    matchedCapsForArchetype.add(p.capability);
  }
}

// chosen = best-tier provider per capability
for (const c of CAPS) {
  const cap = caps[c];
  if (!cap.present) { cap.tier = 'manual'; continue; }
  cap.providers.sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier]);
  cap.chosen = cap.providers[0].id;
  cap.tier = cap.providers[0].tier;
}

// ---- archetype scoring ----------------------------------------------------
const scores = {};
for (const [arch, def] of Object.entries(registry.archetypeSignals)) {
  let s = 0;
  for (const c of def.capabilities) if (matchedCapsForArchetype.has(c)) s += def.weight;
  scores[arch] = s;
}
const ranked = Object.entries(scores).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);

// School/work tenant hints sharpen student vs consultant later.
const tenantHints = raw.tenantHints || [];

const out = {
  os,
  generatedAt: new Date().toISOString(),
  capabilities: caps,
  archetypeScores: scores,
  archetypeRanked: ranked.map(([a]) => a),
  tenantHints,
  summary: CAPS
    .filter((c) => caps[c].present)
    .map((c) => `${c}:${caps[c].chosen}(${caps[c].tier})`),
};

process.stdout.write(JSON.stringify(out, null, pretty ? 2 : 0) + '\n');
