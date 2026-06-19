#!/usr/bin/env node
// Cross-platform CI smoke tests — asserts 100/100 doctor on fixture env.

import { spawnSync } from 'node:child_process';
import { cp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = join(ROOT, 'bin', 'install.mjs');
const FIX = join(ROOT, 'tests', 'fixtures', 'work-corpus');
const DEST = join(ROOT, 'tests', 'fixtures', '.skill-install');
const WS = join(FIX, 'Chief of Staff');
const TOOLS = '["mcp__granola__list_meetings","mcp__linear__list_issues","mcp__notion__search"]';

function fail(msg, detail = '') {
  console.error(`FAIL: ${msg}`);
  if (detail) console.error(detail);
  process.exit(1);
}

function run(args, { expect = 0 } = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', cwd: ROOT });
  if ((r.status ?? 1) !== expect) {
    fail(`node bin/install.mjs ${args.join(' ')}`, r.stdout || r.stderr || String(r.error));
  }
  return (r.stdout || '') + (r.stderr || '');
}

async function setupFixture() {
  await rm(join(FIX, '.tars-index'), { recursive: true, force: true });
  await rm(WS, { recursive: true, force: true });
  await rm(DEST, { recursive: true, force: true });
  await mkdir(DEST, { recursive: true });
  await cp(join(ROOT, 'skills', 'chief-of-staff'), DEST, { recursive: true });
  await mkdir(join(WS, 'Clients'), { recursive: true });
  await writeFile(join(WS, 'MAP.md'), '# Map\n\n- **ACME** — active client, proposals in Clients/ACME/\n');
  await writeFile(join(WS, 'workspace-bootstrap.json'), JSON.stringify({ completedAt: new Date().toISOString(), workRoot: FIX }) + '\n');
  await writeFile(join(DEST, 'onboarding-seed.md'), '# seed\n- name: Test User\n');
  run(['index', 'build', '--root', FIX]);
}

async function main() {
  console.log('== tars help ==');
  if (!run(['help']).includes('TARS')) fail('help missing TARS');

  console.log('== tars use --continue ==');
  if (!run(['--use', '--continue', '--no-launch']).includes('chief of staff')) fail('use mode failed');

  console.log('== tars demo ==');
  run(['demo']);

  console.log('== tars export --chatgpt ==');
  if (!run(['export', '--chatgpt']).includes('ChatGPT')) fail('export failed');

  console.log('== indexer query perf ==');
  const q = spawnSync(process.execPath, [
    join(ROOT, 'skills/chief-of-staff/scripts/indexer.mjs'),
    'query', 'ACME numbers', '--root', FIX, '--json',
  ], { encoding: 'utf8', cwd: ROOT });
  if (q.status !== 0) fail('indexer query', q.stderr || q.stdout);
  const perf = JSON.parse(q.stdout);
  if (perf.ms >= 500) fail(`indexer too slow: ${perf.ms}ms`);

  console.log('== fixture setup + doctor 100/100 ==');
  await setupFixture();
  const doc = spawnSync(process.execPath, [
    CLI, 'doctor', '--json', '--root', FIX, '--dest', DEST, '--tools', TOOLS,
  ], { encoding: 'utf8', cwd: ROOT });
  if (doc.status !== 0) fail('doctor exit', doc.stderr || doc.stdout);
  const doctor = JSON.parse(doc.stdout);
  if (doctor.score !== 100 || !doctor.ready) fail('doctor not 100/100', JSON.stringify(doctor, null, 2));
  for (const c of doctor.checks) {
    if (!c.ok) fail(`check ${c.id}`, c.message);
  }

  console.log('== tars doctor --fixture ==');
  await setupFixture();
  const fixDocRaw = spawnSync(process.execPath, [CLI, 'doctor', '--fixture', '--json', '--dest', DEST, '--tools', TOOLS], { encoding: 'utf8', cwd: ROOT });
  if (fixDocRaw.status !== 0) fail('doctor --fixture exit', fixDocRaw.stderr || fixDocRaw.stdout);
  const fixDoc = JSON.parse(fixDocRaw.stdout);
  if (fixDoc.score !== 100 || !fixDoc.ready) fail('fixture doctor not 100/100', JSON.stringify(fixDoc, null, 2));

  console.log('== npm run package ==');
  const pkgRun = spawnSync('npm', ['run', 'package', '--silent'], { encoding: 'utf8', cwd: ROOT, shell: true });
  if (!pkgRun.stdout?.includes('MANIFEST')) fail('package failed', pkgRun.stderr || pkgRun.stdout);

  console.log('All CLI tests passed (doctor 100/100).');
}

main().catch((e) => fail(String(e)));
