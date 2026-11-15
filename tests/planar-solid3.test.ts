import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePlanarSolid3,partitionPlanarBRepFaces3,point3,plane3,Rational,extrudePolygon,point2,triangle3,cross3,dot3} from '../dist/index.js';
import type {Point3} from '../dist/index.js';
const q=(n:bigint)=>new Rational(n);
function box(lo:bigint,hi:bigint){
 const p=(x:bigint,y:bigint,z:bigint)=>point3(x===0n?lo:hi,y===0n?lo:hi,z===0n?lo:hi);
 return [[p(0n,0n,0n),p(0n,1n,0n),p(1n,1n,0n),p(1n,0n,0n)],[p(0n,0n,1n),p(1n,0n,1n),p(1n,1n,1n),p(0n,1n,1n)],[p(0n,0n,0n),p(1n,0n,0n),p(1n,0n,1n),p(0n,0n,1n)],[p(0n,1n,0n),p(0n,1n,1n),p(1n,1n,1n),p(1n,1n,0n)],[p(0n,0n,0n),p(0n,0n,1n),p(0n,1n,1n),p(0n,1n,0n)],[p(1n,0n,0n),p(1n,1n,0n),p(1n,1n,1n),p(1n,0n,1n)]];
}
const reverse=(ps:readonly (readonly Point3[])[])=>ps.map(p=>[...p].reverse());
test('polygonal solid retains six BRep faces and matches independent box inequalities',()=>{
 const input=box(0n,2n),s=preparePlanarSolid3(input);
 assert.equal(s.topology.faces.length,6);assert.equal(s.topology.edges.length,12);assert.equal(s.triangles.length,24);assert.equal(s.volume.toString(),'8');assert.deepEqual(s.shells.map(s=>s.depth),[0]);
 for(let x=-1n;x<=5n;x++)for(let y=-1n;y<=5n;y++)for(let z=-1n;z<=5n;z++){
  const v=[x,y,z],expected=v.some(n=>n<0n||n>4n)?'outside':v.some(n=>n===0n||n===4n)?'boundary':'inside';
  assert.equal(s.locate(point3(new Rational(x,2n),new Rational(y,2n),new Rational(z,2n))),expected);
 }
 input.length=0;assert.equal(s.locate(point3(1n,1n,1n)),'inside');
 assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.polygons)&&s.polygons.every(Object.isFrozen)&&Object.isFrozen(s.triangleFaces));
 s.triangleFaces.forEach((face,i)=>{const support=s.topology.faces[face]!.surface;assert.equal(support.kind,'plane');if(support.kind==='plane')for(const p of s.triangles[i]!)assert.equal(dot3(support.plane.normal,p).add(support.plane.offset).sign(),0);});
});
test('nested polygon shells certify cavities, material islands and disconnected solids',()=>{
 const s=preparePlanarSolid3([...box(0n,6n),...reverse(box(1n,5n)),...box(2n,4n),...box(8n,9n)]);
 assert.deepEqual(s.shells.map(s=>s.depth),[0,1,2,0]);assert.equal(s.volume.toString(),'161');
 assert.deepEqual(s.shells.map(s=>s.faces.length),[6,6,6,6]);
 for(const [p,l] of [[point3('1/2','1/2','1/2'),'inside'],[point3('3/2','3/2','3/2'),'outside'],[point3(3n,3n,3n),'inside'],[point3(7n,7n,7n),'outside'],[point3(1n,3n,3n),'boundary']] as const)assert.equal(s.locate(p),l);
 assert.throws(()=>preparePlanarSolid3(reverse(box(0n,6n))),/orientation/);
 assert.throws(()=>preparePlanarSolid3([...box(0n,6n),...box(1n,5n)]),/orientation/);
});
test('sewn T-junctions and repeated plane subdivision remain certifiable with original face IDs',()=>{
 const ps=box(0n,2n);ps[0]!.splice(1,0,point3(0n,1n,0n));const s=preparePlanarSolid3(ps);
 assert.equal(s.topology.vertices.length,9);assert.equal(s.topology.edges.length,13);assert.equal(s.topology.faces.length,6);assert.equal(s.volume.toString(),'8');
 const pieces=partitionPlanarBRepFaces3(ps,[plane3(1n,0n,0n,-1n),plane3(0n,1n,0n,-1n)],{requireClosed:true}),r=preparePlanarSolid3(pieces.cells.map(c=>c.polygon));
 assert.equal(r.topology.faces.length,16);assert.equal(r.volume.toString(),'8');assert.equal(r.locate(point3(1n,1n,1n)),'inside');assert.equal(r.shells[0]!.faces.length,16);
});
test('closed polygon incidence alone cannot certify crossing or overlapping material surfaces',()=>{
 const shift=(v:Point3)=>point3(v.x.add(Rational.parse('1/2')),v.y.add(Rational.parse('1/2')),v.z.add(Rational.parse('1/2')));
 const crossed=[...box(0n,2n),...box(0n,2n).map(f=>f.map(shift))];
 assert.equal(partitionPlanarBRepFaces3(crossed,[],{requireClosed:true}).sewn.topology.closedOrientedIncidence,true);
 assert.throws(()=>preparePlanarSolid3(crossed),/embedded/);
 assert.throws(()=>preparePlanarSolid3([...box(0n,2n),...box(2n,4n)]),RangeError);
 assert.throws(()=>preparePlanarSolid3([...box(0n,2n),...box(0n,2n)]),RangeError);
 assert.throws(()=>preparePlanarSolid3(box(0n,2n).slice(1)),RangeError);
});
test('oblique rational tetrahedron queries match independent barycentric inequalities at extreme scales',()=>{
 const O=point3(0n,0n),X=point3(1n,0n),Y=point3(0n,1n),Z=point3(0n,0n,1n),tiny=Rational.parse('1/1'+'0'.repeat(60)),huge=Rational.parse('1'+'0'.repeat(50));
 const map=(v:Point3)=>point3(v.x.add(v.y).mul(tiny).add(huge),v.y.add(v.z),v.z);
 const s=preparePlanarSolid3([[O,Y,X],[O,X,Z],[O,Z,Y],[X,Y,Z]].map(f=>f.map(map)));
 assert.equal(s.volume.toString(),tiny.div(q(6n)).toString());
 for(let x=-1n;x<=4n;x++)for(let y=-1n;y<=4n;y++)for(let z=-1n;z<=4n;z++){
  const expected=x<0n||y<0n||z<0n||x+y+z>3n?'outside':x===0n||y===0n||z===0n||x+y+z===3n?'boundary':'inside';
  assert.equal(s.locate(map(point3(new Rational(x,3n),new Rational(y,3n),new Rational(z,3n)))),expected);
 }
});
test('positive genus boundaries and empty material preserve polygon-to-triangle shell correspondence',()=>{
 const outer=[point2(0n,0n),point2(4n,0n),point2(4n,4n),point2(0n,4n)],hole=[point2(1n,1n),point2(3n,1n),point2(3n,3n),point2(1n,3n)];
 const mesh=extrudePolygon([outer,hole],2n),polygons=mesh.triangles.map(t=>triangle3(mesh.vertices[t[0]]!,mesh.vertices[t[1]]!,mesh.vertices[t[2]]!)),s=preparePlanarSolid3(polygons);
 assert.equal(s.shells.length,1);assert.equal(s.volume.toString(),'24');assert.equal(s.locate(point3(2n,2n,1n)),'outside');assert.equal(s.locate(point3('1/2',2n,1n)),'inside');
 assert.equal(s.topology.vertices.length-s.topology.edges.length+s.topology.faces.length,0);
 const empty=preparePlanarSolid3([]);assert.equal(empty.volume.toString(),'0');assert.equal(empty.shells.length,0);assert.equal(empty.locate(point3(0n,0n)),'outside');
});
