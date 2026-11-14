import test from 'node:test';
import assert from 'node:assert/strict';
import {booleanSolids3,point2,point3,triangle3,extrudePolygon,Rational,prepareSolid3} from '../dist/index.js';
import type {Triangle3,BooleanOperation,Point3} from '../dist/index.js';
type Box=readonly [bigint,bigint,bigint,bigint,bigint,bigint];
const ops:readonly BooleanOperation[]=['union','intersection','difference','xor'];
const faces=(b:Box)=>{
 const [x,y,z,X,Y,Z]=b,m=extrudePolygon([[point2(x,y),point2(X,y),point2(X,Y),point2(x,Y)]],Z-z,{baseZ:z});
 return m.triangles.map(t=>triangle3(m.vertices[t[0]]!,m.vertices[t[1]]!,m.vertices[t[2]]!));
};
const truth=(a:boolean,b:boolean,op:BooleanOperation)=>op==='union'?a||b:op==='intersection'?a&&b:op==='difference'?a&&!b:a!==b;
const volume=(b:Box)=>(b[3]-b[0])*(b[4]-b[1])*(b[5]-b[2]);
const overlap=(a:Box,b:Box)=>[0,1,2].reduce((v,i)=>{const lo=a[i]!>b[i]!?a[i]!:b[i]!,hi=a[i+3]!<b[i+3]!?a[i+3]!:b[i+3]!;return v*(hi>lo?hi-lo:0n);},1n);
const inBox=(p:Point3,b:Box)=>[p.x,p.y,p.z].every((v,i)=>v.compare(new Rational(b[i]!))>0&&v.compare(new Rational(b[i+3]!))<0);
// Independent local-octant oracle. All query coordinates are half-integers and box
// bounds integers: +/-1/8 stays in each adjacent open coordinate cell.
function location(p:Point3,a:Box,b:Box,op:BooleanOperation){
 const states:boolean[]=[];
 for(const x of [-1n,1n])for(const y of [-1n,1n])for(const z of [-1n,1n]){
  const q=point3(p.x.add(new Rational(x,8n)),p.y.add(new Rational(y,8n)),p.z.add(new Rational(z,8n)));
  states.push(truth(inBox(q,a),inBox(q,b),op));
 }
 return states.every(Boolean)?'inside':states.some(Boolean)?'boundary':'outside';
}
test('regularized box Booleans match independent volumes and local material membership including contact degeneracies',()=>{
 const a:Box=[0n,0n,0n,2n,2n,2n];
 const cases:Box[]=[
  [1n,1n,1n,3n,3n,3n], // transverse overlap
  [0n,0n,0n,2n,2n,2n], // coincident
  [0n,0n,0n,1n,1n,1n], // containment with coincident portions
  [3n,0n,0n,4n,2n,2n], // disjoint
  [2n,0n,0n,4n,2n,2n], // face contact: shared interface must disappear on union
  [2n,2n,0n,4n,4n,2n], // edge contact retained on union/xor
  [2n,2n,2n,4n,4n,4n], // vertex contact
 ];
 for(const b of cases)for(const op of ops){
  const result=booleanSolids3(faces(a),faces(b),op),v=overlap(a,b);
  const expected=op==='union'?volume(a)+volume(b)-v:op==='intersection'?v:op==='difference'?volume(a)-v:volume(a)+volume(b)-2n*v;
  assert.equal(result.volume.toString(),String(expected),`${b} ${op}`);
  assert.equal(result.topology.issues.some(i=>i.kind==='boundary-edge'||i.kind==='inconsistent-edge-orientation'||i.kind==='duplicate-face'),false);
  for(const coords of [[-1n,1n,1n],[0n,0n,0n],[1n,1n,1n],[2n,2n,2n],[3n,3n,3n],[4n,4n,4n],[2n,1n,1n],[2n,2n,1n],[3n,1n,1n],[1n,2n,3n]]){
   const p=point3(...coords as [bigint,bigint,bigint]);assert.equal(result.locate(p),location(p,a,b,op),`${b} ${op} ${coords}`);
  }
  if(result.topology.closedManifold)assert.equal(prepareSolid3(result.boundary).volume.toString(),result.volume.toString());
  if((op==='union'||op==='xor')&&b[0]===2n&&b[1]===2n)assert.equal(result.topology.closedManifold,false);
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.boundary));
 }
});
test('nested differences produce cavities and remain usable as later Boolean operands',()=>{
 const outer=faces([0n,0n,0n,5n,5n,5n]),inner=faces([1n,1n,1n,4n,4n,4n]);
 const hollow=booleanSolids3(outer,inner,'difference');
 assert.equal(hollow.volume.toString(),'98');assert.deepEqual(prepareSolid3(hollow.boundary).shells.map(s=>s.depth).sort(),[0,1]);
 assert.equal(hollow.locate(point3(2n,2n,2n)),'outside');
 const island=faces([2n,2n,2n,3n,3n,3n]);
 const restored=booleanSolids3(hollow.boundary,island,'union');
 assert.equal(restored.volume.toString(),'99');assert.equal(restored.locate(point3('5/2','5/2','5/2')),'inside');
 const empty=booleanSolids3([],outer,'intersection');assert.equal(empty.volume.toString(),'0');assert.equal(empty.boundary.length,0);
 assert.equal(booleanSolids3([],inner,'union').volume.toString(),'27');
});
test('oblique rational affine images preserve Boolean volume and membership',()=>{
 const a=faces([0n,0n,0n,2n,2n,2n]),b=faces([1n,1n,1n,3n,3n,3n]);
 const shift=Rational.parse('1'+'0'.repeat(30)),scale=Rational.parse('1/1'+'0'.repeat(20));
 const map=(p:Point3)=>point3(shift.add(p.x.add(p.y).mul(scale)),p.y.add(p.z),p.z);
 const transform=(ts:readonly Triangle3[])=>ts.map(t=>triangle3(map(t[0]),map(t[1]),map(t[2])));
 const r=booleanSolids3(transform(a),transform(b),'intersection');
 assert.equal(r.volume.toString(),scale.toString());
 assert.equal(r.locate(map(point3('3/2','3/2','3/2'))),'inside');
 assert.equal(r.locate(map(point3(1n,1n,1n))),'boundary');
 assert.equal(r.locate(map(point3('1/2','1/2','1/2'))),'outside');
 assert.throws(()=>booleanSolids3(a.slice(1),b,'union'),RangeError);
 assert.throws(()=>booleanSolids3(a,b,'bad' as BooleanOperation),RangeError);
});
test('sloped tetrahedra have independent simplex volumes and Boolean membership on a half-integer grid',()=>{
 const tetra=(x:bigint)=>{
  const a=point3(x,0n,0n),b=point3(x+4n,0n,0n),c=point3(x,4n,0n),d=point3(x,0n,4n);
  return [triangle3(a,c,b),triangle3(a,b,d),triangle3(a,d,c),triangle3(b,c,d)];
 };
 const volumes=['101/6','9/2','37/6','37/3'];
 const inside=(p:Point3,x:bigint)=>p.x.compare(new Rational(x))>0&&p.y.sign()>0&&p.z.sign()>0&&p.x.add(p.y).add(p.z).compare(new Rational(x+4n))<0;
 for(const [i,op] of ops.entries()){
  const r=booleanSolids3(tetra(0n),tetra(1n),op);assert.equal(r.volume.toString(),volumes[i]);
  for(let x=-1n;x<=11n;x+=2n)for(let y=-1n;y<=9n;y+=2n)for(let z=-1n;z<=9n;z+=2n){
   const p=point3(new Rational(x,2n),new Rational(y,2n),new Rational(z,2n));
   assert.equal(r.locate(p),truth(inside(p,0n),inside(p,1n),op)?'inside':'outside');
  }
 }
});
test('coplanar coverage is invariant to source face order and different triangulation diagonals',()=>{
 const box:Box=[0n,0n,0n,2n,2n,2n],source=faces(box);
 // A different 12-triangle cube, without extrusion slab Steiner points.
 const p=[point3(0n,0n,0n),point3(2n,0n,0n),point3(2n,2n,0n),point3(0n,2n,0n),point3(0n,0n,2n),point3(2n,0n,2n),point3(2n,2n,2n),point3(0n,2n,2n)];
 const quads=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
 const other=quads.flatMap(([a,b,c,d])=>[triangle3(p[a!]!,p[b!]!,p[d!]!),triangle3(p[b!]!,p[c!]!,p[d!]!)]).reverse();
 for(const op of ops){
  const r=booleanSolids3(source.slice().reverse(),other,op);
  assert.equal(r.volume.toString(),op==='union'||op==='intersection'?'8':'0');
  assert.equal(r.locate(point3(1n,1n,1n)),op==='union'||op==='intersection'?'inside':'outside');
 }
});
test('cube/octahedron transverse sloped cuts match independent corner-tetrahedron volumes',()=>{
 const cube=faces([-1n,-1n,-1n,1n,1n,1n]),octa:Triangle3[]=[];
 for(const x of [-1n,1n])for(const y of [-1n,1n])for(const z of [-1n,1n]){
  const a=point3(2n*x,0n,0n),b=point3(0n,2n*y,0n),c=point3(0n,0n,2n*z);
  octa.push(x*y*z>0n?triangle3(a,b,c):triangle3(a,c,b));
 }
 const expected=['12','20/3','4/3','16/3'];
 for(const [i,op] of ops.entries()){
  const r=booleanSolids3(cube,octa,op);assert.equal(r.volume.toString(),expected[i]);
  assert.equal(r.locate(point3(0n,0n,0n)),truth(true,true,op)?'inside':'outside');
  assert.equal(r.locate(point3('3/4','3/4','3/4')),truth(true,false,op)?'inside':'outside');
  assert.equal(r.locate(point3('3/2',0n,0n)),truth(false,true,op)?'inside':'outside');
 }
});
test('certified nonmanifold contact results can be chained without accepting forged material classifiers',()=>{
 const a=faces([0n,0n,0n,2n,2n,2n]),b=faces([2n,2n,0n,4n,4n,2n]);
 const touching=booleanSolids3(a,b,'union');assert.equal(touching.topology.closedManifold,false);
 const again=booleanSolids3(touching,[],'union');assert.equal(again.volume.toString(),'16');assert.equal(again.locate(point3(2n,2n,1n)),'boundary');
 const removed=booleanSolids3(touching,a,'difference');assert.equal(removed.volume.toString(),'8');assert.equal(removed.topology.closedManifold,true);
 assert.equal(removed.locate(point3(1n,1n,1n)),'outside');assert.equal(removed.locate(point3(3n,3n,1n)),'inside');
 assert.throws(()=>booleanSolids3({...touching,locate:()=> 'inside'},a,'union'),RangeError);
});
test('isolated vertex-to-face and edge-to-face contacts are retained as conforming boundary complexes',()=>{
 const base=faces([0n,0n,-2n,4n,4n,0n]);
 const tetra=(a:Point3,b:Point3,c:Point3,d:Point3)=>[triangle3(a,c,b),triangle3(a,b,d),triangle3(a,d,c),triangle3(b,c,d)];
 // Tip in the strict interior of the cube's upper face.
 const tip=tetra(point3(2n,2n,0n),point3(3n,2n,1n),point3(2n,3n,1n),point3(2n,2n,2n));
 // An entire tetrahedral edge touches the interior of that face.
 const edge=tetra(point3(1n,2n,0n),point3(3n,2n,0n),point3(2n,3n,1n),point3(2n,1n,1n));
 for(const other of [tip,edge]){
  const r=booleanSolids3(base,other,'union');
  assert.equal(r.volume.toString(),new Rational(32n).add(prepareSolid3(other).volume).toString());
  assert.equal(r.topology.closedManifold,false);assert.equal(r.locate(point3(2n,2n,0n)),'boundary');
  assert.equal(booleanSolids3(base,other,'intersection').boundary.length,0);
 }
});
