import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

export const SKILL_NAME = 'chief-of-staff';

export function repoRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function skillSource() {
  return join(repoRoot(), 'skills', SKILL_NAME);
}

export function defaultSkillDest() {
  return join(homedir(), '.claude', 'skills', SKILL_NAME);
}

export function findNestedOrgOneDrive(dir, depth = 0, maxDepth = 2) {
  const found = [];
  if (depth > maxDepth) return found;
  let entries;
  try { entries = readdirSync(dir); } catch { return found; }
  for (const name of entries) {
    const p = join(dir, name);
    try { if (!statSync(p).isDirectory()) continue; } catch { continue; }
    if (/^OneDrive\s*-\s*\S/i.test(name) && !/personal/i.test(name)) found.push(p);
    if (depth < maxDepth) found.push(...findNestedOrgOneDrive(p, depth + 1, maxDepth));
  }
  return found;
}

export function detectWorkFolder() {
  const home = homedir();
  const candidates = [];
  if (process.platform === 'darwin') {
    const cs = join(home, 'Library', 'CloudStorage');
    try {
      for (const d of readdirSync(cs)) {
        if (/^OneDrive/i.test(d)) candidates.push(join(cs, d));
      }
    } catch {}
  }
  if (process.platform === 'win32') {
    try {
      for (const name of readdirSync(home)) {
        if (!/^OneDrive/i.test(name)) continue;
        const top = join(home, name);
        try { if (statSync(top).isDirectory()) candidates.push(top); } catch {}
        candidates.push(...findNestedOrgOneDrive(top));
      }
    } catch {}
  } else {
    for (const name of ['OneDrive', 'OneDrive - Personal']) {
      const p = join(home, name);
      try { if (statSync(p).isDirectory()) candidates.push(p); } catch {}
    }
  }
  const unique = [...new Set(candidates)];
  const org = unique.find(p => /OneDrive\s*-\s*\S/i.test(p) && !/personal/i.test(p));
  return org || unique[0] || null;
}

export function workspaceDir(workRoot = detectWorkFolder()) {
  return workRoot ? join(workRoot, 'Chief of Staff') : null;
}

export function indexStore(workRoot = detectWorkFolder()) {
  return workRoot ? join(workRoot, '.tars-index') : null;
}

export async function readVersion(dir) {
  return (await readFile(join(dir, 'VERSION'), 'utf8').catch(() => '')).trim();
}

export async function readBootstrap(workRoot) {
  const ws = workspaceDir(workRoot);
  if (!ws) return null;
  try {
    const raw = await readFile(join(ws, 'workspace-bootstrap.json'), 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}
