import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { repoRoot, skillSource } from './paths.mjs';

export function runNodeScript(relPath, args = [], { cwd, json = false } = {}) {
  const script = relPath.startsWith('/')
    ? relPath
    : join(repoRoot(), relPath);
  const r = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    cwd: cwd || repoRoot(),
  });
  if (r.error) return { ok: false, error: r.error.message, stdout: '', stderr: '' };
  const out = (r.stdout || '').trim();
  const err = (r.stderr || '').trim();
  if (json && out) {
    try { return { ok: r.status === 0, data: JSON.parse(out), stdout: out, stderr: err, status: r.status }; }
    catch { return { ok: false, error: 'invalid json', stdout: out, stderr: err, status: r.status }; }
  }
  return { ok: r.status === 0, stdout: out, stderr: err, status: r.status };
}

export function indexerScript() {
  return join(skillSource(), 'scripts', 'indexer.mjs');
}

export function scanScript() {
  return join(skillSource(), 'scripts', 'scan.mjs');
}

export function connectorsScript() {
  return join(skillSource(), 'scripts', 'connectors.mjs');
}
