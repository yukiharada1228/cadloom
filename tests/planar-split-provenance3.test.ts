import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,Rational,cross3,splitPlanarBodyByPlane3,planarBodySplitProvenance3,createBoxBody3,booleanCellularBodies3,planarBodyFromMaterial3,planarMaterialOfCellularBody3,consolidatePlanarBody3,locateBodyFace3,createPlanarBody3,plane3,serializeBody3,restoreBody3} from '../dist/index.js';
import type {Point3,KernelBody3,PlanarBodyPlaneSplit3,PlanarSplitChildProvenance3} from '../dist/index.js';
const q=(n:bigint,d=1n)=>new Rational(n,d),O=point3(0n,0n,0n),box=(x=0n,y=0n,z=0n,size=1n)=>createBoxBody3(point3(x,y,z),size,size,size);
const key=(p:Point3)=>`${p.x},${p.y},${p.z}`;
function vertex(body:KernelBody3,id:number):Point3 {const p=body.topology.vertices[id]!;assert.ok(p.x.rational&&p.y.rational&&p.z.rational);return point3(p.x.rational!,p.y.rational!,p.z.rational!);}
function lerp(a:Point3,b:Point3,t:Rational){return point3(a.x.add(b.x.sub(a.x).mul(t)),a.y.add(b.y.sub(a.y).mul(t)),a.z.add(b.z.sub(a.z).mul(t)));}
function edgePoint(body:KernelBody3,id:number,t:Rational){const e=body.topology.edges[id]!;return lerp(vertex(body,e.start),vertex(body,e.end),t);}
function usePoint(body:KernelBody3,id:number,t:Rational){const h=body.topology.coedges[id]!;return lerp(vertex(body,h.origin),vertex(body,h.target),t);}
function area(p:readonly Point3[]){return p.reduce((sum,a,i)=>{const c=cross3(a,p[(i+1)%p.length]!);return point3(sum.x.add(c.x),sum.y.add(c.y),sum.z.add(c.z));},O);}
function facePolygon(body:KernelBody3,id:number){const f=body.topology.faces[id]!;assert.equal(f.loops.length,1);return body.topology.loops[f.loops[0]!]!.coedges.map(h=>vertex(body,body.topology.coedges[h]!.origin));}
function checkChild(parent:KernelBody3,p:PlanarSplitChildProvenance3){
 const child=p.body;assert.equal(p.faces.length,child.topology.faces.length);assert.equal(p.edges.length,child.topology.edges.length);assert.equal(p.coedges.length,child.topology.coedges.length);assert.equal(p.vertices.length,child.topology.vertices.length);
 p.faces.forEach((row,id)=>{
  assert.ok(Object.isFrozen(row)&&Object.isFrozen(row.fragments)&&Object.isFrozen(row.parentFaces));
  const actual=area(facePolygon(child,id)),sum=row.fragments.reduce((s,f)=>{assert.ok(Object.isFrozen(f)&&Object.isFrozen(f.polygon));f.polygon.forEach(v=>{assert.notEqual(locateBodyFace3(parent,f.parentFace,v),'outside');assert.notEqual(locateBodyFace3(child,id,v),'outside');});const a=area(f.polygon);return point3(s.x.add(a.x),s.y.add(a.y),s.z.add(a.z));},O);
  assert.deepEqual(sum,row.kind==='cut'?O:actual);if(row.kind==='cut'){assert.equal(row.fragments.length,0);assert.equal(row.parentFaces.length,0);}else assert.ok(row.parentFaces.length>0);
 });
 p.edges.forEach((row,id)=>{
  for(const m of row.parentEdges){assert.ok(m.childStart.compare(m.childEnd)<0);assert.deepEqual(edgePoint(child,id,m.childStart),edgePoint(parent,m.edge,m.parentStart));assert.deepEqual(edgePoint(child,id,m.childEnd),edgePoint(parent,m.edge,m.parentEnd));}
  for(const m of row.parentFaces){for(const t of [m.start,m.end,m.start.add(m.end).div(q(2n))])assert.notEqual(locateBodyFace3(parent,m.face,edgePoint(child,id,t)),'outside');}
  for(const m of row.created)assert.ok(m.start.compare(m.end)<0&&m.start.sign()>=0&&m.end.compare(q(1n))<=0);
 });
 p.coedges.forEach((row,id)=>{
  for(const m of row.parentCoedges){assert.deepEqual(usePoint(child,id,m.childStart),usePoint(parent,m.coedge,m.parentStart));assert.deepEqual(usePoint(child,id,m.childEnd),usePoint(parent,m.coedge,m.parentEnd));assert.equal(m.direction,m.parentEnd.sub(m.parentStart).sign());assert.ok(p.faces[child.topology.coedges[id]!.face]!.parentFaces.includes(parent.topology.coedges[m.coedge]!.face));}
 });
 p.vertices.forEach((row,id)=>{const v=vertex(child,id);row.parentVertices.forEach(old=>assert.deepEqual(v,vertex(parent,old)));row.parentEdges.forEach(e=>assert.deepEqual(v,edgePoint(parent,e.edge,e.parameter)));row.parentFaces.forEach(f=>assert.notEqual(locateBodyFace3(parent,f,v),'outside'));assert.equal(row.created,row.parentVertices.length===0);});
}
function check(split:PlanarBodyPlaneSplit3){const p=planarBodySplitProvenance3(split);assert.equal(planarBodySplitProvenance3(split),p);assert.ok(Object.isFrozen(p));checkChild(split.parent,p.negative);checkChild(split.parent,p.positive);assert.throws(()=>planarBodySplitProvenance3({...split}),/factory-created/);return p;}
test('cube cuts map actual parent faces, exact edge intervals and coedge traversal independently',()=>{
 const split=splitPlanarBodyByPlane3(box(),plane3(1n,0n,0n,'-1/2')),p=check(split);
 for(const child of [p.negative,p.positive]){
  assert.equal(child.faces.filter(f=>f.kind==='cut').length,1);assert.equal(child.faces.filter(f=>f.kind==='parent').length,5);
  const created=child.vertices.filter(v=>v.created);assert.equal(created.length,4);created.forEach(v=>{assert.equal(v.parentVertices.length,0);assert.equal(v.parentEdges.length,1);assert.equal(v.parentEdges[0]!.parameter.toString(),'1/2');assert.equal(v.onCutPlane,true);});
  child.coedges.forEach(row=>{const length=[...row.parentCoedges.map(m=>m.childEnd.sub(m.childStart)),...row.created.map(m=>m.end.sub(m.start))].reduce((a,b)=>a.add(b),q(0n));assert.equal(length.toString(),'1');});
  const cut=child.faces.findIndex(f=>f.kind==='cut');child.body.topology.coedges.filter(h=>h.face===cut).forEach(h=>{const id=child.body.topology.coedges.indexOf(h);assert.equal(child.coedges[id]!.parentCoedges.length,0);assert.deepEqual(child.coedges[id]!.created.map(m=>[m.start.toString(),m.end.toString()]),[['0','1']]);});
 }
});
test('oblique cuts retain old corner identities and non-dyadic parent edge parameters',()=>{
 const p=check(splitPlanarBodyByPlane3(box(),plane3(1n,2n,-3n)));
 const all=[...p.negative.vertices,...p.positive.vertices];assert.ok(all.some(v=>v.onCutPlane&&!v.created&&v.parentVertices.length>0));assert.ok(all.some(v=>v.created&&v.parentEdges.some(e=>e.parameter.denominator===3n)));
});
test('consolidated holed and nonconvex parent domains are covered by exact area fragments',()=>{
 const plate=booleanCellularBodies3(createBoxBody3(O,4n,4n,2n),createBoxBody3(point3(1n,1n,-1n),2n,2n,4n),'difference'),parent=consolidatePlanarBody3(planarBodyFromMaterial3(planarMaterialOfCellularBody3(plate))).body;
 assert.ok(parent.topology.faces.some(f=>f.loops.length>1));
 const p=check(splitPlanarBodyByPlane3(parent,plane3(1n,0n,0n,'-1/2')));
 assert.ok([...p.negative.faces,...p.positive.faces].some(f=>f.kind==='parent'&&f.fragments.length>1));
 assert.ok([...p.negative.edges,...p.positive.edges].some(e=>!e.onCutPlane&&e.created.length>0&&e.parentFaces.length>0));
});
test('nonmanifold shared edges retain every relevant parent use without borrowing adjacent faces',()=>{
 const parent=booleanCellularBodies3(box(),box(1n,1n,0n),'union'),split=splitPlanarBodyByPlane3(parent,plane3(0n,0n,1n,'-1/2')),p=check(split),old=parent.topology.edges.findIndex(e=>e.coedges.length===4);assert.ok(old>=0);
 for(const child of [p.negative,p.positive]){
  const edge=child.edges.findIndex(e=>e.parentEdges.some(m=>m.edge===old));assert.ok(edge>=0);const uses=child.body.topology.edges[edge]!.coedges;assert.equal(uses.length,4);
  const inherited=uses.flatMap(h=>child.coedges[h]!.parentCoedges.map(m=>m.coedge));assert.equal(new Set(inherited).size,4);assert.deepEqual([...new Set(inherited)].sort((a,b)=>a-b),[...parent.topology.edges[old]!.coedges].sort((a,b)=>a-b));
 }
});
test('a retained cavity wall and its old edge are distinct from newly created cut coedges',()=>{
 const parent=booleanCellularBodies3(box(0n,0n,0n,3n),box(1n,1n,1n),'difference'),split=splitPlanarBodyByPlane3(parent,plane3(1n,0n,0n,-1n)),p=check(split),center=point3(1n,'3/2','3/2');
 const retained=split.negativeCutFaces.find(id=>locateBodyFace3(split.negative,id,center)==='inside');assert.notEqual(retained,undefined);assert.equal(p.negative.faces[retained!]!.kind,'parent');
 const newUse=split.negative.topology.coedges.findIndex(h=>p.negative.faces[h.face]!.kind==='cut'&&p.negative.edges[h.edge]!.parentEdges.length>0);assert.ok(newUse>=0);assert.equal(p.negative.coedges[newUse]!.parentCoedges.length,0);assert.equal(p.negative.coedges[newUse]!.created.length,1);
});
test('empty, repeated and subprecision cuts retain exact live IDs through parent replay',()=>{
 const empty=check(splitPlanarBodyByPlane3(createPlanarBody3([]),plane3(1n,0n,0n)));assert.equal(empty.negative.faces.length+empty.positive.vertices.length,0);
 const first=splitPlanarBodyByPlane3(box(),plane3(1n,0n,0n,'-1/2')),parent=restoreBody3(serializeBody3(first.positive));check(splitPlanarBodyByPlane3(parent,plane3(0n,1n,0n,'-1/3')));
 const B=q(10n**30n),tiny=q(1n,10n**40n),source=createBoxBody3(point3(B,0n,0n),1n,1n,1n),s=splitPlanarBodyByPlane3(source,plane3(1n,0n,0n,B.add(tiny).neg())),p=check(s);
 assert.ok(p.negative.edges.some(e=>e.parentEdges.some(m=>m.parentEnd.sub(m.parentStart).mul(m.parentEnd.sub(m.parentStart)).equals(tiny.mul(tiny)))));
});
