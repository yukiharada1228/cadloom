import test from 'node:test';
import assert from 'node:assert/strict';
import {
 intersectNurbsSourceFacePlane3,nurbsSourceFacePlaneEdgePoint3,nurbsSourceFacePlaneAreaPoint3,plane3,
 prepareNurbsSourceFaceComplex3,selectNurbsSourceFacePatches3,liftNurbsSourceFaceBoundaries3,classifyNurbsSourceFaces3,
 buildNurbsSourceHalfedges3,buildNurbsSourceBoundaryComplex3,refineNurbsAffineIntersectionComplex3,sewNurbsAffineIntersection3,
 trimNurbsAffineIntersection3,intersectNurbsSurfaceAffineTarget3,certifyNurbsSurfaceAffineProjection3,
 point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,AlgebraicReal,Rational
} from '../dist/index.js';
import type {NurbsSurface3,PreparedNurbsParameterDomain2} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n];
function ring(a:string,b:string,c:string,d:string,hole=false){let p=[point3(a,b,0n),point3(c,b,0n),point3(c,d,0n),point3(a,d,0n)];if(hole)p=p.reverse();return p.map((q,i)=>nurbsCurve3(1,[q,p[(i+1)%4]!],K));}
const unit=()=>prepareNurbsParameterDomain2(ring('0','0','1','1'));
const plane=(z='0')=>nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,z))),K,K);
function refined(s:NurbsSurface3,t:NurbsSurface3,d:PreparedNurbsParameterDomain2=unit()){const c=certifyNurbsSurfaceAffineProjection3(t);if(c.kind!=='certified')throw Error('Expected certificate');return refineNurbsAffineIntersectionComplex3(sewNurbsAffineIntersection3(trimNurbsAffineIntersection3(intersectNurbsSurfaceAffineTarget3(s,c.certificate),d,unit())));}
function prepared(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const f=classifyNurbsSourceFaces3(buildNurbsSourceHalfedges3(buildNurbsSourceBoundaryComplex3(refined(s,t,d))));assert.equal(f.kind,'classified');return f;}
function lifted(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const r=liftNurbsSourceFaceBoundaries3(prepared(s,t,d));assert.equal(r.kind,'lifted');if(r.kind!=='lifted')throw Error('Expected lift');return r;}
function selected(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const result=selectNurbsSourceFacePatches3(lifted(s,t,d));assert.equal(result.kind,'selected');if(result.kind!=='selected')throw Error('Expected patch selection');return result;}
const fold=()=>nurbsSurface3(1,2,[0n,1n].map(u=>['1/4','-1/4','1/4'].map(y=>point3(u,y,0n))),K,K2);
function complex(s:NurbsSurface3,t=plane('2'),d=unit()){const r=prepareNurbsSourceFaceComplex3(selected(s,t,d));assert.equal(r.kind,'prepared');if(r.kind!=='prepared')throw Error('Expected prepared complex');return r;}

