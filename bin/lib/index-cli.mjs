import { spawnSync } from 'node:child_process';
import { detectWorkFolder, indexStore } from './paths.mjs';
import { indexerScript } from './run-script.mjs';

export async function runIndexCommand(sub, args) {
  const rootIdx = args.indexOf('--root');
  const root = rootIdx >= 0 ? args[rootIdx + 1] : detectWorkFolder();
  const pass = ['--json'];

  if (sub === 'build' || sub === 'update') {
    if (!root) {
      console.error('  error: --root "<work folder>" required');
      process.exit(1);
    }
    pass.unshift(sub, '--root', root);
  } else if (sub === 'stats') {
    const store = root ? indexStore(root) : null;
    if (!store) {
      console.error('  error: --root required for stats');
      process.exit(1);
    }
    pass.unshift('stats', '--store', store);
  } else if (sub === 'query') {
    const queryParts = args.filter(a => !a.startsWith('--') && !['build', 'update', 'query', 'stats'].includes(a));
    const q = queryParts.join(' ');
    if (!q) {
      console.error('  error: query text required — tars index query "ACME proposal"');
      process.exit(1);
    }
    if (root) pass.push('--root', root);
    else if (args.includes('--store')) {
      const si = args.indexOf('--store');
      pass.push('--store', args[si + 1]);
    } else {
      console.error('  error: --root or --store required');
      process.exit(1);
    }
    const topIdx = args.indexOf('--top');
    if (topIdx >= 0) pass.push('--top', args[topIdx + 1]);
    pass.unshift('query', q);
  } else {
    console.error('  usage: tars index build|update|query|stats');
    process.exit(1);
  }

  const r = spawnSync(process.execPath, [indexerScript(), ...pass], { encoding: 'utf8' });
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.error(r.stderr);
  process.exit(r.status ?? (r.ok ? 0 : 1));
}
