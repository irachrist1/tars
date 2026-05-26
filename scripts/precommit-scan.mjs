#!/usr/bin/env node
// precommit-scan.mjs — block a commit if staged files contain anything that
// looks like real personal data, secrets, or credentials.
//
// Install as a git hook:
//   ln -s ../../scripts/precommit-scan.mjs .git/hooks/pre-commit  (chmod +x)
// Or run manually:  node scripts/precommit-scan.mjs
//
// Exit 0 = clean, exit 1 = blocked. This is a guard, not a guarantee — a human
// still eyeballs the diff. It is deliberately noisy rather than permissive.

import { execSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';

const RULES = [
  { name: 'private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'bearer/oauth token', re: /\b(?:gho_|ghp_|github_pat_)[A-Za-z0-9_]{20,}|\bxox[baprs]-[A-Za-z0-9-]{10,}|\bsk-[A-Za-z0-9]{24,}|\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'azure client secret-ish', re: /\b[A-Za-z0-9~._-]{34,40}\b(?=.*(secret|client))/i },
  { name: 'aws access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'email address', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { name: 'absolute home path with username', re: /(?:\/Users\/|\/home\/|C:\\Users\\)(?!(?:USER|USERNAME|you|name|jane|janedoe)\b)[A-Za-z0-9_.-]+/ },
];

// Synthetic placeholders that are allowed to appear in templates/examples.
const ALLOW = /(jane|janedoe|jane\.student|john\.doe|user@example|you@example|acme|example\.(com|org)|course\s?101|placeholder|REDACTED|<.*?>|YOUR_)/i;

// Files we never scan line-by-line (binary-ish or generated).
const SKIP_PATH = /(\.lock$|\.png$|\.jpg$|\.jpeg$|\.gif$|\.pdf$|\.ico$|node_modules\/)/;

function staged() {
  const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

const findings = [];
let files = [];
try { files = staged(); } catch { /* not in a git repo / nothing staged */ }

for (const f of files) {
  if (SKIP_PATH.test(f) || !existsSync(f) || statSync(f).isDirectory()) continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (ALLOW.test(line)) return;
    for (const rule of RULES) {
      const m = line.match(rule.re);
      if (m) findings.push({ file: f, line: i + 1, rule: rule.name, hit: m[0].slice(0, 60) });
    }
  });
}

if (findings.length) {
  console.error('\n  COMMIT BLOCKED — staged files contain possible real/secret data:\n');
  for (const x of findings) {
    console.error(`  ${x.file}:${x.line}  [${x.rule}]  ${x.hit}`);
  }
  console.error('\n  If these are synthetic placeholders, adjust the ALLOW pattern in');
  console.error('  scripts/precommit-scan.mjs. Otherwise scrub them before committing.\n');
  process.exit(1);
}

console.error('precommit-scan: clean');
process.exit(0);
