import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const source = ts.createSourceFile('segment-intersection.ts',
  readFileSync(new URL('src/geometry/segment-intersection.ts', root), 'utf8'),
  ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
const fn = source.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === 'intersectSegments');
if (!fn?.body) throw Error('intersectSegments body missing');
const bindings = new Map();
for (const statement of fn.body.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name) || !declaration.initializer) throw Error('Unsupported binding');
    bindings.set(declaration.name.text, declaration.initializer);
  }
}
const coordinates = new Map([
  ['a.start.x', 'a.x'], ['a.start.y', 'a.y'], ['a.end.x', 'b.x'], ['a.end.y', 'b.y'],
  ['b.start.x', 'c.x'], ['b.start.y', 'c.y'], ['b.end.x', 'd.x'], ['b.end.y', 'd.y'],
]);
const operators = new Map([['add', '+'], ['sub', '-'], ['mul', '*'], ['div', '/']]);
function expression(node, active = new Set()) {
  if (ts.isParenthesizedExpression(node)) return expression(node.expression, active);
  const coordinate = coordinates.get(node.getText(source));
  if (coordinate) return coordinate;
  if (ts.isIdentifier(node)) {
    if (active.has(node.text) || !bindings.has(node.text)) throw Error(`Unsupported identifier: ${node.text}`);
    return expression(bindings.get(node.text), new Set([...active, node.text]));
  }
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.arguments.length === 1) {
    const op = operators.get(node.expression.name.text);
    if (op) return `(${expression(node.expression.expression, active)} ${op} ${expression(node.arguments[0], active)})`;
  }
  throw Error(`Unsupported source arithmetic: ${node.getText(source)}`);
}
const last = fn.body.statements.at(-1);
if (!ts.isReturnStatement(last) || !last.expression || !ts.isObjectLiteralExpression(last.expression)) {
  throw Error('Unexpected final return');
}
const point = last.expression.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(source) === 'point');
if (!point || !ts.isCallExpression(point.initializer) || point.initializer.expression.getText(source) !== 'point2' || point.initializer.arguments.length !== 2) {
  throw Error('Unexpected intersection point construction');
}
const declarations = [
  ['sourceDeterminant', expression(bindings.get('denominator'))],
  ['sourceT', expression(bindings.get('t'))],
  ['sourceU', expression(bindings.get('u'))],
];
let output = `-- Generated from the TypeScript AST. Do not edit by hand.
-- The extractor is a trusted translation tool, NOT a verified JS compiler.
-- Rational methods are interpreted as mathematical rational operations here.
import Cadloom
namespace Cadloom
`;
for (const [name, body] of declarations) output += `def ${name} (a b c d : Point) : ℚ := ${body}\n`;
output += `def sourcePoint (a b c d : Point) : Point :=
  ⟨${expression(point.initializer.arguments[0])}, ${expression(point.initializer.arguments[1])}⟩

theorem sourceDeterminant_eq (a b c d : Point) :
    sourceDeterminant a b c d = determinant a b c d := by rfl
theorem sourceT_eq (a b c d : Point) : sourceT a b c d = parameterT a b c d := by rfl
theorem sourceU_eq (a b c d : Point) : sourceU a b c d = parameterU a b c d := by rfl
theorem sourcePoint_eq (a b c d : Point) :
    sourcePoint a b c d = lerp a b (parameterT a b c d) := by
  ext <;> dsimp [sourcePoint, lerp, parameterT, determinant, cross, delta] <;> ring

theorem sourcePoint_sound (a b c d : Point)
    (h : sourceDeterminant a b c d ≠ 0)
    (ht : inUnit (sourceT a b c d)) (hu : inUnit (sourceU a b c d)) :
    onSegment (sourcePoint a b c d) a b ∧ onSegment (sourcePoint a b c d) c d := by
  apply (nonparallel_intersection_iff a b c d _ h).mpr
  exact ⟨ht, hu, sourcePoint_eq a b c d⟩
end Cadloom
`;
const target = new URL('formal/SourceArithmetic.lean', root);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw Error('Extracted arithmetic is stale; regenerate and recheck Lean');
  console.log('Source arithmetic AST matches the checked Lean definitions');
} else {
  writeFileSync(target, output);
  console.log(`Generated ${fileURLToPath(target)}`);
}