function planeSection(c:ReturnType<typeof complex>,p:ReturnType<typeof plane3>){const r=intersectNurbsSourceFacePlane3(c,c.faces[0]!.face,p);assert.equal(r.kind,'resolved');if(r.kind!=='resolved')throw Error('Expected finite plane section');return r;}
function sampleEdges(r:ReturnType<typeof planeSection>){return r.edges.map((e,i)=>{let a=e.lower,b=e.upper;while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return nurbsSourceFacePlaneEdgePoint3(r,i,a.upper.add(b.lower).div(new Rational(2n)));});}
test('finite source face plane sections cut through trims and holes rather than extending support curves',()=>{
 const domain=prepareNurbsParameterDomain2(ring('0','0','1','1'),[ring('1/4','1/4','3/4','3/4',true)]),c=complex(plane(),plane('100'),domain),r=planeSection(c,plane3(1n,0n,0n,'-1/2'));
 assert.equal(r.areas.length,0);assert.equal(r.edges.length,2);assert.equal(r.vertices.length,4);assert.deepEqual(r.vertices.map(v=>v.point.y.recognizeRational().rational?.toString()).sort(),['0','1','1/4','3/4'].sort());for(const p of sampleEdges(r)){assert.equal(p.point.x.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(p.point.z.sign(),0);assert.ok(p.point.y.compare(AlgebraicReal.fromRational('1/4'))<0||p.point.y.compare(AlgebraicReal.fromRational('3/4'))>0);}
 const miss=planeSection(c,plane3(1n,0n,0n,-2n));assert.equal(miss.vertices.length,0);assert.equal(miss.edges.length,0);
});
test('coplanar finite face areas retain hole and trim membership with closed boundaries',()=>{
 const domain=prepareNurbsParameterDomain2(ring('0','0','1','1'),[ring('1/4','1/4','3/4','3/4',true)]),r=planeSection(complex(plane(),plane('100'),domain),plane3(0n,0n,1n));assert.equal(r.areas.length,1);assert.equal(r.edges.length,0);assert.equal(nurbsSourceFacePlaneAreaPoint3(r,0,'1/2','1/2'),null);assert.equal(nurbsSourceFacePlaneAreaPoint3(r,0,2n,'1/2'),null);assert.equal(nurbsSourceFacePlaneAreaPoint3(r,0,'1/8','1/2')?.stratum,'face');assert.equal(nurbsSourceFacePlaneAreaPoint3(r,0,'1/4','1/2')?.stratum,'edge');
});
test('isolated tangency and crossing branches remain distinct exact section strata',()=>{
 const U=['0','1/2','1'],B=['1/4','-1/4','1/4'],bowl=nurbsSurface3(2,2,U.map((u,i)=>U.map((v,j)=>point3(u,v,Rational.parse(B[i]!).add(Rational.parse(B[j]!))))),K2,K2),a=planeSection(complex(bowl,plane('100')),plane3(0n,0n,1n));assert.equal(a.vertices.length,1);assert.equal(a.edges.length,0);assert.equal(a.areas.length,0);assert.equal(a.vertices[0]!.point.x.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(a.vertices[0]!.point.y.compare(AlgebraicReal.fromRational('1/2')),0);
 const saddle=nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,new Rational(2n*u-1n,2n).mul(new Rational(2n*v-1n,2n))))),K,K),b=planeSection(complex(saddle,plane('100')),plane3(0n,0n,1n));assert.equal(b.edges.length,4);assert.equal(b.vertices.length,5);for(const p of sampleEdges(b))assert.equal(p.point.z.sign(),0);
 const tangentStrip=nurbsSurface3(2,1,U.map((u,i)=>[0n,1n].map(v=>point3(u,v,B[i]!))),K2,K),line=planeSection(complex(tangentStrip,plane('100')),plane3(0n,0n,1n));assert.equal(line.edges.length,1);assert.equal(line.areas.length,0);for(const p of sampleEdges(line)){assert.equal(p.point.x.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(p.point.z.sign(),0);}
});
test('knot-line sections preserve both approached patches and coplanar domains',()=>{
 const surface=(zs:string[])=>nurbsSurface3(1,1,['0','1/2','1'].map((u,i)=>[0n,1n].map(v=>point3(u,v,zs[i]!))),[0n,0n,'1/2',1n,1n],K),crease=planeSection(complex(surface(['1/2','0','1/2']),plane('100')),plane3(0n,0n,1n));assert.equal(crease.vertices.length,2);assert.equal(crease.edges.length,2);assert.deepEqual(crease.edges.map(e=>e.patch),[0,1]);assert.ok(sampleEdges(crease).every(p=>p.patches.length===2));
 const s=surface(['0','0','1/2']),mixed=planeSection(complex(s,plane('100')),plane3(0n,0n,1n));assert.equal(mixed.areas.length,1);assert.equal(mixed.edges.length,1);assert.equal(nurbsSourceFacePlaneAreaPoint3(mixed,0,'1/4','1/2')?.point.z.sign(),0);assert.equal(nurbsSourceFacePlaneAreaPoint3(mixed,0,'3/4','1/2'),null);
 const restricted=planeSection(complex(s,plane('100'),prepareNurbsParameterDomain2(ring('0','0','1/2','1'))),plane3(0n,0n,1n));assert.equal(restricted.areas.length,1);assert.equal(restricted.edges.length,0);
});
test('finite section evaluation rejects forged provenance and invalid indices or ranges',()=>{
 const c=complex(plane(),plane('100')),r=planeSection(c,plane3(1n,0n,0n,'-1/2'));assert.throws(()=>intersectNurbsSourceFacePlane3({...c},0,r.plane),/factory/);assert.throws(()=>intersectNurbsSourceFacePlane3(c,99,r.plane),/face/);assert.throws(()=>nurbsSourceFacePlaneEdgePoint3({...r},0,'1/2'),/factory/);assert.throws(()=>nurbsSourceFacePlaneEdgePoint3(r,99,'1/2'),/edge/);assert.throws(()=>nurbsSourceFacePlaneEdgePoint3(r,0,-1n),/outside/);assert.throws(()=>nurbsSourceFacePlaneAreaPoint3(r,0,'1/2','1/2'),/area/);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.edges)&&Object.isFrozen(r.vertices));
});

