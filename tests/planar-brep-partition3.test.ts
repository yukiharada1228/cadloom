import test from 'node:test';
import assert from 'node:assert/strict';
import {partitionPlanarBRepFaces3 as partition,point3,plane3,Rational,curveEndpoints3,evaluatePlane3,cross3,dot3,subtract3} from '../dist/index.js';
import type {Point3,PartitionedPlanarBRep3,Plane3} from '../dist/index.js';
const p=point3;
const box=[
 [p(0n,0n,0n),p(0n,2n,0n),p(2n,2n,0n),p(2n,0n,0n)],
 [p(0n,0n,2n),p(2n,0n,2n),p(2n,2n,2n),p(0n,2n,2n)],
 [p(0n,0n,0n),p(2n,0n,0n),p(2n,0n,2n),p(0n,0n,2n)],
 [p(0n,2n,0n),p(0n,2n,2n),p(2n,2n,2n),p(2n,2n,0n)],
 [p(0n,0n,0n),p(0n,0n,2n),p(0n,2n,2n),p(0n,2n,0n)],
 [p(2n,0n,0n),p(2n,2n,0n),p(2n,2n,2n),p(2n,0n,2n)],
];
function qpoint(a:{x:{rational:Rational|null},y:{rational:Rational|null},z:{rational:Rational|null}}):Point3 {return p(a.x.rational!,a.y.rational!,a.z.rational!);}
function validate(r:PartitionedPlanarBRep3,input:readonly (readonly Point3[])[],planes:readonly Plane3[]){
 const t=r.sewn.topology;assert.equal(t.faces.length,r.cells.length);assert.equal(r.edgeOrigins.length,t.edges.length);
 r.edgeOrigins.forEach((origins,id)=>{
  assert.equal(origins.length,t.edges[id]!.coedges.length);assert.ok(origins.length);
  const ends=curveEndpoints3(t.edges[id]!.curve).map(qpoint);
  for(const o of origins){
   assert.equal(o.sourceFace,r.cells[o.cell]!.sourceFace);
   assert.ok(r.sewn.sourceUses[o.cell]![0]![o.polygonEdge]!.some(u=>u.edge===id&&u.direction===o.direction));
   const c=r.cells[o.cell]!,a=c.polygon[o.polygonEdge]!,b=c.polygon[(o.polygonEdge+1)%c.polygon.length]!;
   const d=subtract3(b,a);assert.equal(dot3(subtract3(ends[1]!,ends[0]!),d).sign(),o.direction);
   assert.deepEqual(o.planes,planes.flatMap((plane,i)=>ends.every(v=>evaluatePlane3(plane,v).sign()===0)?[i]:[]));
   if(o.sourceEdge!==null){
    const poly=input[o.sourceFace]!,a=poly[o.sourceEdge]!,b=poly[(o.sourceEdge+1)%poly.length]!,d=subtract3(b,a);
    ends.forEach(v=>{const c=cross3(d,subtract3(v,a));assert.equal(dot3(c,c).sign(),0);assert.ok(dot3(subtract3(v,a),subtract3(v,b)).sign()<=0);});
   }else assert.ok(o.planes.length);
   assert.ok(Object.isFrozen(o)&&Object.isFrozen(o.planes));
  }
 });
 // Every original boundary edge is covered exactly once in its source winding.
 input.forEach((polygon,sourceFace)=>polygon.forEach((a,sourceEdge)=>{
  const b=polygon[(sourceEdge+1)%polygon.length]!,d=subtract3(b,a);
  let covered=new Rational(0n);
  r.edgeOrigins.forEach((origins,id)=>origins.filter(o=>o.sourceFace===sourceFace&&o.sourceEdge===sourceEdge).forEach(o=>{
   const [u,v]=curveEndpoints3(t.edges[id]!.curve).map(qpoint);
   covered=covered.add(dot3(subtract3(v!,u!),d).mul(new Rational(BigInt(o.direction))));
  }));
  assert.equal(covered.toString(),dot3(d,d).toString());
 }));
 const counts=t.coedges.length;assert.equal(r.edgeOrigins.reduce((n,o)=>n+o.length,0),counts);
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.cells)&&Object.isFrozen(r.edgeOrigins));
}
function volume(r:PartitionedPlanarBRep3){return r.cells.reduce((s,c)=>{
 const a=c.polygon[0]!;return c.polygon.slice(1,-1).reduce((s,b,i)=>s.add(dot3(a,cross3(b,c.polygon[i+2]!))),s);
},new Rational(0n)).div(new Rational(6n));}
test('two transverse cuts produce a conforming closed cube boundary with complete provenance',()=>{
 const cuts=[plane3(1n,0n,0n,-1n),plane3(0n,1n,0n,-1n)],r=partition(box,cuts,{requireClosed:true});validate(r,box,cuts);
 const t=r.sewn.topology;assert.equal(r.cells.length,16);assert.equal(t.vertices.length,18);assert.equal(t.edges.length,32);
 assert.equal(t.vertices.length-t.edges.length+t.faces.length,2);assert.equal(t.closedOrientedIncidence,true);assert.equal(t.shells.length,1);assert.equal(t.issues.length,0);assert.equal(volume(r).toString(),'8');
 assert.ok(r.edgeOrigins.some(o=>o.every(u=>u.sourceEdge===null)));assert.ok(r.edgeOrigins.every(o=>o.length===2&&o[0]!.direction===-o[1]!.direction));
 // The output polygons can be split again without reconstructing a triangle mesh.
 const secondCuts=[plane3(0n,0n,1n,-1n)],again=partition(r.cells.map(c=>c.polygon),secondCuts,{requireClosed:true});validate(again,r.cells.map(c=>c.polygon),secondCuts);
 assert.equal(again.cells.length,24);assert.equal(volume(again).toString(),'8');assert.equal(again.sewn.topology.vertices.length-again.sewn.topology.edges.length+again.cells.length,2);
});
test('sewing nodes unmatched source edge subdivisions and retains their individual identities',()=>{
 const faces=box.map(f=>[...f]);faces[0]!.splice(1,0,p(0n,1n,0n));
 const r=partition(faces,[],{requireClosed:true});validate(r,faces,[]);
 assert.equal(r.cells.length,6);assert.equal(r.sewn.topology.vertices.length,9);assert.equal(r.sewn.topology.edges.length,13);
 assert.ok(r.sewn.sourceUses[4]![0]!.some(uses=>uses.length===2));
 assert.equal(new Set(r.edgeOrigins.flat().filter(o=>o.sourceFace===0).map(o=>o.sourceEdge)).size,5);
});
test('oblique, reversed, coplanar and tiny rational cuts preserve oriented material volume',()=>{
 const tiny=Rational.parse('1/1'+'0'.repeat(60));
 const cuts=[plane3(1n,1n,1n,-2n),plane3(-2n,-2n,-2n,4n),plane3(0n,0n,1n),plane3(1n,0n,0n,tiny.neg())];
 for(const faces of [box,box.map(f=>[...f].reverse())]){
  const r=partition(faces,cuts,{requireClosed:true});validate(r,faces,cuts);assert.equal(volume(r).toString(),faces===box?'8':'-8');assert.equal(r.sewn.topology.issues.length,0);
  assert.ok(r.cells.every(c=>c.signs[0]===-c.signs[1]!));
 }
});
test('open and nonmanifold soups report incidence rather than claim solid validity',()=>{
 const r=partition(box.slice(0,1),[]);assert.equal(r.sewn.topology.closed,false);assert.ok(r.sewn.topology.issues.some(i=>i.kind==='boundary-edge'));
 assert.throws(()=>partition(box.slice(0,1),[],{requireClosed:true}),RangeError);
 const duplicate=partition([...box,box[0]!],[]);assert.ok(duplicate.sewn.topology.issues.some(i=>i.kind==='nonmanifold-edge'));assert.throws(()=>partition([...box,box[0]!],[],{requireClosed:true}),RangeError);
 const empty=partition([],[],{requireClosed:true});assert.equal(empty.cells.length,0);assert.equal(empty.edgeOrigins.length,0);
 assert.throws(()=>partition([[p(0n,0n),p(1n,0n),p(0n,0n)]],[]),RangeError);
 assert.throws(()=>partition(box,[],{requireClosed:1 as unknown as boolean}),TypeError);
});
test('a sheared rational tetrahedron preserves sloped face boundaries and independent determinant volume',()=>{
 const O=p(0n,0n,0n),X=p(2n,0n,0n),Y=p(0n,2n,0n),Z=p(0n,0n,2n);
 const map=(v:Point3)=>p(v.x.mul(new Rational(2n)).add(v.y).add(new Rational(10n)),v.y.mul(new Rational(3n)).add(v.z).sub(new Rational(7n)),v.z.add(new Rational(5n)));
 const faces=[[O,Y,X],[O,X,Z],[O,Z,Y],[X,Y,Z]].map(f=>f.map(map));
 const cuts=[plane3(1n,1n,1n,-11n),plane3(1n,-1n,0n,-17n)],r=partition(faces,cuts,{requireClosed:true});validate(r,faces,cuts);
 // Original simplex volume 2*2*2/6, multiplied by affine determinant 6.
 assert.equal(volume(r).toString(),'8');assert.equal(r.sewn.topology.issues.length,0);
 assert.equal(r.sewn.topology.vertices.length-r.sewn.topology.edges.length+r.cells.length,2);
});
