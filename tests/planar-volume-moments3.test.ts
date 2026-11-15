import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point2,point3,triangle3,line3,cylinder3,extrudePolygon,extrudeBody3,preparePlanarSolid3,planarVolumeMoments3,planarBodyVolumeMoments3,createPlanarBody3,createBoxBody3,createCylinderBody3,consolidatePlanarBody3,serializeBody3,restoreBody3,boundaryBoxMaterial3,bodyFromCylinderMaterial3,booleanMixedBodies3} from '../dist/index.js';
import type {Point3,RationalMatrix3,PlanarVolumeMoments3} from '../dist/index.js';
const axes=['x','y','z'] as const,Q=(n:bigint,d=1n)=>new Rational(n,d),zero=Q(0n),two=Q(2n),twelve=Q(12n);
const strings=(m:RationalMatrix3)=>m.map(r=>r.map(v=>v.toString()));
function eq(a:Rational,b:Rational){assert.equal(a.toString(),b.toString());}
function box(lo:Point3,hi:Point3){const p=(x:number,y:number,z:number)=>point3(x?hi.x:lo.x,y?hi.y:lo.y,z?hi.z:lo.z);return [[p(0,0,0),p(0,1,0),p(1,1,0),p(1,0,0)],[p(0,0,1),p(1,0,1),p(1,1,1),p(0,1,1)],[p(0,0,0),p(0,0,1),p(0,1,1),p(0,1,0)],[p(1,0,0),p(1,1,0),p(1,1,1),p(1,0,1)],[p(0,0,0),p(1,0,0),p(1,0,1),p(0,0,1)],[p(0,1,0),p(0,1,1),p(1,1,1),p(1,1,0)]];}
function boxOracle(lo:Point3,hi:Point3){
 const widths=axes.map(k=>hi[k].sub(lo[k])),volume=widths.reduce((a,b)=>a.mul(b),Q(1n)),centroid=point3(...axes.map(k=>lo[k].add(hi[k]).div(two)) as Parameters<typeof point3>),c=axes.map(k=>centroid[k]),norm=c.reduce((a,b)=>a.add(b.mul(b)),zero);
 const central=[0,1,2].map(i=>[0,1,2].map(j=>i===j?volume.mul(widths.reduce((a,w,k)=>k===i?a:a.add(w.mul(w)),zero)).div(twelve):zero));
 const origin=central.map((row,i)=>row.map((v,j)=>v.add(volume.mul((i===j?norm:zero).sub(c[i]!.mul(c[j]!))))));return {volume,centroid,central,origin};
}
function againstBox(actual:PlanarVolumeMoments3,lo:Point3,hi:Point3){const e=boxOracle(lo,hi);eq(actual.volume,e.volume);assert.deepEqual(actual.centroid,e.centroid);assert.deepEqual(strings(actual.inertiaAtCentroid),e.central.map(r=>r.map(v=>v.toString())));assert.deepEqual(strings(actual.inertiaAtOrigin),e.origin.map(r=>r.map(v=>v.toString())));}
function tetra(){const O=point3(0n,0n),X=point3(1n,0n),Y=point3(0n,1n),Z=point3(0n,0n,1n);return [[O,Y,X],[O,X,Z],[O,Z,Y],[X,Y,Z]];}
test('rectangular material matches independent cuboid volume, centroid and both inertia formulas',()=>{
 const lo=point3(10n,-3n,5n),hi=point3(12n,0n,9n),source=preparePlanarSolid3(box(lo,hi)),m=planarVolumeMoments3(source);againstBox(m,lo,hi);eq(m.volume,Q(24n));assert.deepEqual(strings(m.inertiaAtCentroid),[['50','0','0'],['0','40','0'],['0','0','26']]);assert.ok(Object.isFrozen(m)&&Object.isFrozen(m.centroid));for(const t of [m.inertiaAtOrigin,m.inertiaAtCentroid]){assert.ok(Object.isFrozen(t));t.forEach(r=>assert.ok(Object.isFrozen(r)));}
 assert.throws(()=>planarVolumeMoments3({...source}),/factory/);
});
test('simplex monomial moments and huge translations preserve exact central inertia',()=>{
 const source=preparePlanarSolid3(tetra()),m=planarVolumeMoments3(source);eq(m.volume,Q(1n,6n));assert.deepEqual(m.centroid,point3('1/4','1/4','1/4'));
 assert.deepEqual(strings(m.inertiaAtCentroid),[['1/80','1/480','1/480'],['1/480','1/80','1/480'],['1/480','1/480','1/80']]);assert.deepEqual(strings(m.inertiaAtOrigin),[['1/30','-1/120','-1/120'],['-1/120','1/30','-1/120'],['-1/120','-1/120','1/30']]);
 const shift=10n**60n,translated=preparePlanarSolid3(tetra().map(f=>f.map(p=>point3(p.x.add(Q(shift)),p.y.sub(Q(shift)),p.z.add(Q(2n*shift)))))),moved=planarVolumeMoments3(translated);eq(moved.volume,m.volume);assert.deepEqual(strings(moved.inertiaAtCentroid),strings(m.inertiaAtCentroid));assert.deepEqual(moved.centroid,point3(Q(shift).add(Q(1n,4n)),Q(-shift).add(Q(1n,4n)),Q(2n*shift).add(Q(1n,4n))));
});
test('reflected sheared simplex obeys the independent affine covariance law',()=>{
 const A=[[Q(2n),Q(1n),zero],[zero,Q(3n),Q(1n)],[zero,zero,Q(-1n)]],t=[Q(5n,7n),Q(-11n,13n),Q(17n,19n)],transform=(p:Point3)=>point3(...A.map((row,i)=>row.reduce((s,a,k)=>s.add(a.mul(p[axes[k]!])),t[i]!)) as Parameters<typeof point3>),m=planarVolumeMoments3(preparePlanarSolid3(tetra().map(f=>f.map(transform).reverse())));eq(m.volume,Q(1n));assert.deepEqual(m.centroid,transform(point3('1/4','1/4','1/4')));
 const covariance=[0,1,2].map(i=>[0,1,2].map(j=>{let sum=zero;for(let k=0;k<3;k++)for(let l=0;l<3;l++)sum=sum.add(A[i]![k]!.mul(k===l?Q(1n,160n):Q(-1n,480n)).mul(A[j]![l]!));return sum.mul(Q(6n));})),trace=covariance[0]![0]!.add(covariance[1]![1]!).add(covariance[2]![2]!);
 assert.deepEqual(strings(m.inertiaAtCentroid),covariance.map((row,i)=>row.map((v,j)=>(i===j?trace.sub(v):v.neg()).toString())));
});
test('cavity, material island and disconnected component subtract and add their analytic moments',()=>{
 const specs=[[0n,6n,1n],[1n,5n,-1n],[2n,4n,1n],[8n,9n,1n]] as const,faces=specs.flatMap(([a,b,s])=>box(point3(a,a,a),point3(b,b,b)).map(f=>s===1n?f:[...f].reverse())),m=planarVolumeMoments3(preparePlanarSolid3(faces));let volume=zero;const first=[zero,zero,zero],origin=Array.from({length:3},()=>[zero,zero,zero]);
 for(const [a,b,sign] of specs){const e=boxOracle(point3(a,a,a),point3(b,b,b)),s=Q(sign);volume=volume.add(e.volume.mul(s));for(let i=0;i<3;i++){first[i]=first[i]!.add(e.volume.mul(e.centroid[axes[i]!]).mul(s));for(let j=0;j<3;j++)origin[i]![j]=origin[i]![j]!.add(e.origin[i]![j]!.mul(s));}}
 const c=first.map(v=>v.div(volume)),norm=c.reduce((a,v)=>a.add(v.mul(v)),zero);eq(m.volume,Q(161n));assert.deepEqual(m.centroid,point3('977/322','977/322','977/322'));assert.deepEqual(strings(m.inertiaAtOrigin),origin.map(r=>r.map(v=>v.toString())));
 assert.deepEqual(strings(m.inertiaAtCentroid),origin.map((row,i)=>row.map((v,j)=>v.sub(volume.mul((i===j?norm:zero).sub(c[i]!.mul(c[j]!)))).toString())));
});
test('surface subdivision and common Body source variants preserve the same exact volume moments',()=>{
 const lo=point3('1/3','-2/5','7/11'),hi=point3('7/3','13/5','51/11'),source=preparePlanarSolid3(box(lo,hi)),m=planarVolumeMoments3(source),subdivided=planarVolumeMoments3(preparePlanarSolid3(source.triangles));assert.deepEqual(subdivided,m);
 const native=restoreBody3(serializeBody3(createPlanarBody3(source.polygons))),before=serializeBody3(native),consolidated=restoreBody3(serializeBody3(consolidatePlanarBody3(native).body));assert.deepEqual(planarBodyVolumeMoments3(native),m);assert.deepEqual(planarBodyVolumeMoments3(consolidated),m);assert.equal(serializeBody3(native),before);assert.throws(()=>planarBodyVolumeMoments3({...native}),/factory/);
 const built=restoreBody3(serializeBody3(createBoxBody3(lo,2n,3n,4n)));againstBox(planarBodyVolumeMoments3(built),lo,hi);
 const material=bodyFromCylinderMaterial3(boundaryBoxMaterial3(point3(0n,0n),1n,1n,1n));againstBox(planarBodyVolumeMoments3(material),point3(0n,0n),point3(1n,1n,1n));
});
test('empty material has zero moments and no centroid while curved Body mass is explicitly unsupported',()=>{
 const source=preparePlanarSolid3([]),m=planarVolumeMoments3(source);eq(m.volume,zero);assert.equal(m.centroid,null);for(const t of [m.inertiaAtOrigin,m.inertiaAtCentroid])assert.deepEqual(strings(t),[['0','0','0'],['0','0','0'],['0','0','0']]);assert.deepEqual(planarBodyVolumeMoments3(createPlanarBody3([])),m);
 const cylinder=createCylinderBody3(cylinder3(line3(point3(0n,0n),point3(0n,0n,1n)),1n),0n,1n);assert.throws(()=>planarBodyVolumeMoments3(cylinder),/curved surfaces/);
});
test('native concave Boolean replay matches the analytic moments of two nonoverlapping cuboids',()=>{
 const make=(dx:bigint)=>{const mesh=extrudePolygon([[point2(0n,0n),point2(2n,0n),point2(2n,1n),point2(1n,1n),point2(1n,2n),point2(0n,2n)]],2n),vertices=mesh.vertices.map(p=>point3(p.x.add(Q(dx)),p.y,p.z));return createPlanarBody3(mesh.triangles.map(t=>triangle3(vertices[t[0]]!,vertices[t[1]]!,vertices[t[2]]!)));},body=restoreBody3(serializeBody3(booleanMixedBodies3(make(0n),make(1n),'union'))),m=planarBodyVolumeMoments3(body);
 // The union is [0,3]×[0,1]×[0,2] plus [0,2]×[1,2]×[0,2].
 eq(m.volume,Q(10n));assert.deepEqual(m.centroid,point3('13/10','9/10',1n));
 assert.deepEqual(strings(m.inertiaAtOrigin),[['74/3','-21/2','-13'],['-21/2','110/3','-9'],['-13','-9','104/3']]);assert.deepEqual(strings(m.inertiaAtCentroid),[['197/30','6/5','0'],['6/5','293/30','0'],['0','0','29/3']]);
});
test('native straight-profile extrusion with a through-hole subtracts the tunnel moments exactly',()=>{
 const ring=(input:readonly (readonly [bigint,bigint])[])=>{const p=input.map(([x,y])=>point2(x,y));return p.map((start,i)=>({kind:'segment' as const,segment:{start,end:p[(i+1)%p.length]!}}));},body=restoreBody3(serializeBody3(extrudeBody3([ring([[0n,0n],[4n,0n],[4n,4n],[0n,4n]]),ring([[1n,1n],[1n,3n],[3n,3n],[3n,1n]])],2n,{fillRule:'nonzero'}))),before=serializeBody3(body),m=planarBodyVolumeMoments3(body);
 eq(m.volume,Q(24n));assert.deepEqual(m.centroid,point3(2n,2n,1n));assert.deepEqual(strings(m.inertiaAtCentroid),[['48','0','0'],['0','48','0'],['0','0','80']]);assert.deepEqual(strings(m.inertiaAtOrigin),[['168','-96','-48'],['-96','168','-48'],['-48','-48','272']]);assert.equal(serializeBody3(body),before);
});
test('extremely small rational material at huge coordinates retains nonzero exact moments',()=>{
 const shift=10n**80n,lo=point3(shift,-shift,2n*shift),hi=point3(lo.x.add(Q(1n,10n**40n)),lo.y.add(Q(1n,10n**50n)),lo.z.add(Q(1n,10n**60n))),m=planarVolumeMoments3(preparePlanarSolid3(box(lo,hi)));
 againstBox(m,lo,hi);eq(m.volume,Q(1n,10n**150n));assert.equal(m.volume.sign(),1);assert.equal(m.inertiaAtCentroid[0][0].sign(),1);
});
