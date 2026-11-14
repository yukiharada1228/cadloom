import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { point2, triangulatePolygon } from "../dist/index.js";
import type { Point2, Rational } from "../dist/index.js";
const box=(x:bigint,y:bigint,w:bigint)=>[
  point2(x,y),point2(x+w,y),point2(x+w,y+w),point2(x,y+w),
];
const input=[box(0n,0n,8n),box(2n,2n,4n),box(3n,3n,1n)];
const mesh=triangulatePolygon(input);
const directory=resolve("artifacts");
await mkdir(directory,{recursive:true});
await writeFile(resolve(directory,"triangulation.json"),JSON.stringify({input,mesh},null,2)+"\n");
const project=(v:Rational)=>Number(v.numerator*50000n/v.denominator)/1000;
const display=(p:Point2)=>`${50+project(p.x)},${450-project(p.y)}`;
const triangles=mesh.triangles.map((ids,i)=>`<polygon points="${ids.map(id=>display(mesh.vertices[id]!)).join(" ")}" fill="hsl(${i*137%360} 65% 75%)" stroke="#334155" stroke-width="0.8"><title>triangle ${i}; vertices ${ids.join(",")}</title></polygon>`).join("\n");
const outline=input.map(ring=>`M${ring.map(display).join(" L")} Z`).join(" ");
const vertices=mesh.vertices.map(p=>`<circle cx="${50+project(p.x)}" cy="${450-project(p.y)}" r="2" fill="#0f172a"/>`).join("\n");
await writeFile(resolve(directory,"triangulation.svg"),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 510" role="img" aria-label="Exact triangulation of a region with a hole and an island">
<rect width="520" height="510" fill="white"/>
<text x="25" y="25" font-family="sans-serif" font-size="16">Exact triangulation: hole and island</text>
${triangles}<path d="${outline}" fill="none" stroke="#0f172a" stroke-width="2"/>${vertices}
<text x="25" y="490" font-family="sans-serif" font-size="12">${mesh.vertices.length} vertices; ${mesh.triangles.length} triangles; twice area ${mesh.twiceArea}</text>
</svg>\n`);
console.log(`Saved ${directory}/triangulation.{json,svg}`);
