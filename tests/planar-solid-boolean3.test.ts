import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,Rational,preparePlanarSolid3,booleanPlanarSolids3 as boolean,plane3,partitionPlanarBRepFaces3,extrudePolygon,point2} from '../dist/index.js';
import type {Point3,BooleanOperation,PlanarSolidBooleanResult3} from '../dist/index.js';
function box(lo:bigint,hi:bigint,offset:Point3=point3(0n,0n)){
 const p=(x:bigint,y:bigint,z:bigint)=>point3(x===0n?lo:hi,y===0n?lo:hi,z===0n?lo:hi),move=(v:Point3)=>point3(v.x.add(offset.x),v.y.add(offset.y),v.z.add(offset.z));
 return [[p(0n,0n,0n),p(0n,1n,0n),p(1n,1n,0n),p(1n,0n,0n)],[p(0n,0n,1n),p(1n,0n,1n),p(1n,1n,1n),p(0n,1n,1n)],[p(0n,0n,0n),p(1n,0n,0n),p(1n,0n,1n),p(0n,0n,1n)],[p(0n,1n,0n),p(0n,1n,1n),p(1n,1n,1n),p(1n,1n,0n)],[p(0n,0n,0n),p(0n,0n,1n),p(0n,1n,1n),p(0n,1n,0n)],[p(1n,0n,0n),p(1n,1n,0n),p(1n,1n,1n),p(1n,0n,1n)]].map(f=>f.map(move));
}
const truth=(a:boolean,b:boolean,op:BooleanOperation)=>op==='union'?a||b:op==='intersection'?a&&b:op==='difference'?a&&!b:a!==b;
const ops=['union','intersection','difference','xor'] as const;
function check(r:PlanarSolidBooleanResult3){
 assert.equal(r.polygons.length,r.topology.faces.length);assert.equal(r.faceSources.length,r.polygons.length);
 assert.ok(r.faceSources.every(s=>s.length>0&&s.every(Object.isFrozen)&&Object.isFrozen(s)));
 for(const edge of r.topology.edges){assert.ok(edge.coedges.length>=2);assert.equal(edge.coedges.reduce((s,id)=>s+r.topology.coedges[id]!.direction,0),0);}
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.polygons));
}
test('all four polygonal material Booleans match independent overlapping-box volumes and inequalities',()=>{
 const a=preparePlanarSolid3(box(0n,2n)),b=preparePlanarSolid3(box(1n,3n)),volumes=['15','1','7','14'];
 ops.forEach((op,i)=>{
  const r=boolean(a,b,op);check(r);assert.equal(r.volume.toString(),volumes[i]);
  for(let x=-1n;x<=7n;x+=2n)for(let y=-1n;y<=7n;y+=2n)for(let z=-1n;z<=7n;z+=2n){
   const v=[x,y,z],A=v.every(n=>n>0n&&n<4n),B=v.every(n=>n>2n&&n<6n);
   assert.equal(r.locate(point3(new Rational(x,2n),new Rational(y,2n),new Rational(z,2n))),truth(A,B,op)?'inside':'outside');
  }
 });
});
test('coplanar overlays preserve all covering face sources and remove internal contact faces',()=>{
 const a=preparePlanarSolid3(box(0n,2n)),same=preparePlanarSolid3([...box(0n,2n)].reverse().map(f=>[...f.slice(2),...f.slice(0,2)]));
 for(const op of ops){const r=boolean(a,same,op);assert.equal(r.volume.toString(),op==='difference'||op==='xor'?'0':'8');check(r);if(r.polygons.length)assert.ok(r.faceSources.every(s=>s.length===2&&s[0]!.operand!==s[1]!.operand));}
 const adjacent=preparePlanarSolid3(box(0n,2n,point3(2n,0n,0n))),joined=boolean(a,adjacent,'union');check(joined);assert.equal(joined.volume.toString(),'16');assert.equal(joined.locate(point3(2n,1n,1n)),'inside');assert.equal(joined.topology.closedOrientedIncidence,true);
 assert.equal(boolean(a,adjacent,'intersection').polygons.length,0);
});
test('edge and vertex contact complexes remain valid owned operands for subsequent Booleans',()=>{
 const a=preparePlanarSolid3(box(0n,1n));
 for(const shift of [point3(1n,1n,0n),point3(1n,1n,1n)]){
  const b=preparePlanarSolid3(box(0n,1n,shift)),r=boolean(a,b,'union');check(r);assert.equal(r.volume.toString(),'2');assert.equal(r.topology.closedOrientedIncidence,false);assert.equal(r.locate(shift),'boundary');
  assert.equal(boolean(r,b,'difference').volume.toString(),'1');assert.equal(boolean(a,b,'intersection').polygons.length,0);
 }
});
test('nested difference creates a cavity and chains through owned material results',()=>{
 const a=preparePlanarSolid3(box(0n,4n)),b=preparePlanarSolid3(box(1n,3n)),cavity=boolean(a,b,'difference');check(cavity);
 assert.equal(cavity.volume.toString(),'56');assert.equal(cavity.locate(point3(2n,2n,2n)),'outside');assert.equal(cavity.locate(point3(1n,2n,2n)),'boundary');
 assert.equal(preparePlanarSolid3(cavity.polygons).shells[1]!.depth,1);
 const filled=boolean(cavity,b,'union');assert.equal(filled.volume.toString(),'64');assert.equal(filled.locate(point3(2n,2n,2n)),'inside');
 const empty=preparePlanarSolid3([]);assert.equal(boolean(empty,a,'union').volume.toString(),'64');assert.equal(boolean(empty,a,'intersection').polygons.length,0);
 assert.throws(()=>boolean({...a},b,'union'),RangeError);assert.throws(()=>boolean({...cavity},b,'union'),RangeError);assert.throws(()=>boolean(a,b,'bad' as BooleanOperation),RangeError);
});
test('different source subdivisions and collinear ports do not duplicate coplanar coverage',()=>{
 const input=box(0n,2n);input[0]!.splice(1,0,point3(0n,1n,0n));
 const a=preparePlanarSolid3(input),parts=partitionPlanarBRepFaces3(box(0n,2n),[plane3(1n,0n,0n,-1n),plane3(0n,1n,0n,-1n)],{requireClosed:true}),b=preparePlanarSolid3(parts.cells.map(c=>c.polygon));
 const r=boolean(a,b,'union');check(r);assert.equal(r.volume.toString(),'8');assert.ok(r.faceSources.every(s=>s.length===2));assert.equal(boolean(a,b,'difference').polygons.length,0);
});
test('transverse cube/octahedron cuts match independent corner-simplex volumes and inequalities',()=>{
 const cube=preparePlanarSolid3(box(0n,2n)),octa:Point3[][]=[];
 for(const x of [-1n,1n])for(const y of [-1n,1n])for(const z of [-1n,1n]){
  const tri=[point3(1n+2n*x,1n,1n),point3(1n,1n+2n*y,1n),point3(1n,1n,1n+2n*z)];
  if(x*y*z<0n)tri.reverse();octa.push(tri);
 }
 const b=preparePlanarSolid3(octa),volumes=['12','20/3','4/3','16/3'];
 ops.forEach((op,i)=>{
  const r=boolean(cube,b,op);check(r);assert.equal(r.volume.toString(),volumes[i]);
  for(let x=-1n;x<=5n;x+=2n)for(let y=-1n;y<=5n;y+=2n)for(let z=-1n;z<=5n;z+=2n){
   const coords=[x,y,z],A=coords.every(n=>n>0n&&n<4n),B=coords.reduce((s,n)=>s+(n>=2n?n-2n:2n-n),0n)<4n;
   assert.equal(r.locate(point3(new Rational(x,2n),new Rational(y,2n),new Rational(z,2n))),truth(A,B,op)?'inside':'outside');
  }
 });
});
test('orientation-reversing rational affine maps preserve Boolean material and determinant volume',()=>{
 const map=(v:Point3)=>point3(v.x.mul(new Rational(-2n)).add(v.y).add(new Rational(20n)),v.y.mul(new Rational(3n)).add(v.z),v.z);
 const a=preparePlanarSolid3(box(0n,2n).map(f=>f.map(map).reverse())),b=preparePlanarSolid3(box(1n,3n).map(f=>f.map(map).reverse())),volumes=[90n,6n,42n,84n];
 ops.forEach((op,i)=>{
  const r=boolean(a,b,op);check(r);assert.equal(r.volume.toString(),String(volumes[i]));
  for(const coords of [[1n,1n,1n],[3n,3n,3n],[5n,5n,5n],[7n,1n,1n]]){
   const A=coords.every(n=>n>0n&&n<4n),B=coords.every(n=>n>2n&&n<6n),p=point3(new Rational(coords[0]!,2n),new Rational(coords[1]!,2n),new Rational(coords[2]!,2n));
   assert.equal(r.locate(map(p)),truth(A,B,op)?'inside':'outside');
  }
 });
});
test('gaps and overlaps below floating-point resolution remain geometrically distinct',()=>{
 const tiny=Rational.parse('1/1'+'0'.repeat(70)),a=preparePlanarSolid3(box(0n,2n));
 for(const sign of [-1n,1n]){
  const shift=point3(new Rational(2n).add(tiny.mul(new Rational(sign))),0n,0n),b=preparePlanarSolid3(box(0n,2n,shift)),intersection=boolean(a,b,'intersection'),union=boolean(a,b,'union');
  assert.equal(intersection.volume.toString(),sign===-1n?tiny.mul(new Rational(4n)).toString():'0');
  assert.equal(union.volume.toString(),new Rational(16n).sub(intersection.volume).toString());
  const middle=point3(new Rational(2n).add(tiny.mul(new Rational(sign,2n))),1n,1n);
  assert.equal(union.locate(middle),sign===-1n?'inside':'outside');
 }
});
test('nonconvex L-prism inputs match independent disjoint-rectangle volumes and material tests',()=>{
 const mesh=extrudePolygon([[point2(0n,0n),point2(3n,0n),point2(3n,1n),point2(1n,1n),point2(1n,3n),point2(0n,3n)]],2n);
 const a=preparePlanarSolid3(mesh.triangles.map(t=>t.map(i=>mesh.vertices[i]!))),b=preparePlanarSolid3(box(0n,2n,point3('1/2','1/2',0n))),volumes=['29/2','7/2','13/2','11'];
 ops.forEach((op,i)=>{
  const r=boolean(a,b,op);check(r);assert.equal(r.volume.toString(),volumes[i]);
  for(let x=-1n;x<=13n;x+=2n)for(let y=-1n;y<=13n;y+=2n)for(const z of [-1n,3n,9n]){
   const A=x>0n&&x<12n&&y>0n&&y<12n&&(x<4n||y<4n)&&z>0n&&z<8n,B=x>2n&&x<10n&&y>2n&&y<10n&&z>0n&&z<8n;
   assert.equal(r.locate(point3(new Rational(x,4n),new Rational(y,4n),new Rational(z,4n))),truth(A,B,op)?'inside':'outside');
  }
 });
});
test('isolated vertex-to-face contacts are noded into conforming polygonal boundary cells',()=>{
 const O=point3(1n,1n,2n),X=point3(2n,1n,3n),Y=point3(1n,2n,3n),Z=point3(1n,1n,3n);
 // The base ordering has positive determinant for these edges.
 const tetra=preparePlanarSolid3([[O,Y,X],[O,X,Z],[O,Z,Y],[X,Y,Z]]),cube=preparePlanarSolid3(box(0n,2n)),r=boolean(cube,tetra,'union');
 check(r);assert.equal(r.volume.toString(),'49/6');assert.equal(r.locate(O),'boundary');assert.equal(r.topology.manifoldVertices,false);
 assert.equal(boolean(cube,tetra,'intersection').polygons.length,0);assert.equal(boolean(r,tetra,'difference').volume.toString(),'8');
});
