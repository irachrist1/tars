import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoRoot, detectWorkFolder, workspaceDir } from './paths.mjs';
import { runNodeScript, indexerScript } from './run-script.mjs';

export function runWatchOnce(workRoot = detectWorkFolder()) {
  if (!workRoot) {
    console.error('  error: no work folder — pass --root');
    process.exit(1);
  }
  console.log(`  Incremental index update for ${workRoot}…`);
  const r = runNodeScript(indexerScript(), ['update', '--root', workRoot, '--json']);
  if (r.stdout) console.log(r.stdout);
  process.exit(r.ok ? 0 : 1);
}

export async function runMaintenanceCheck(workRoot = detectWorkFolder()) {
  const ws = workspaceDir(workRoot);
  if (!ws) {
    console.log('  no workspace yet — nothing to maintain');
    return;
  }
  try { await stat(join(ws, 'MAP.md')); } catch {
    console.log('  workspace not initialized');
    return;
  }
  const script = join(repoRoot(), 'scripts', 'maintenance.mjs');
  spawnSync(process.execPath, [script, '--workspace', ws, '--check'], { stdio: 'inherit' });
}

export async function runDemo() {
  const fixture = join(repoRoot(), 'tests', 'fixtures', 'work-corpus');
  try { await stat(fixture); } catch {
    console.error('  error: fixture corpus missing');
    process.exit(1);
  }
  console.log('  TARS demo — fixture corpus');
  console.log('');
  runNodeScript(indexerScript(), ['build', '--root', fixture, '--json']);
  const q = runNodeScript(indexerScript(), ['query', 'ACME proposal numbers', '--root', fixture, '--json']);
  if (q.stdout) {
    try {
      const data = JSON.parse(q.stdout);
      console.log(`  Query: "${data.query}" → ${data.hits?.length || 0} hits in ${data.ms}ms`);
      for (const h of (data.hits || []).slice(0, 3)) console.log(`    · ${h.path}`);
    } catch {}
  }
  console.log('');
  console.log('  Run `tars doctor` on your machine for live readiness.');
}
