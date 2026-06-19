import { runDoctor, printDoctor } from './doctor.mjs';

export async function runStatus(opts) {
  const d = await runDoctor(opts);
  printDoctor(d, opts);
  return d;
}
