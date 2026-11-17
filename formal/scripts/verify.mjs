#!/usr/bin/env node
// Checks the Lean models: no sorry/admit/axiom/unsafe escape hatches, `lake build` succeeds,
// and every theorem depends only on Lean's standard axioms (propext, Classical.choice, Quot.sound).
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const formal = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(formal, 'CadloomFormal');
const lake = process.env.LAKE ?? (() => { try { execFileSync('lake', ['--version']); return 'lake'; } catch { return join(homedir(), '.elan', 'bin', 'lake'); } })();
const modules = readdirSync(dir).filter((f) => f.endsWith('.lean')).sort();
const banned = /\b(sorry|admit|native_decide|implemented_by|extern)\b|^\s*(axiom|unsafe|@\[extern)/m;
const theorems = [];
for (const file of modules) {
  const src = readFileSync(join(dir, file), 'utf8').replace(/\/-[\s\S]*?-\//g, '').replace(/--.*$/gm, '');
  const bad = src.match(banned);
  if (bad) { console.error(`${file}: forbidden construct '${bad[0].trim()}'`); process.exit(1); }
  let ns = [];
  for (const line of src.split('\n')) {
    const open = line.match(/^namespace\s+(\S+)/); if (open) ns.push(open[1]);
    const close = line.match(/^end\s+(\S+)/); if (close && ns.at(-1) === close[1]) ns.pop();
    const thm = line.match(/^(?:@\[[^\]]*\]\s*)?theorem\s+([^\s(:{[]+)/);
    if (thm) theorems.push([...ns, thm[1]].join('.'));
  }
}
const root = modules.map((f) => `import CadloomFormal.${f.replace(/\.lean$/, '')}`).join('\n') + '\n';
writeFileSync(join(formal, 'CadloomFormal.lean'), root);
const audit = join(formal, 'Audit.lean');
writeFileSync(audit, `import CadloomFormal\n${theorems.map((t) => `#print axioms ${t}`).join('\n')}\n`);
try {
  execFileSync(lake, ['build'], { cwd: formal, stdio: 'inherit' });
  const out = execFileSync(lake, ['env', 'lean', 'Audit.lean'], { cwd: formal, encoding: 'utf8' });
  const allowed = new Set(['propext', 'Classical.choice', 'Quot.sound']);
  const used = [...out.matchAll(/depends on axioms: \[([^\]]*)\]/g)].flatMap((m) => m[1].split(',').map((s) => s.trim()));
  const extra = used.filter((a) => !allowed.has(a));
  if (extra.length) { console.error(`non-standard axioms: ${[...new Set(extra)].join(', ')}`); process.exit(1); }
  if (/error/i.test(out)) { console.error(out); process.exit(1); }
  const reported = (out.match(/depends on axioms|does not depend on any axioms/g) ?? []).length;
  if (reported !== theorems.length) { console.error(`audit reported ${reported} of ${theorems.length} theorems`); process.exit(1); }
} finally { rmSync(audit, { force: true }); }
console.log(`Lean: ${modules.length} modules, ${theorems.length} theorems checked, standard axioms only.`);