test('weighted curved plane sections preserve exact circular images and algebraic trim endpoints',()=>{
 const s=nurbsSurface3(2,1,[[1n,0n],[1n,1n],[0n,1n]].map(([x,y])=>[0n,1n].map(z=>point3(x!,y!,z))),K2,K,[[1n,1n],[1n,1n],[2n,2n]]),c=complex(s,plane('100'));
 const horizontal=planeSection(c,plane3(0n,0n,1n,'-1/2'));assert.equal(horizontal.edges.length,1);const p=nurbsSourceFacePlaneEdgePoint3(horizontal,0,'1/2');assert.equal(p.point.x.compare(AlgebraicReal.fromRational('3/5')),0);assert.equal(p.point.y.compare(AlgebraicReal.fromRational('4/5')),0);assert.equal(p.point.z.compare(AlgebraicReal.fromRational('1/2')),0);
 const vertical=planeSection(c,plane3(1n,0n,0n,'-1/2'));assert.equal(vertical.edges.length,1);assert.equal(vertical.vertices.length,2);assert.equal(vertical.vertices[0]!.u.recognizeRational().rational,null);for(const p of sampleEdges(vertical)){assert.equal(p.point.x.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(p.point.y.mul(p.point.y).compare(AlgebraicReal.fromRational('3/4')),0);}
 const oblique=planeSection(c,plane3(-1n,-1n,2n));for(const p of sampleEdges(oblique))assert.equal(AlgebraicReal.linearCombination([{value:p.point.x,coefficient:-1n},{value:p.point.y,coefficient:-1n},{value:p.point.z,coefficient:2n}]).sign(),0);
 const reversed=planeSection(c,plane3(0n,0n,-1n,'1/2'));assert.equal(reversed.edges.length,horizontal.edges.length);assert.equal(reversed.vertices.length,horizontal.vertices.length);
});
test('circular finite trims retain a coplanar disk and isolated trim tangency',()=>{
 const xy=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1],[1,0]],weights=[1n,1n,2n,2n,4n,4n,8n,8n,16n],curves=[0,1,2,3].map(k=>nurbsCurve3(2,xy.slice(2*k,2*k+3).map(([x,y])=>point3(new Rational(BigInt(x!)+1n,2n),new Rational(BigInt(y!)+1n,2n),0n)),K2,weights.slice(2*k,2*k+3))),domain=prepareNurbsParameterDomain2(curves),c=complex(plane(),plane('100'),domain),area=planeSection(c,plane3(0n,0n,1n));assert.equal(area.areas.length,1);assert.equal(nurbsSourceFacePlaneAreaPoint3(area,0,0n,0n),null);assert.ok(nurbsSourceFacePlaneAreaPoint3(area,0,'1/2','1/2'));assert.ok(nurbsSourceFacePlaneAreaPoint3(area,0,1n,'1/2'));
 const tangent=planeSection(c,plane3(1n,0n,0n,-1n));assert.equal(tangent.vertices.length,1);assert.equal(tangent.edges.length,0);assert.equal(tangent.areas.length,0);assert.equal(tangent.vertices[0]!.point.y.compare(AlgebraicReal.fromRational('1/2')),0);
 const diameter=planeSection(c,plane3(1n,0n,0n,'-1/2'));let total=new Rational(0n);for(const e of diameter.edges){const a=e.lower.recognizeRational().rational!,b=e.upper.recognizeRational().rational!;total=total.add(b.sub(a));}assert.equal(total.toString(),'1');
});
test('unprepared source faces stay unresolved and invalid zero planes are rejected',()=>{
 const unavailable=prepareNurbsSourceFaceComplex3(selected(fold(),plane('100')));assert.notEqual(unavailable.kind,'prepared');assert.deepEqual(intersectNurbsSourceFacePlane3(unavailable,0,plane3(0n,0n,1n)),{kind:'unresolved',reason:'unprepared-complex'});
 const c=complex(plane(),plane('100'));assert.throws(()=>intersectNurbsSourceFacePlane3(c,c.faces[0]!.face,{normal:point3(0n,0n,0n),offset:new Rational(0n)}),/nonzero/);
});

