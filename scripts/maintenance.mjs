#!/usr/bin/env node
// maintenance.mjs — quiet session-end checks: workspace caps, stale map hints, LOG digest.
//
//   node scripts/maintenance.mjs --workspace "<Chief of Staff dir>" [--check] [--json]
//   node scripts/maintenance.mjs --check --workspace "<dir>"   # report only, no writes

import { readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (f) => argv.includes(f);
const WS = arg('--workspace', null);
const CHECK_ONLY = has('--check');
const AS_JSON = has('--json');

const CAPS = { 'MAP.md': 250, 'USER.md': 100, 'ALIASES.md': 50, 'LOG.md': 50 };

async function lineCount(p) {
  try {
    const t = await readFile(p, 'utf8');
    return t.split('\n').filter(l => l.trim()).length;
  } catch { return 0; }
}

async function checkFile(name, path) {
  const lines = await lineCount(path);
  const cap = CAPS[name];
  if (!cap) return null;
  const over = lines > cap;
  return { file: name, lines, cap, over, action: over ? `archive stale entries from ${name} to ARCHIVE.md` : null };
}

async function run() {
  if (!WS) { console.error('error: --workspace required'); process.exit(1); }
  const items = [];
  let score = 100;

  for (const [name, cap] of Object.entries(CAPS)) {
    const r = await checkFile(name, join(WS, name));
    if (r?.over) { items.push(r); score -= 8; }
  }

  const mapPath = join(WS, 'MAP.md');
  try {
    const st = await stat(mapPath);
    const ageDays = (Date.now() - st.mtimeMs) / 864e5;
    if (ageDays > 14) {
      items.push({ file: 'MAP.md', staleDays: Math.round(ageDays), action: 'refresh map — folders may have moved' });
      score -= 10;
    }
  } catch {
    items.push({ file: 'MAP.md', missing: true, action: 'create MAP.md during onboarding' });
    score -= 25;
  }

  const logPath = join(WS, 'LOG.md');
  try {
    const log = await readFile(logPath, 'utf8');
    const entries = log.split('\n').filter(l => /^\d{4}-\d{2}-\d{2}/.test(l.trim()));
    if (entries.length > CAPS['LOG.md']) {
      if (!CHECK_ONLY) {
        const keep = entries.slice(-CAPS['LOG.md']);
        const archive = entries.slice(0, -CAPS['LOG.md']);
        const archivePath = join(WS, 'ARCHIVE.md');
        let existing = '';
        try { existing = await readFile(archivePath, 'utf8'); } catch {}
        const digest = `\n## Log digest ${new Date().toISOString().slice(0, 10)}\n${archive.map(l => `- ${l}`).join('\n')}\n`;
        await writeFile(archivePath, (existing + digest).trim() + '\n', 'utf8');
        await writeFile(logPath, keep.join('\n') + '\n', 'utf8');
        items.push({ file: 'LOG.md', archived: archive.length, action: `folded ${archive.length} old lines into ARCHIVE.md` });
      } else {
        items.push({ file: 'LOG.md', over: true, action: 'run maintenance without --check to fold old log lines' });
        score -= 5;
      }
    }
  } catch {}

  score = Math.max(0, score);
  const result = { ok: score >= 70, score, checkOnly: CHECK_ONLY, items };

  if (AS_JSON) console.log(JSON.stringify(result, null, 2));
  else {
    console.log('');
    console.log(`  Maintenance ${CHECK_ONLY ? 'check' : 'run'} — ${WS}`);
    console.log(`  readiness: ${score}/100`);
    if (!items.length) console.log('  nothing needs attention');
    for (const i of items) console.log(`  · ${i.file}: ${i.action || JSON.stringify(i)}`);
    console.log('');
  }
}

await run();
