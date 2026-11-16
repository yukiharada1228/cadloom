import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,Rational,createBoxBody3,booleanCellularBodies3,planarBodyVolumeMoments3,closestPointOnPlanarBodyBoundary3,serializeCellularBody3,restoreCellularBody3,locateCellularBody3,similarityTransform3,transformBody3,transformPointBySimilarity3,planarMaterialOfCellularBody3,planarMaterialVolumeMoments3,closestPointOnPlanarMaterialBoundary3,preparePlanarSolid3,booleanPlanarSolids3,planarVolumeMoments3,closestPointOnPlanarSolidBoundary3} from '../dist/index.js';
import type {Point3,PlanarVolumeMoments3,RationalMatrix3} from '../dist/index.js';
const q=(n:bigint,d=1n)=>new Rational(n,d),zero=q(0n),axes=['x','y','z'] as const;
const box=(x=0n,y=0n,z=0n,size=1n)=>createBoxBody3(point3(x,y,z),size,size,size);
const matrixStrings=(m:RationalMatrix3)=>m.map(row=>row.map(v=>v.toString()));
const key=(p:Point3)=>`${p.x},${p.y},${p.z}`;
/** Independent cuboid integrals and signed additivity, without boundary integration. */
function oracle(specs:readonly {lo:Point3;hi:Point3;sign:1|-1}[]){
 let volume=zero;const first=[zero,zero,zero],origin=Array.from({length:3},()=>[zero,zero,zero]);
 for(const {lo,hi,sign} of specs){
  const widths=axes.map(k=>hi[k].sub(lo[k])),v=widths.reduce((a,b)=>a.mul(b),q(BigInt(sign))),center=axes.map(k=>lo[k].add(hi[k]).div(q(2n))),norm=center.reduce((s,c)=>s.add(c.mul(c)),zero);volume=volume.add(v);
  for(let i=0;i<3;i++){first[i]=first[i]!.add(v.mul(center[i]!));for(let j=0;j<3;j++){
   const central=i===j?v.mul(widths.reduce((s,w,k)=>k===i?s:s.add(w.mul(w)),zero)).div(q(12n)):zero;
   origin[i]![j]=origin[i]![j]!.add(central).add(v.mul((i===j?norm:zero).sub(center[i]!.mul(center[j]!))));
  }}
 }
 const center=first.map(v=>v.div(volume)),norm=center.reduce((s,c)=>s.add(c.mul(c)),zero);
 return {volume,centroid:point3(center[0]!,center[1]!,center[2]!),origin:origin.map(r=>r.map(v=>v.toString())),central:origin.map((r,i)=>r.map((v,j)=>v.sub(volume.mul((i===j?norm:zero).sub(center[i]!.mul(center[j]!)))).toString()))};
}
function against(m:PlanarVolumeMoments3,specs:Parameters<typeof oracle>[0]){const e=oracle(specs);assert.equal(m.volume.toString(),e.volume.toString());assert.deepEqual(m.centroid,e.centroid);assert.deepEqual(matrixStrings(m.inertiaAtOrigin),e.origin);assert.deepEqual(matrixStrings(m.inertiaAtCentroid),e.central);}
const spec=(lo:Point3,hi:Point3,sign:1|-1=1)=>({lo,hi,sign});
test('edge and vertex contact moments match independent cuboid sums through common and material entry points',()=>{
 for(const shift of [[1n,1n,0n],[1n,1n,1n]] as const){
  const body=restoreCellularBody3(serializeCellularBody3(booleanCellularBodies3(box(),box(shift[0],shift[1],shift[2]),'union'))),m=planarBodyVolumeMoments3(body),material=planarMaterialOfCellularBody3(body);
  against(m,[spec(point3(0n,0n,0n),point3(1n,1n,1n)),spec(point3(shift[0],shift[1],shift[2]),point3(shift[0]+1n,shift[1]+1n,shift[2]+1n))]);
  assert.deepEqual(planarMaterialVolumeMoments3(material),m);assert.equal(body.topology.closedOrientedIncidence,false);
 }
 const a=preparePlanarSolid3(planarMaterialOfCellularBody3(restoreCellularBody3(serializeCellularBody3(booleanCellularBodies3(box(),box(),'union')))).polygons),b=preparePlanarSolid3(a.polygons.map(p=>p.map(v=>point3(v.x.add(q(1n)),v.y.add(q(1n)),v.z)))),raw=booleanPlanarSolids3(a,b,'union');
 against(planarVolumeMoments3(raw),[spec(point3(0n,0n,0n),point3(1n,1n,1n)),spec(point3(1n,1n,0n),point3(2n,2n,1n))]);
 assert.equal(closestPointOnPlanarSolidBoundary3(raw,point3(1n,1n,'1/2')).kind,'points');assert.throws(()=>planarVolumeMoments3({...raw}),/factory/);assert.throws(()=>closestPointOnPlanarSolidBoundary3({...raw},point3(0n,0n,0n)),/factory/);
});
test('touching cavities subtract and overlapping XOR removes twice the intersection moments',()=>{
 const holes=booleanCellularBodies3(box(1n,1n,1n),box(2n,2n,1n),'union'),body=restoreCellularBody3(serializeCellularBody3(booleanCellularBodies3(box(0n,0n,0n,4n),holes,'difference')));
 against(planarBodyVolumeMoments3(body),[spec(point3(0n,0n,0n),point3(4n,4n,4n)),spec(point3(1n,1n,1n),point3(2n,2n,2n),-1),spec(point3(2n,2n,1n),point3(3n,3n,2n),-1)]);
 const xor=restoreCellularBody3(serializeCellularBody3(booleanCellularBodies3(box(0n,0n,0n,2n),box(1n,1n,1n,2n),'xor')));
 against(planarBodyVolumeMoments3(xor),[spec(point3(0n,0n,0n),point3(2n,2n,2n)),spec(point3(1n,1n,1n),point3(3n,3n,3n)),spec(point3(1n,1n,1n),point3(2n,2n,2n),-1),spec(point3(1n,1n,1n),point3(2n,2n,2n),-1)]);
});
test('global boundary minima retain contact points, ties and cancellation of shared internal faces',()=>{
 const body=booleanCellularBodies3(box(),box(1n,1n,0n),'union'),material=planarMaterialOfCellularBody3(body);
 const cases=[[point3(1n,1n,'1/2'),'0',1],[point3('3/2','1/2','1/2'),'1/4',2],[point3('1/2','1/2','1/2'),'1/4',6]] as const;
 for(const [p,d,count] of cases){const r=closestPointOnPlanarBodyBoundary3(body,p);assert.equal(r.kind,'points');if(r.kind!=='points')continue;assert.equal(r.squaredDistance.toString(),d);assert.equal(r.points.length,count);r.points.forEach(v=>assert.equal(locateCellularBody3(body,v),'boundary'));assert.deepEqual(closestPointOnPlanarMaterialBoundary3(material,p),r);}
 const joined=booleanCellularBodies3(box(),box(1n,0n,0n),'union'),r=closestPointOnPlanarBodyBoundary3(joined,point3(1n,'1/2','1/2'));assert.equal(r.kind,'points');if(r.kind==='points'){assert.equal(r.squaredDistance.toString(),'1/4');assert.equal(r.points.length,4);}
 assert.throws(()=>closestPointOnPlanarBodyBoundary3({...body},point3(0n,0n,0n)),/factory/);assert.throws(()=>planarBodyVolumeMoments3({...body}),/factory/);assert.throws(()=>planarMaterialVolumeMoments3({...material}),/factory/);
});
test('reflection, scale and replay preserve exact distance and central inertia covariance',()=>{
 const source=booleanCellularBodies3(box(),box(1n,1n,0n),'union'),t=similarityTransform3([point3(-2n,0n,0n),point3(0n,2n,0n),point3(0n,0n,2n)],point3(10n,-3n,5n)),target=restoreCellularBody3(serializeCellularBody3(transformBody3(source,t))),a=planarBodyVolumeMoments3(source),b=planarBodyVolumeMoments3(target);
 assert.equal(b.volume.toString(),a.volume.mul(q(8n)).toString());assert.deepEqual(b.centroid,transformPointBySimilarity3(t,a.centroid!));
 const signs=[-1n,1n,1n];assert.deepEqual(matrixStrings(b.inertiaAtCentroid),a.inertiaAtCentroid.map((row,i)=>row.map((v,j)=>v.mul(q(32n*signs[i]!*signs[j]!)).toString())));
 const p=point3('3/2','1/2','1/2'),u=closestPointOnPlanarBodyBoundary3(source,p),v=closestPointOnPlanarBodyBoundary3(target,transformPointBySimilarity3(t,p));assert.equal(u.kind,'points');assert.equal(v.kind,'points');if(u.kind==='points'&&v.kind==='points'){assert.equal(v.squaredDistance.toString(),u.squaredDistance.mul(q(4n)).toString());assert.deepEqual(v.points.map(key).sort(),u.points.map(p=>key(transformPointBySimilarity3(t,p))).sort());}
});
test('empty material and subprecision distances at huge coordinates keep exact values',()=>{
 const empty=booleanCellularBodies3(box(),box(),'difference'),m=planarBodyVolumeMoments3(empty);assert.equal(m.volume.toString(),'0');assert.equal(m.centroid,null);assert.equal(closestPointOnPlanarBodyBoundary3(empty,point3(0n,0n,0n)).kind,'empty');
 const B=q(10n**30n),tiny=q(1n,10n**40n),left=B.add(q(1n)),right=left.add(tiny),a=createBoxBody3(point3(B,0n,0n),1n,1n,1n),b=createBoxBody3(point3(right,0n,0n),1n,1n,1n),body=booleanCellularBodies3(a,b,'union'),r=closestPointOnPlanarBodyBoundary3(body,point3(left.add(tiny.div(q(2n))),'1/2','1/2'));
 assert.equal(r.kind,'points');if(r.kind==='points'){assert.equal(r.points.length,2);assert.equal(r.squaredDistance.toString(),tiny.mul(tiny).div(q(4n)).toString());}
 against(planarBodyVolumeMoments3(body),[spec(point3(B,0n,0n),point3(left,1n,1n)),spec(point3(right,0n,0n),point3(right.add(q(1n)),1n,1n))]);
});
