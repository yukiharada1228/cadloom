import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { booleanPolygons, point2, Rational } from "../dist/index.js";
import type { BooleanOperation, Point2 } from "../dist/index.js";

const a = [[point2(0n,0n),point2(2n,0n),point2(2n,2n),point2(0n,2n)]];
const b = [[point2(1n,1n),point2(3n,1n),point2(3n,3n),point2(1n,3n)]];
const operations: BooleanOperation[] = ["union","intersection","difference","xor"];
const colors = ["#2563eb","#dc2626","#15803d","#7c3aed"];
const results = operations.map(operation=>({operation,result:booleanPolygons(a,b,operation)}));
const directory=resolve("artifacts");
await mkdir(directory,{recursive:true});
await writeFile(resolve(directory,"polygon-booleans.json"),JSON.stringify({a,b,results},null,2)+"\n");
const display=(p:Point2)=> {
  const project=(v:Rational)=>Number(v.numerator*60000n/v.denominator)/1000;
  return `${20+project(p.x)},${220-project(p.y)}`;
};
const path=(rings:readonly (readonly Point2[])[])=>rings.map(r=>`M${r.map(display).join(" L")} Z`).join(" ");
const panels=results.map(({operation,result},i)=>`<g transform="translate(${i*240},0)">
<text x="20" y="25" font-size="18" font-weight="bold">${operation}</text>
<path d="${path(result.rings)}" fill="${colors[i]}" fill-opacity="0.35" fill-rule="nonzero" stroke="${colors[i]}" stroke-width="2"/>
<path d="${path(a)} ${path(b)}" fill="none" stroke="#64748b" stroke-dasharray="4 4"/>
<text x="20" y="250">area = ${result.twiceArea.div(new Rational(2n))}</text>
</g>`).join("\n");
await writeFile(resolve(directory,"polygon-booleans.svg"),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 275" role="img" aria-label="Exact polygon union, intersection, difference and xor">
<rect width="960" height="275" fill="white"/><g font-family="sans-serif" fill="#0f172a">${panels}</g></svg>\n`);
console.log(`Saved ${directory}/polygon-booleans.{json,svg}`);