test('implicit oval sections are clipped into separate arcs by a finite hole',()=>{
 const U=['0','1/2','1'],B=['1/4','-1/4','1/4'],s=nurbsSurface3(2,2,U.map((u,i)=>U.map((v,j)=>point3(u,v,Rational.parse(B[i]!).add(Rational.parse(B[j]!))))),K2,K2),domain=prepareNurbsParameterDomain2(ring('0','0','1','1'),[ring('1/4','1/4','3/4','3/4',true)]),c=complex(s,plane('100'),domain),r=planeSection(c,plane3(0n,0n,1n,'-1/10'));
 const parent=r.vertices.map((_,i)=>i),find=(i:number):number=>parent[i]===i?i:(parent[i]=find(parent[i]!));for(const e of r.edges)parent[find(e.to)]=find(e.from);assert.equal(new Set(r.edges.map(e=>find(e.from))).size,4);assert.equal(r.areas.length,0);
 for(const p of sampleEdges(r)){assert.equal(p.point.z.compare(AlgebraicReal.fromRational('1/10')),0);assert.ok([p.point.x,p.point.y].some(q=>q.compare(AlgebraicReal.fromRational('1/4'))<0||q.compare(AlgebraicReal.fromRational('3/4'))>0));}
 const hidden=planeSection(c,plane3(0n,0n,1n,'-1/100'));assert.equal(hidden.vertices.length,0);assert.equal(hidden.edges.length,0);assert.equal(hidden.areas.length,0);
});

test('source faces already separated by SSI are sectioned individually',()=>{
 const target=nurbsSurface3(1,1,[0n,1n].map(y=>[-1n,1n].map(z=>point3('1/2',y,z))),K,K),c=complex(plane(),target),spans:string[][]=[];assert.equal(c.faces.length,2);
 for(const face of c.faces){const r=intersectNurbsSourceFacePlane3(c,face.face,plane3(0n,1n,0n,'-1/2'));assert.equal(r.kind,'resolved');if(r.kind==='resolved'){assert.equal(r.edges.length,1);const e=r.edges[0]!;spans.push([r.vertices[e.from]!.point.x,r.vertices[e.to]!.point.x].map(x=>x.recognizeRational().rational!.toString()));}}
 assert.deepEqual(spans.sort((a,b)=>a[0]!.localeCompare(b[0]!)),[['0','1/2'],['1/2','1']]);
});
