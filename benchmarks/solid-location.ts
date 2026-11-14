import { performance } from 'node:perf_hooks';
import { point2,point3,triangle3,extrudePolygon,prepareSolid3,Rational } from '../dist/index.js';
import type { Triangle3,Point3 } from '../dist/index.js';
const mesh=extrudePolygon([[point2(0n,0n),point2(4n,0n),point2(4n,4n),point2(0n,4n)]],4n);
let faces=mesh.triangles.map(t=>triangle3(mesh.vertices[t[0]]!,mesh.vertices[t[1]]!,mesh.vertices[t[2]]!));
const midpoint=(a:Point3,b:Point3)=>point3(a.x.add(b.x).div(new Rational(2n)),a.y.add(b.y).div(new Rational(2n)),a.z.add(b.z).div(new Rational(2n)));
for(let level=0;level<2;level++)faces=faces.flatMap(([a,b,c]):Triangle3[]=>{
 const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
 return [triangle3(a,ab,ca),triangle3(ab,b,bc),triangle3(ca,bc,c),triangle3(ab,bc,ca)];
});
const solid=prepareSolid3(faces);
const queries:Point3[]=[];
for(let x=-1n;x<=9n;x++)for(let y=-1n;y<=9n;y++)for(let z=-1n;z<=9n;z++)queries.push(point3(new Rational(x,2n),new Rational(y,2n),new Rational(z,2n)));
const counts={inside:0,boundary:0,outside:0};
const start=performance.now();
for(const p of queries){
 const result=solid.locate(p),v=[p.x,p.y,p.z];
 const expected=v.some(x=>x.sign()<0||x.compare(new Rational(4n))>0)?'outside':v.some(x=>x.sign()===0||x.equals(new Rational(4n)))?'boundary':'inside';
 if(result!==expected)throw new Error('Independent box oracle mismatch');
 counts[result]++;
}
console.log(JSON.stringify({triangles:faces.length,queries:queries.length,counts,queryMilliseconds:performance.now()-start}));
