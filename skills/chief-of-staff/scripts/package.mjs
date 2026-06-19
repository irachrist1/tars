#!/usr/bin/env node
// package.mjs — build an upload-ready zip for the Claude account skill store.
// Anthropic has no publish API; the user uploads via Customize → Skills → + → Upload.
//
// Usage:
//   node package.mjs                    # writes chief-of-staff.zip in cwd
//   node package.mjs --out /path/to.zip # custom output path
//
// Zip layout (required by the upload UI):
//   chief-of-staff/
//     SKILL.md
//     references/...
//     scripts/...

import { createWriteStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_NAME = 'chief-of-staff';
const argv = process.argv.slice(2);
const outArg = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;
const OUT = outArg ? outArg : join(process.cwd(), `${SKILL_NAME}.zip`);

// Files/dirs we never ship in the upload bundle.
const SKIP = new Set(['.DS_Store', 'onboarding-seed.md', `${SKILL_NAME}.zip`]);

async function collectFiles(dir, base = dir) {
  const files = [];
  for (const name of await readdir(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const s = await stat(p);
    if (s.isDirectory()) files.push(...await collectFiles(p, base));
    else files.push(relative(base, p));
  }
  return files;
}

// Prefer the system `zip` when available (correct folder-at-root layout).
function zipWithCli(files) {
  const r = spawnSync('zip', ['-r', OUT, SKILL_NAME], {
    cwd: dirname(SKILL_DIR),
    encoding: 'utf8',
  });
  return !r.error && r.status === 0;
}

// Minimal zip writer when `zip` isn't installed (no dependencies).
async function zipManual(files) {
  const { createDeflateRaw } = await import('node:zlib');
  const { pipeline } = await import('node:stream/promises');
  const { Readable } = await import('node:stream');
  const { open } = await import('node:fs/promises');

  const entries = [];
  for (const rel of files.sort()) {
    const abs = join(SKILL_DIR, rel);
    const data = await (await import('node:fs/promises')).readFile(abs);
    const name = `${SKILL_NAME}/${rel.replace(/\\/g, '/')}`;
    entries.push({ name, data });
  }

  const parts = [];
  let offset = 0;
  const central = [];

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const compressed = await new Promise((res, rej) => {
      const chunks = [];
      const def = createDeflateRaw();
      def.on('data', (c) => chunks.push(c));
      def.on('end', () => res(Buffer.concat(chunks)));
      def.on('error', rej);
      def.end(data);
    });
    const crc = crc32(data);
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    const localOffset = offset;
    parts.push(local, compressed);
    offset += local.length + compressed.length;

    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(localOffset, 42);
    nameBuf.copy(cd, 46);
    central.push(cd);
  }

  const centralStart = offset;
  for (const cd of central) { parts.push(cd); offset += cd.length; }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.reduce((n, b) => n + b.length, 0), 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);
  parts.push(end);

  const out = await open(OUT, 'w');
  for (const part of parts) await out.write(part);
  await out.close();
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

const files = await collectFiles(SKILL_DIR);
if (!files.includes('SKILL.md')) {
  console.error('error: SKILL.md not found in skill folder');
  process.exit(1);
}

const usedCli = zipWithCli(files);
if (!usedCli) await zipManual(files);

console.log(`✓ ${OUT}`);
console.log(`  ${files.length} files, folder-at-root: ${SKILL_NAME}/`);
console.log('');
console.log('Upload: Claude → Customize → Skills → + → Upload a skill');
console.log('See PUBLISHING.md for personal vs org visibility and how to refresh.');
