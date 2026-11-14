import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const formal = join(root, 'formal');
const status = JSON.parse(readFileSync(join(formal, 'verification-status.json'), 'utf8'));
const options = process.argv.slice(2);
if (options.some(option => !['--partial', '--require-full'].includes(option)) ||
    options.includes('--partial') && options.includes('--require-full')) {
  throw Error('Usage: node formal/scripts/verify.mjs [--partial | --require-full]');
}
function sources(directory) {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : entry.name.endsWith('.ts') ? [path] : [];
  });
}
const actualSources = sources(join(root, 'src')).map(p => p.slice(root.length)).sort();
const expectedSources = Object.keys(status.sourceSha256).sort();
if (JSON.stringify(actualSources) !== JSON.stringify(expectedSources)) throw Error('Runtime source inventory changed');
for (const [name, expected] of Object.entries(status.sourceSha256)) {
  const actual = createHash('sha256').update(readFileSync(join(root, name))).digest('hex');
  if (actual !== expected) throw Error(`Source changed: ${name}; proof correspondence requires review`);
}
console.log('Source inventory and SHA-256 match the recorded review baseline (not a proof of equivalence).');
function run(command, args, cwd = formal) {
  const child = spawnSync(command, args, {
    cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: {...process.env, PATH: `${join(homedir(), '.elan', 'bin')}${delimiter}${process.env.PATH ?? ''}`},
  });
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  if (child.error) throw child.error;
  if (child.status !== 0) throw Error(`${command} failed with status ${child.status}`);
  return child.stdout;
}
run(process.execPath, ['node_modules/typescript/bin/tsc'], root);
run(process.execPath, ['formal/scripts/extract-arithmetic.mjs', '--check'], root);
run('lake', ['build']);
const audit = run('lake', ['env', 'lean', '-DwarningAsError=true', 'Audit.lean']);
const allowed = new Set(['propext', 'Classical.choice', 'Quot.sound']);
for (const name of status.checkedTheorems) {
  const escaped = name.replaceAll('.', '\\.');
  const dependencies = audit.match(new RegExp(`'${escaped}' depends on axioms: \\[([^\\]]*)\\]`));
  const closed = audit.includes(`'${name}' does not depend on any axioms`);
  if (!dependencies && !closed) throw Error(`Missing axiom audit: ${name}`);
  for (const axiom of dependencies ? dependencies[1].split(',').map(s => s.trim()).filter(Boolean) : []) {
    if (!allowed.has(axiom)) throw Error(`Unapproved axiom ${axiom} in ${name}`);
  }
}
console.log(`Lean kernel checked ${status.checkedTheorems.length} declared theorems; axiom audit passed.`);
console.log('Scoped geometry/arithmetic verification passed; full TypeScript execution is outside scope.');
if (options.includes('--require-full')) {
  console.error('Full TypeScript execution verification is not provided.');
  process.exitCode = 2;
}
