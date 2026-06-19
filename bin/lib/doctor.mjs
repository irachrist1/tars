import { stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { detectWorkFolder, defaultSkillDest, skillSource, workspaceDir, indexStore, readVersion } from './paths.mjs';
import { runNodeScript, indexerScript, connectorsScript } from './run-script.mjs';

function scoreItem(ok, weight = 10) {
  return ok ? weight : 0;
}

export async function runDoctor({ dest = defaultSkillDest(), workRoot = detectWorkFolder(), toolsJson } = {}) {
  const checks = [];
  let score = 0;
  const max = 100;

  const srcV = await readVersion(skillSource());
  const destV = await readVersion(dest);
  const skillOk = Boolean(destV) && destV === srcV;
  checks.push({
    id: 'skill-version',
    ok: skillOk,
    message: skillOk ? `skill v${destV} current` : destV ? `skill stale (v${destV} → v${srcV})` : 'skill not installed',
    fix: skillOk ? null : 'tars install --update',
  });
  score += scoreItem(skillOk, 15);

  const ws = workspaceDir(workRoot);
  let mapOk = false;
  if (ws) {
    try { await stat(join(ws, 'MAP.md')); mapOk = true; } catch {}
  }
  checks.push({
    id: 'workspace-map',
    ok: mapOk,
    message: mapOk ? `MAP.md at ${ws}` : 'workspace MAP.md missing (first session will create it)',
    fix: mapOk ? null : 'tars open → "set up my chief of staff"',
  });
  score += scoreItem(mapOk, 20);

  const store = indexStore(workRoot);
  let indexOk = false;
  let docCount = 0;
  if (store) {
    const stats = runNodeScript(indexerScript(), ['stats', '--store', store]);
    indexOk = stats.ok;
    if (indexOk) {
      const m = stats.stdout.match(/documents:\s+(\d+)/);
      docCount = m ? parseInt(m[1], 10) : 0;
    }
  }
  checks.push({
    id: 'local-index',
    ok: indexOk && docCount > 0,
    message: indexOk ? `${docCount} documents indexed` : 'no local index — file search will be slower',
    fix: workRoot ? `tars index build --root "${workRoot}"` : 'confirm work folder, then tars index build',
  });
  score += scoreItem(indexOk && docCount > 0, 20);

  const connArgs = ['--json'];
  if (toolsJson) connArgs.push('--tools', toolsJson);
  const conn = runNodeScript(connectorsScript(), connArgs);
  let connCount = 0;
  let connOk = false;
  if (conn.ok && conn.stdout) {
    try {
      const data = JSON.parse(conn.stdout);
      connCount = (data.connected || []).length;
      connOk = data.available !== false && connCount > 0;
    } catch {}
  }
  checks.push({
    id: 'connectors',
    ok: connOk,
    message: connOk ? `${connCount} connectors mapped` : 'connector map unavailable here — enable in Claude or pass --tools',
    fix: 'Claude → Settings → Connectors (Microsoft 365 recommended)',
  });
  score += scoreItem(connOk, 15);

  let bootstrapOk = false;
  if (ws) {
    try {
      await stat(join(ws, 'workspace-bootstrap.json'));
      bootstrapOk = true;
    } catch {}
  }
  checks.push({
    id: 'bootstrap',
    ok: bootstrapOk || mapOk,
    message: bootstrapOk ? 'first-run bootstrap complete' : 'bootstrap pending',
    fix: bootstrapOk ? null : 'tars open (runs scan + index before Claude)',
  });
  score += scoreItem(bootstrapOk || mapOk, 10);

  let seedOk = false;
  try {
    await stat(join(dest, 'onboarding-seed.md'));
    seedOk = true;
  } catch {}
  checks.push({
    id: 'onboarding-seed',
    ok: seedOk || mapOk,
    message: seedOk ? 'installer seed present' : 'no seed (optional)',
    fix: null,
  });
  score += scoreItem(seedOk || mapOk, 10);

  if (workRoot) {
    checks.push({
      id: 'work-folder',
      ok: true,
      message: workRoot,
      fix: null,
    });
    score += 10;
  } else {
    checks.push({
      id: 'work-folder',
      ok: false,
      message: 'work folder not detected',
      fix: 'tars install — confirm OneDrive path',
    });
  }

  score = Math.min(max, score);
  const ready = score >= 70;
  return { ready, score, checks, workRoot, workspace: ws, skillDest: dest, skillVersion: destV || srcV };
}

export function printDoctor(result, { json = false } = {}) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log('');
  console.log('  TARS doctor');
  console.log(`  readiness: ${result.score}/100 ${result.ready ? '✓' : '— needs attention'}`);
  console.log('');
  for (const c of result.checks) {
    console.log(`  ${c.ok ? '✓' : '·'} ${c.id}: ${c.message}`);
    if (!c.ok && c.fix) console.log(`      fix: ${c.fix}`);
  }
  console.log('');
}
