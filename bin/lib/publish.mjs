import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot, skillSource } from './paths.mjs';

function tryCopy(text) {
  if (!process.stdout.isTTY && !process.env.FORCE_CLIPBOARD) return false;
  try {
    const opts = { input: text, timeout: 2000 };
    if (process.platform === 'darwin') {
      const r = spawnSync('pbcopy', opts);
      return !r.error && r.status === 0;
    }
    if (process.platform === 'win32') {
      const r = spawnSync('clip', { ...opts, shell: true });
      return !r.error && r.status === 0;
    }
    for (const [cmd, ...args] of [['xclip', '-selection', 'clipboard'], ['wl-copy']]) {
      const r = spawnSync(cmd, args, opts);
      if (!r.error && r.status === 0) return true;
    }
  } catch {}
  return false;
}

export async function runPublish() {
  const root = repoRoot();
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'package.mjs')], {
    stdio: 'inherit',
    cwd: root,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);

  const zip = join(root, 'dist', 'chief-of-staff.zip');
  console.log('');
  console.log('  Cowork / claude.ai publish steps:');
  console.log('  1. Open Claude → Customize → Skills → + → Upload a skill');
  console.log(`  2. Select: ${zip}`);
  console.log('  3. Confirm upload — re-upload when you update TARS');
  console.log('');
  console.log('  Full guide: docs/cowork-publish/README.md');
  console.log('             skills/chief-of-staff/references/publishing.md');
  console.log('');

  try {
    await readFile(zip);
    console.log('  Bundle ready. Upload the zip above.');
  } catch {
    console.log('  Note: zip build failed — run `npm run package` after installing `zip`.');
  }
}

export async function runExportChatGPT({ dest = skillSource() } = {}) {
  const skillMd = await readFile(join(dest, 'SKILL.md'), 'utf8');
  const wrapped = `# TARS Chief of Staff — ChatGPT custom instructions

Paste this into ChatGPT → Settings → Personalization → Custom instructions (or a GPT's Instructions field).

---

You are the user's chief of staff. Follow these operating rules from TARS:

${skillMd.trim()}

---

Important for ChatGPT: you do not have Claude connectors or local file access. Ask the user to paste relevant files, or use Microsoft 365 / Google integrations when available. Never claim you read files you cannot access.

User request:`;

  console.log(wrapped);
  if (tryCopy(wrapped)) {
    console.error('');
    console.error('  (Copied to clipboard.)');
  }
}