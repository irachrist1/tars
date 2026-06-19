import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
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
  if (!r.ok) {
    if (r.stderr) console.error(r.stderr);
    process.exit(1);
  }
  process.exit(0);
}

export async function runMaintenanceCheck(workRoot) {
  const root = workRoot || detectWorkFolder();
  const ws = workspaceDir(root);
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
  const fixture = resolve(repoRoot(), 'tests', 'fixtures', 'work-corpus');
  try { await stat(fixture); } catch {
    console.error('  error: fixture corpus missing');
    process.exit(1);
  }
  console.log('  TARS demo — fixture corpus');
  console.log('');

  const build = runNodeScript(indexerScript(), ['build', '--root', fixture, '--json']);
  if (!build.ok) {
    console.error('  error: index build failed');
    if (build.stderr) console.error(build.stderr);
    if (build.stdout) console.error(build.stdout);
    process.exit(1);
  }

  const q = runNodeScript(indexerScript(), ['query', 'ACME proposal numbers', '--root', fixture, '--json']);
  if (!q.ok || !q.stdout) {
    console.error('  error: index query failed');
    if (q.stderr) console.error(q.stderr);
    process.exit(1);
  }

  let data;
  try { data = JSON.parse(q.stdout); } catch {
    console.error('  error: invalid query response');
    process.exit(1);
  }

  if (!data.hits?.length) {
    console.error('  error: expected ACME hits in fixture corpus');
    process.exit(1);
  }

  console.log(`  Query: "${data.query}" → ${data.hits.length} hits in ${data.ms}ms`);
  for (const h of data.hits.slice(0, 3)) console.log(`    · ${h.path}`);
  console.log('');
  console.log('  Run `tars doctor --fixture` for full readiness check.');
}
