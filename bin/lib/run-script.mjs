import { spawnSync } from 'node:child_process';
import { join, isAbsolute } from 'node:path';
import { repoRoot } from './paths.mjs';

export function resolveScript(relPath) {
  return isAbsolute(relPath) ? relPath : join(repoRoot(), relPath);
}

export function runNodeScript(relPath, args = [], { cwd, json = false } = {}) {
  const script = resolveScript(relPath);
  const r = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    cwd: cwd || repoRoot(),
    shell: false,
  });
  if (r.error) return { ok: false, error: r.error.message, stdout: '', stderr: '', status: 1 };
  const out = (r.stdout || '').trim();
  const err = (r.stderr || '').trim();
  if (json && out) {
    try { return { ok: r.status === 0, data: JSON.parse(out), stdout: out, stderr: err, status: r.status ?? 1 }; }
    catch { return { ok: false, error: 'invalid json', stdout: out, stderr: err, status: r.status ?? 1 }; }
  }
  return { ok: r.status === 0, stdout: out, stderr: err, status: r.status ?? 1 };
}

export function indexerScript() {
  return 'skills/chief-of-staff/scripts/indexer.mjs';
}

export function scanScript() {
  return 'skills/chief-of-staff/scripts/scan.mjs';
}

export function connectorsScript() {
  return 'skills/chief-of-staff/scripts/connectors.mjs';
}
