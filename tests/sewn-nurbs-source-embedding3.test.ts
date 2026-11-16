import test from 'node:test';
import {analyzeSewnNurbsSourceContainment3} from '../dist/index.js';
import {certifySewnNurbsSourceMaterial3,querySewnNurbsSourceShellParityAuto3} from '../dist/index.js';
import {locateSewnNurbsSourceMaterial3,algebraicCoordinates3,Polynomial} from '../dist/index.js';
import {intersectSewnNurbsSourceMaterialLine3} from '../dist/index.js';
import {bodyFromNurbsMaterial3,locateBody3,locateBodyFace3,bodyDocument3,serializeBody3,restoreBody3,intersectBodyLine3,intersectBodyRay3,intersectBodyLineMaterial3,booleanMaterialBodies3,splitBodyByPlane3,createBoxBody3,plane3,readNurbsBodyDocument3} from '../dist/index.js';
import type {KernelBody3,NurbsBody3} from '../dist/index.js';
import assert from 'node:assert/strict';
import {certifySewnNurbsSourceEmbedding3,encodeNurbsSourceBRep3,restoreNurbsSourceBRep3,stringifyNurbsSourceBRep3,nurbsSourceComplexFacePointPreimage3,intersectSewnNurbsSourceRay3,intersectSewnNurbsSourceLine3,querySewnNurbsSourceShellParity3,line3,sewNurbsSourceBReps3,sewnNurbsSourceEdgePoint3,buildNurbsSourceBRep3,nurbsSourceBRepEdgePoint3,prepareNurbsSourceFaceComplex3,evaluateNurbsSourceComplexEdge3,certifyNurbsSurfaceTriangularProjection3,evaluateNurbsTriangularSurface3,certifyNurbsSourceFaceEmbedding3,evaluateNurbsSurface3,analyzeNurbsSourceFaceClosedRank3,analyzeNurbsSourceFaceVertexRegularity3,analyzeNurbsSourceFaceBoundaryRegularity3,analyzeNurbsSourceFaceInteriorRegularity3,selectNurbsSourceFacePatches3,liftNurbsSourceFaceBoundaries3,evaluateNurbsSourceLiftPiece3,compareAlgebraicPoints3,locateNurbsSourceFace3,reverseNurbsCurve3,classifyNurbsSourceFaces3,buildNurbsSourceHalfedges3,buildNurbsSourceBoundaryComplex3,matchNurbsIntersectionSourceBoundary3,insertNurbsKnot3,point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,intersectNurbsSurfaceAffineTarget3,trimNurbsAffineIntersection3,sewNurbsAffineIntersection3,refineNurbsAffineIntersectionComplex3,nodeNurbsIntersectionBoundary3,AlgebraicReal,Rational} from '../dist/index.js';
import type {NurbsSurface3,NurbsIntersectionBoundaryNodes3,PreparedNurbsParameterDomain2} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],J=[-1n,-1n,-1n,1n,1n,1n];
function ring(a:string,b:string,c:string,d:string,hole=false){let p=[point3(a,b,0n),point3(c,b,0n),point3(c,d,0n),point3(a,d,0n)];if(hole)p=p.reverse();return p.map((q,i)=>nurbsCurve3(1,[q,p[(i+1)%4]!],K));}
const unit=()=>prepareNurbsParameterDomain2(ring('0','0','1','1'));
const plane=(z='0')=>nurbsSurface3(1,1,[0n,1n].map(u=>[0n,1n].map(v=>point3(u,v,z))),K,K);
function refined(s:NurbsSurface3,t:NurbsSurface3,d:PreparedNurbsParameterDomain2=unit()){const c=certifyNurbsSurfaceAffineProjection3(t);if(c.kind!=='certified')throw Error('Expected certificate');return refineNurbsAffineIntersectionComplex3(sewNurbsAffineIntersection3(trimNurbsAffineIntersection3(intersectNurbsSurfaceAffineTarget3(s,c.certificate),d,unit())));}
function closed(r:NurbsIntersectionBoundaryNodes3){for(const ids of r.rings)for(let i=0;i<ids.length;i++){const a=r.edges[ids[i]!]!,b=r.edges[ids[(i+1)%ids.length]!]!;assert.equal(a.to,b.from);assert.ok(a.lower.compare(a.upper)<0);}for(const [id,v] of r.intersectionVertices.entries())if(v!==null)assert.ok(r.vertices[v]!.intersectionVertices.includes(id));}
function prepared(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const f=classifyNurbsSourceFaces3(buildNurbsSourceHalfedges3(buildNurbsSourceBoundaryComplex3(refined(s,t,d))));assert.equal(f.kind,'classified');return f;}
function lifted(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const r=liftNurbsSourceFaceBoundaries3(prepared(s,t,d));assert.equal(r.kind,'lifted');if(r.kind!=='lifted')throw Error('Expected lift');return r;}
function selected(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const result=selectNurbsSourceFacePatches3(lifted(s,t,d));assert.equal(result.kind,'selected');if(result.kind!=='selected')throw Error('Expected patch selection');return result;}
function analyzed(s:NurbsSurface3,t=plane('1'),d=unit()){const r=analyzeNurbsSourceFaceInteriorRegularity3(selected(s,t,d));assert.equal(r.kind,'analyzed');if(r.kind!=='analyzed')throw Error('Expected regularity analysis');return r;}
const fold=()=>nurbsSurface3(1,2,[0n,1n].map(u=>['1/4','-1/4','1/4'].map(y=>point3(u,y,0n))),K,K2);
function boundary(s:NurbsSurface3,t=plane('1'),d=unit()){const r=analyzeNurbsSourceFaceBoundaryRegularity3(selected(s,t,d));assert.equal(r.kind,'analyzed');if(r.kind!=='analyzed')throw Error('Expected boundary analysis');return r;}
function embedding(s:NurbsSurface3,t=plane('2'),d=unit()){const r=certifyNurbsSourceFaceEmbedding3(selected(s,t,d));assert.equal(r.kind,'analyzed');if(r.kind!=='analyzed')throw Error('Expected embedding analysis');return r;}
function complex(s:NurbsSurface3,t=plane('2'),d=unit()){const r=prepareNurbsSourceFaceComplex3(selected(s,t,d));assert.equal(r.kind,'prepared');if(r.kind!=='prepared')throw Error('Expected prepared complex');return r;}
function sewn(input:Parameters<typeof sewNurbsSourceBReps3>[0]){const r=sewNurbsSourceBReps3(input);assert.equal(r.kind,'sewn');if(r.kind!=='sewn')throw Error('Expected sewn source BReps');return r;}
function cube(nonlinear=false){const K=[0n,0n,1n,1n],F=nonlinear?['0','1/4','1']:['0','1'],frames=[(u:string,v:bigint)=>point3(u,v,0n),(u:string,v:bigint)=>point3(u,v,1n),(u:string,v:bigint)=>point3(u,0n,v),(u:string,v:bigint)=>point3(u,1n,v),(u:string,v:bigint)=>point3(0n,u,v),(u:string,v:bigint)=>point3(1n,u,v)],senses=[-1,1,1,-1,-1,1] as const;return frames.map((p,i)=>buildNurbsSourceBRep3(complex(nurbsSurface3(nonlinear?2:1,1,F.map(u=>[0n,1n].map(v=>p(u,v))),nonlinear?K2:K,K),plane('100')),senses[i]!));}
let cylinderCache:ReturnType<typeof sewn>|undefined;
function cylinder(){if(cylinderCache)return cylinderCache;const xy=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1],[1,0]],weights=[1n,1n,2n,2n,4n,4n,8n,8n,16n],surface=nurbsSurface3(2,1,xy.map(([x,y])=>[point3(BigInt(x!),BigInt(y!),0n),point3(BigInt(x!),BigInt(y!),1n)]),[0n,0n,0n,1n,1n,2n,2n,3n,3n,4n,4n,4n],K,weights.map(w=>[w,w])),walls=[0,1,2,3].map(k=>buildNurbsSourceBRep3(complex(surface,plane('100'),prepareNurbsParameterDomain2(ring(String(k),'0',String(k+1),'1')))));
 const curves=[0,1,2,3].map(k=>nurbsCurve3(2,xy.slice(2*k,2*k+3).map(([x,y])=>point3(new Rational(BigInt(x!)+1n,2n),new Rational(BigInt(y!)+1n,2n),0n)),K2,weights.slice(2*k,2*k+3))),domain=prepareNurbsParameterDomain2(curves),caps=[0n,1n].map(z=>buildNurbsSourceBRep3(complex(nurbsSurface3(1,1,[-1n,1n].map(x=>[-1n,1n].map(y=>point3(x,y,z))),K,K),plane('100'),domain),z===0n?-1:1));cylinderCache=sewn([...walls,...caps]);return cylinderCache;}
test('all distinct face pairs of a nonlinear closed cube have exact separation certificates',()=>{
 const r=sewn(cube(true)),proof=certifySewnNurbsSourceEmbedding3(r);assert.equal(proof.kind,'certified');if(proof.kind==='certified'){assert.equal(proof.certificate.separations.length,15);assert.equal(proof.certificate.source,r);assert.ok(Object.isFrozen(proof.certificate.separations));assert.equal(new Set(proof.certificate.separations.map(p=>p.first+':'+p.second)).size,15);}
});
test('weighted curved cylinder walls and circular caps certify permitted incidence-only contacts',()=>{
 const r=cylinder(),proof=certifySewnNurbsSourceEmbedding3(r);assert.equal(proof.kind,'certified');if(proof.kind==='certified')assert.equal(proof.certificate.separations.length,15);
});
function transformCube(roots:ReturnType<typeof cube>,map:(p:ReturnType<typeof point3>)=>ReturnType<typeof point3>){return roots.map(r=>{const proof=r.complex.embedding.faces[0]!;if(proof.kind!=='certified')throw Error('Expected local proof');const s=proof.certificate.surface,surface=nurbsSurface3(s.degreeU,s.degreeV,s.controlPoints.map(row=>row.map(map)),s.knotsU,s.knotsV,s.weights);return buildNurbsSourceBRep3(complex(surface,plane('100')),r.sense);});}
test('rational oblique/sheared nonlinear faces and a nonplanar curved top retain positive embedding proofs',()=>{
 const two=new Rational(2n),three=new Rational(3n),r=sewn(transformCube(cube(true),p=>point3(p.x.add(p.y).add(p.z.mul(two)).add(three),p.x.mul(two).sub(p.y).add(p.z).sub(new Rational(5n)),p.x.add(p.y.mul(three)).sub(p.z).add(new Rational(7n))))),a=certifySewnNurbsSourceEmbedding3(r);assert.equal(a.kind,'certified');if(a.kind==='certified')assert.equal(a.certificate.separations.length,15);
 const roots=cube(),U=['0','1/2','1'],top=nurbsSurface3(2,2,U.map((u,i)=>U.map((v,j)=>point3(u,v,i===1&&j===1?'5/4':'1'))),K2,K2);roots[1]=buildNurbsSourceBRep3(complex(top,plane('100')));assert.equal(certifySewnNurbsSourceEmbedding3(sewn(roots)).kind,'certified');
});
test('disjoint nested closed shells can certify geometric embedding without assigning material roles',()=>{
 const inner=transformCube(cube(true),p=>point3(p.x.div(new Rational(2n)).add(new Rational(1n,4n)),p.y.div(new Rational(2n)).add(new Rational(1n,4n)),p.z.div(new Rational(2n)).add(new Rational(1n,4n)))),r=sewn([...cube(true),...inner]),q=certifySewnNurbsSourceEmbedding3(r);assert.equal(r.topology.shells.length,2);assert.equal(q.kind,'certified');if(q.kind==='certified'){assert.equal(q.certificate.separations.length,66);assert.ok(!('regions' in q.certificate));}
});
test('closed incidence alone cannot certify interpenetrating cube faces',()=>{
 const shifted=transformCube(cube(),p=>point3(p.x.add(new Rational(1n,2n)),p.y.add(new Rational(1n,2n)),p.z.add(new Rational(1n,2n)))),r=sewn([...cube(),...shifted]);assert.ok(r.topology.closedOrientedIncidence);const q=certifySewnNurbsSourceEmbedding3(r);assert.equal(q.kind,'not-certified');if(q.kind==='not-certified'){assert.equal(q.reason,'no-supported-separation');assert.ok(q.pair);assert.ok(!('certificate' in q));}
});
test('open incidence, vertex-touching shells, unresolved sewing and copied ownership are rejected',()=>{
 const open=sewn([cube()[0]!]),a=certifySewnNurbsSourceEmbedding3(open);assert.equal(a.kind,'not-certified');if(a.kind==='not-certified')assert.equal(a.reason,'open-or-nonmanifold-incidence');const shifted=transformCube(cube(),p=>point3(p.x.add(new Rational(1n)),p.y.add(new Rational(1n)),p.z.add(new Rational(1n)))),touch=sewn([...cube(),...shifted]);assert.ok(touch.topology.closed);assert.equal(touch.topology.manifoldVertices,false);const b=certifySewnNurbsSourceEmbedding3(touch);assert.equal(b.kind,'not-certified');if(b.kind==='not-certified')assert.equal(b.reason,'open-or-nonmanifold-incidence');assert.throws(()=>certifySewnNurbsSourceEmbedding3({...open}),/factory/);
 const U=['0','1/2','1'],B=['1/4','-1/4','1/4'],target=nurbsSurface3(2,2,U.map((u,i)=>U.map((v,j)=>point3(u,v,Rational.parse(B[i]!).add(Rational.parse(B[j]!)).sub(new Rational(1n,16n))))),K2,K2),unknown=sewNurbsSourceBReps3([buildNurbsSourceBRep3(complex(plane(),target))]),c=certifySewnNurbsSourceEmbedding3(unknown);assert.equal(c.kind,'not-certified');if(c.kind==='not-certified')assert.equal(c.reason,'unresolved-sewing');
});
test('partial source-edge sharing and extra sewn vertices cannot falsely cover a whole separator section',()=>{
 const roots=cube(),left=buildNurbsSourceBRep3(complex(plane('1'),plane('100'),prepareNurbsParameterDomain2(ring('0','0','1/2','1')))),right=buildNurbsSourceBRep3(complex(plane('1'),plane('100'),prepareNurbsParameterDomain2(ring('1/2','0','1','1')))),r=sewn([roots[0]!,left,right,...roots.slice(2)]);assert.ok(r.topology.closedOrientedIncidence);assert.equal(r.topology.faces.length,7);assert.ok(r.sourceUses[3]!.some(children=>children.length===2));const q=certifySewnNurbsSourceEmbedding3(r);assert.equal(q.kind,'certified');if(q.kind==='certified'){assert.equal(q.certificate.separations.length,21);const pair=q.certificate.separations.find(p=>p.first===1&&p.second===3)!;assert.ok(pair);assert.ok(pair.normal.x.sign()!==0||pair.normal.y.sign()!==0,'z=1 cannot cover this whole face/edge zero section using only the partial shared interval');}
});
test('triangular octahedron faces certify shared-vertex-only contacts and trim-aware halfspaces',()=>{
 const triangle=prepareNurbsParameterDomain2([nurbsCurve3(1,[point3(0n,0n,0n),point3(1n,0n,0n)],K),nurbsCurve3(1,[point3(1n,0n,0n),point3(0n,1n,0n)],K),nurbsCurve3(1,[point3(0n,1n,0n),point3(0n,0n,0n)],K)]),roots=[];
 for(const x of [-1n,1n])for(const y of [-1n,1n])for(const z of [-1n,1n]){const a=point3(x,0n,0n),b=point3(0n,y,0n),c=point3(0n,0n,z),source=nurbsSurface3(1,1,[[a,c],[b,point3(-x,y,z)]],K,K);roots.push(buildNurbsSourceBRep3(complex(source,plane('100'),triangle),x*y*z>0n?1:-1));}
 const r=sewn(roots);assert.ok(r.topology.closedOrientedIncidence);assert.equal(r.topology.faces.length,8);assert.equal(r.topology.vertices.length,6);assert.equal(r.topology.edges.length,12);const q=certifySewnNurbsSourceEmbedding3(r);assert.equal(q.kind,'certified');if(q.kind==='certified')assert.equal(q.certificate.separations.length,28);
});

function containmentOf(r:ReturnType<typeof sewn>){const proof=certifySewnNurbsSourceEmbedding3(r);assert.equal(proof.kind,'certified');if(proof.kind!=='certified')throw Error('Expected global embedding');const q=analyzeSewnNurbsSourceContainment3(proof.certificate);assert.equal(q.kind,'analyzed');if(q.kind!=='analyzed')throw Error('Expected containment');return q.certificate;}
test('certified containment builds three-level shell ancestry independent of input order',()=>{
 const scaled=(scale:string,shift:string)=>transformCube(cube(true),p=>{const f=(v:Rational)=>v.mul(Rational.parse(scale)).add(Rational.parse(shift));return point3(f(p.x),f(p.y),f(p.z));});
 const r=sewn([...scaled('1/4','3/8'),...cube(true),...scaled('1/2','1/4')]),c=containmentOf(r),shellOf=(face:number)=>r.topology.faces[face]!.shell;
 const island=shellOf(0),outer=shellOf(6),cavity=shellOf(12);
 assert.deepEqual(c.shells.map(s=>s.depth),r.topology.shells.map((_,i)=>i===outer?0:i===cavity?1:2));
 assert.equal(c.shells[island]!.parent,cavity);assert.equal(c.shells[cavity]!.parent,outer);assert.equal(c.shells[outer]!.parent,null);
 assert.deepEqual(c.shells.map(s=>s.expectedOrientation),r.topology.shells.map((_,i)=>i===cavity?-1:1));
 assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.shells)&&Object.isFrozen(c.shells[island]!.containers));
 const p=c.shells[island]!.sample,limited=analyzeSewnNurbsSourceContainment3(c.embedding,{maxDirections:1,directions:[point3(p.x.neg(),p.y.neg(),p.z.neg())]});
 assert.equal(limited.kind,'unresolved');if(limited.kind==='unresolved'){assert.equal(limited.reason,'parity');assert.equal(limited.query?.kind,'unresolved');if(limited.query?.kind==='unresolved')assert.equal(limited.query.reason,'ray-budget');}
});
test('disjoint shells remain separate forest roots even when one orientation is reversed',()=>{
 const a=cube(),b=transformCube(cube(true),p=>point3(p.x.add(new Rational(3n)),p.y,p.z)).map(r=>buildNurbsSourceBRep3(r.complex,r.sense===1?-1:1)),c=containmentOf(sewn([...a,...b]));
 assert.equal(c.shells.length,2);for(const shell of c.shells){assert.equal(shell.depth,0);assert.equal(shell.parent,null);assert.deepEqual(shell.containers,[]);assert.equal(shell.expectedOrientation,1);}
});
test('curved weighted cylinder is a single root and copied embedding certificates are rejected',()=>{
 const r=cylinder(),c=containmentOf(r);assert.equal(c.shells.length,1);assert.equal(c.shells[0]!.depth,0);
 const proof=certifySewnNurbsSourceEmbedding3(r);if(proof.kind!=='certified')throw Error('Expected embedding');assert.throws(()=>analyzeSewnNurbsSourceContainment3({...proof.certificate}),/factory/);
});

test('material orientation uses exact transverse enter/exit events and rational interior witnesses',()=>{
 for(const r of [sewn(cube(true)),cylinder()]){const c=containmentOf(r),q=certifySewnNurbsSourceMaterial3(c);assert.equal(q.kind,'certified');if(q.kind==='certified')for(const o of q.certificate.orientations){assert.equal(o.orientation,1);assert.equal(o.ray.kind,'regular');const inside=querySewnNurbsSourceShellParityAuto3(r,o.shell,o.interiorWitness),outside=querySewnNurbsSourceShellParityAuto3(r,o.shell,o.exteriorWitness);assert.equal(inside.kind,'parity');if(inside.kind==='parity')assert.equal(inside.parity,'odd');assert.equal(outside.kind,'parity');if(outside.kind==='parity')assert.equal(outside.parity,'even');}}
});
test('nested material boundaries require inward cavity and outward island orientations',()=>{
 const scaled=(scale:string,shift:string,reverse=false)=>transformCube(cube(true),p=>{const f=(v:Rational)=>v.mul(Rational.parse(scale)).add(Rational.parse(shift));return point3(f(p.x),f(p.y),f(p.z));}).map(r=>reverse?buildNurbsSourceBRep3(r.complex,r.sense===1?-1:1):r);
 const cavity=scaled('1/2','1/4',true),r=sewn([...cube(true),...cavity,...scaled('1/4','3/8')]),q=certifySewnNurbsSourceMaterial3(containmentOf(r));assert.equal(q.kind,'certified');if(q.kind==='certified'){assert.deepEqual(q.certificate.orientations.map(o=>o.orientation),[1,-1,1]);assert.ok(Object.isFrozen(q.certificate)&&Object.isFrozen(q.certificate.orientations));}
 const bad=certifySewnNurbsSourceMaterial3(containmentOf(sewn([...cube(),...scaled('1/2','1/4')])));assert.equal(bad.kind,'orientation-mismatch');if(bad.kind==='orientation-mismatch'){assert.equal(bad.shells.length,1);assert.equal(bad.orientations[bad.shells[0]!]!.expectedOrientation,-1);}
});
test('reversed exterior orientation, budgets and copied containment are handled explicitly',()=>{
 const roots=cube(),r=sewn(roots.map(r=>buildNurbsSourceBRep3(r.complex,r.sense===1?-1:1))),c=containmentOf(r),q=certifySewnNurbsSourceMaterial3(c);assert.equal(q.kind,'orientation-mismatch');if(q.kind==='orientation-mismatch')assert.equal(q.orientations[0]!.orientation,-1);
 const limited=certifySewnNurbsSourceMaterial3(c,{maxDirections:1,directions:[point3(-1n,0n,0n)]});assert.deepEqual(limited,{kind:'unresolved',reason:'ray-budget',shell:0,attempts:1});
 assert.throws(()=>certifySewnNurbsSourceMaterial3({...c}),/factory/);for(const maxDirections of [0,NaN,1.5])assert.throws(()=>certifySewnNurbsSourceMaterial3(c,{maxDirections}),/positive safe integer/);
});

function materialOf(r:ReturnType<typeof sewn>){const q=certifySewnNurbsSourceMaterial3(containmentOf(r));assert.equal(q.kind,'certified');if(q.kind!=='certified')throw Error('Expected material boundary');return q.certificate;}
test('empty certified NURBS material is an empty common Body after replay',()=>{
 const body=bodyFromNurbsMaterial3(materialOf(sewn([]))),restored=restoreBody3(serializeBody3(body));assert.equal(restored.kind,'nurbs-body');assert.equal(restored.regions.length,0);assert.equal(restored.interiorSamples.length,0);assert.equal(locateBody3(restored,point3(0n,0n,0n)),'outside');const q=intersectBodyLineMaterial3(restored,point3(0n,0n,0n),point3(1n,0n,0n));assert.equal(q.kind,'resolved');if(q.kind==='resolved'){assert.equal(q.intervals.length,0);assert.equal(q.isolated.length,0);}
});
test('material membership distinguishes exterior, solid, cavity, island and closed boundaries',()=>{
 const scaled=(scale:string,shift:string,reverse=false)=>transformCube(cube(true),p=>{const f=(v:Rational)=>v.mul(Rational.parse(scale)).add(Rational.parse(shift));return point3(f(p.x),f(p.y),f(p.z));}).map(r=>reverse?buildNurbsSourceBRep3(r.complex,r.sense===1?-1:1):r);
 const m=materialOf(sewn([...cube(true),...scaled('1/2','1/4',true),...scaled('1/4','3/8')]));
 for(const [x,expected,count] of [['2','outside',0],['1/8','inside',1],['1/3','outside',2],['1/2','inside',3]] as const){const q=locateSewnNurbsSourceMaterial3(m,point3(x,'1/2','1/2'));assert.equal(q.kind,expected);if(q.kind==='inside'||q.kind==='outside'){assert.equal(q.containingShells.length,count);assert.equal(q.deepestShell,count? q.containingShells[count-1]:null);assert.ok(Object.isFrozen(q.enclosure));}}
 for(const x of ['0','1/4','3/8']){const q=locateSewnNurbsSourceMaterial3(m,point3(x,'1/2','1/2'));assert.equal(q.kind,'boundary');if(q.kind==='boundary'){assert.equal(q.faces.length,1);assert.equal(q.shells.length,1);}}
 assert.throws(()=>locateSewnNurbsSourceMaterial3({...m},point3(0n,0n,0n)),/factory/);
});
test('algebraic membership proves a boundary-free box before replacing a point by a rational witness',()=>{
 const m=materialOf(sewn(cube(true))),root=AlgebraicReal.isolate(new Polynomial([-2n,0n,1n])).find(q=>q.sign()>0)!,a=root.affine('1/2');
 for(const [x,kind] of [[a,'inside'],[root,'outside']] as const){const p=algebraicCoordinates3(x,a,'1/2'),q=locateSewnNurbsSourceMaterial3(m,p);assert.equal(q.kind,kind);if(q.kind==='inside'||q.kind==='outside'){assert.ok(x.compare(AlgebraicReal.fromRational(q.enclosure.lower.x))>=0&&x.compare(AlgebraicReal.fromRational(q.enclosure.upper.x))<=0);assert.equal(locateSewnNurbsSourceMaterial3(m,q.rationalWitness).kind,kind);if(kind==='inside'){assert.ok(q.enclosure.lower.x.sign()>0);assert.ok(q.enclosure.upper.x.compare(new Rational(1n))<0);}}}
 assert.equal(locateSewnNurbsSourceMaterial3(m,algebraicCoordinates3(0n,a,'1/2')).kind,'boundary');
});
test('weighted curved material queries retain exact algebraic wall membership',()=>{
 const m=materialOf(cylinder()),root=AlgebraicReal.isolate(new Polynomial([-2n,0n,1n])).find(q=>q.sign()>0)!,a=root.affine('1/2');
 assert.equal(locateSewnNurbsSourceMaterial3(m,algebraicCoordinates3(a,a,'1/2')).kind,'boundary');
 assert.equal(locateSewnNurbsSourceMaterial3(m,algebraicCoordinates3(a,0n,'1/2')).kind,'inside');
 assert.equal(locateSewnNurbsSourceMaterial3(m,algebraicCoordinates3(root,0n,'1/2')).kind,'outside');
 const q=locateSewnNurbsSourceMaterial3(m,point3(0n,0n,'1/2'),{maxDirections:1,directions:[point3(1n,0n,0n)]});assert.equal(q.kind,'unresolved');if(q.kind==='unresolved'){assert.equal(q.reason,'parity');if(q.query?.kind==='unresolved')assert.equal(q.query.reason,'ray-budget');}
});

test('material line intervals preserve closed bounds under origin translation and direction reversal',()=>{
 const m=materialOf(sewn(cube(true)));
 for(const [origin,direction,expected] of [[point3('-1','1/2','1/2'),point3(1n,0n,0n),['1','2']],[point3('2','1/2','1/2'),point3(-2n,0n,0n),['1/2','1']]] as const){const q=intersectSewnNurbsSourceMaterialLine3(m,line3(origin,direction));assert.equal(q.kind,'resolved');if(q.kind==='resolved'){assert.equal(q.intervals.length,1);assert.equal(q.isolated.length,0);assert.deepEqual([q.intervals[0]!.start.parameter,q.intervals[0]!.end.parameter].map(t=>t.recognizeRational().rational?.toString()),expected);for(const span of q.intervals[0]!.spans){assert.equal(span.location,'inside');assert.equal(locateSewnNurbsSourceMaterial3(m,span.sample).kind,'inside');}assert.ok(Object.isFrozen(q.intervals[0]!.spans));}}
 const miss=intersectSewnNurbsSourceMaterialLine3(m,line3(point3(0n,2n,2n),point3(1n,0n,0n)));assert.equal(miss.kind,'resolved');if(miss.kind==='resolved'){assert.equal(miss.intervals.length,0);assert.equal(miss.isolated.length,0);}
 assert.throws(()=>intersectSewnNurbsSourceMaterialLine3({...m},line3(point3(0n,0n,0n),point3(1n,0n,0n))),/factory/);
 assert.throws(()=>intersectSewnNurbsSourceMaterialLine3(m,{origin:point3(0n,0n,0n),direction:point3(0n,0n,0n)}),/nonzero/);
});
test('material line scan keeps cavity gaps and separate material islands',()=>{
 const scaled=(scale:string,shift:string,reverse=false)=>transformCube(cube(true),p=>{const f=(v:Rational)=>v.mul(Rational.parse(scale)).add(Rational.parse(shift));return point3(f(p.x),f(p.y),f(p.z));}).map(r=>reverse?buildNurbsSourceBRep3(r.complex,r.sense===1?-1:1):r);
 const m=materialOf(sewn([...cube(true),...scaled('1/2','1/4',true),...scaled('1/4','3/8')])),q=intersectSewnNurbsSourceMaterialLine3(m,line3(point3(0n,'1/2','1/2'),point3(1n,0n,0n)));
 assert.equal(q.kind,'resolved');if(q.kind==='resolved'){assert.equal(q.boundary.kind,'degenerate');assert.deepEqual(q.intervals.map(i=>[i.start.parameter,i.end.parameter].map(t=>t.recognizeRational().rational?.toString())),[['0','1/4'],['3/8','5/8'],['3/4','1']]);assert.equal(q.isolated.length,0);}
 const alongCavity=intersectSewnNurbsSourceMaterialLine3(m,line3(point3(-1n,'1/4','1/2'),point3(1n,0n,0n)));assert.equal(alongCavity.kind,'resolved');if(alongCavity.kind==='resolved'){assert.equal(alongCavity.intervals.length,1);assert.deepEqual(alongCavity.intervals[0]!.spans.map(s=>s.location),['inside','boundary','inside']);assert.deepEqual([alongCavity.intervals[0]!.start.parameter,alongCavity.intervals[0]!.end.parameter].map(t=>t.recognizeRational().rational?.toString()),['1','2']);}
});
test('curved line scan keeps algebraic endpoints, seam crossings, tangency and boundary overlaps',()=>{
 const m=materialOf(cylinder());
 const curved=intersectSewnNurbsSourceMaterialLine3(m,line3(point3(0n,'1/2','1/2'),point3(1n,0n,0n)));assert.equal(curved.kind,'resolved');if(curved.kind==='resolved'){assert.equal(curved.intervals.length,1);for(const t of [curved.intervals[0]!.start.parameter,curved.intervals[0]!.end.parameter]){assert.equal(t.recognizeRational().rational,null);assert.equal(t.mul(t).compare(AlgebraicReal.fromRational('3/4')),0);}}
 const seam=intersectSewnNurbsSourceMaterialLine3(m,line3(point3(0n,0n,'1/2'),point3(1n,0n,0n)));assert.equal(seam.kind,'resolved');if(seam.kind==='resolved'){assert.equal(seam.boundary.kind,'degenerate');assert.equal(seam.intervals.length,1);assert.equal(seam.intervals[0]!.spans[0]!.location,'inside');}
 const tangent=intersectSewnNurbsSourceMaterialLine3(m,line3(point3(0n,1n,'1/2'),point3(1n,0n,0n)));assert.equal(tangent.kind,'resolved');if(tangent.kind==='resolved'){assert.equal(tangent.intervals.length,0);assert.equal(tangent.isolated.length,1);assert.equal(tangent.isolated[0]!.parameter.sign(),0);}
 const overlap=intersectSewnNurbsSourceMaterialLine3(m,line3(point3(1n,0n,-1n),point3(0n,0n,1n)));assert.equal(overlap.kind,'resolved');if(overlap.kind==='resolved'){assert.equal(overlap.intervals.length,1);assert.equal(overlap.isolated.length,0);assert.ok(overlap.intervals[0]!.spans.every(s=>s.location==='boundary'));assert.deepEqual([overlap.intervals[0]!.start.parameter,overlap.intervals[0]!.end.parameter].map(t=>t.recognizeRational().rational?.toString()),['1','2']);}
 const limited=intersectSewnNurbsSourceMaterialLine3(m,line3(point3(0n,0n,'1/2'),point3(1n,0n,0n)),{maxDirections:1});assert.equal(limited.kind,'unresolved');if(limited.kind==='unresolved')assert.equal(limited.reason,'material-query');
});

test('NURBS material enters common Body point, bounded-face, line and ray dispatch',()=>{
 const body=bodyFromNurbsMaterial3(materialOf(sewn(cube(true)))),common:KernelBody3=body;
 assert.equal(body.kind,'nurbs-body');assert.equal(body.regions.length,1);assert.equal(body.faces.length,6);assert.equal(locateBody3(common,point3('1/2','1/2','1/2')),'inside');assert.equal(locateBody3(common,point3(2n,0n,0n)),'outside');assert.equal(locateBody3(common,point3(0n,0n,0n)),'boundary');
 assert.equal(locateBodyFace3(body,0,point3('1/2','1/2',0n)),'inside');assert.equal(locateBodyFace3(body,0,point3(0n,'1/2',0n)),'boundary');assert.equal(locateBodyFace3(body,0,point3(2n,'1/2',0n)),'outside');
 const line=intersectBodyLine3(body,point3('1/2','1/2','1/2'),point3(1n,0n,0n)),ray=intersectBodyRay3(body,point3('1/2','1/2','1/2'),point3(1n,0n,0n)),material=intersectBodyLineMaterial3(body,point3('1/2','1/2','1/2'),point3(1n,0n,0n));assert.equal(line.kind,'regular');assert.equal(line.hits.length,2);assert.equal(ray.kind,'regular');assert.equal(ray.hits.length,1);assert.equal(material.kind,'resolved');if(material.kind==='resolved')assert.equal(material.intervals.length,1);
 assert.ok(Object.isFrozen(body)&&Object.isFrozen(body.regions)&&Object.isFrozen(body.interiorSamples));assert.throws(()=>locateBodyFace3(body,99,point3(0n,0n,0n)),/face index/);assert.throws(()=>locateBody3({...body},point3(0n,0n,0n)),/factory/);
});
test('common NURBS Body persistence replays weighted curved source recipes and geometric certification',()=>{
 const body=bodyFromNurbsMaterial3(materialOf(cylinder())),document=bodyDocument3(body),text=serializeBody3(body),restored:NurbsBody3=restoreBody3(text);
 assert.equal(document.kind,'nurbs-body-document');assert.equal(document.sources.length,6);assert.equal(restored.kind,'nurbs-body');assert.equal(restored.topology.closedOrientedIncidence,true);assert.equal(serializeBody3(restored),text);
 for(const p of [point3(0n,0n,'1/2'),point3(1n,0n,'1/2'),point3(2n,0n,'1/2')])assert.equal(locateBody3(restored,p),locateBody3(body,p));
 const root=AlgebraicReal.isolate(new Polynomial([-2n,0n,1n])).find(q=>q.sign()>0)!.affine('1/2');assert.equal(locateBody3(restored,algebraicCoordinates3(root,root,'1/2')),'boundary');
 const scan=intersectBodyLineMaterial3(restored,point3(0n,1n,'1/2'),point3(1n,0n,0n));assert.equal(scan.kind,'resolved');if(scan.kind==='resolved')assert.equal(scan.isolated.length,1);
 assert.throws(()=>restoreBody3(text,{maxChars:10}),/text budget/);assert.throws(()=>restoreBody3(document,{maxItems:10}),/budget/);assert.throws(()=>readNurbsBodyDocument3({...document,certified:true}),/unknown field/);
 const reversed={...document,sources:document.sources.map(s=>({...s,sense:-s.sense}))};assert.throws(()=>restoreBody3(reversed),/material not certified/);
});
test('common NURBS Body derives material-region samples outside cavities and reconstructs material islands',()=>{
 const scaled=(scale:string,shift:string,reverse=false)=>transformCube(cube(true),p=>{const f=(v:Rational)=>v.mul(Rational.parse(scale)).add(Rational.parse(shift));return point3(f(p.x),f(p.y),f(p.z));}).map(r=>reverse?buildNurbsSourceBRep3(r.complex,r.sense===1?-1:1):r);
 const material=materialOf(sewn([...cube(true),...scaled('1/2','1/4',true),...scaled('1/4','3/8')])),body=bodyFromNurbsMaterial3(material);
 assert.equal(body.regions.length,2);assert.deepEqual(body.regions.map(r=>r.cavities.length),[1,0]);for(const region of body.regions){const q=locateSewnNurbsSourceMaterial3(material,region.sample);assert.equal(q.kind,'inside');if(q.kind==='inside')assert.equal(q.deepestShell,region.shell);}
 const restored=restoreBody3(serializeBody3(body));assert.equal(restored.regions.length,2);for(const x of ['1/8','1/3','1/2'])assert.equal(locateBody3(restored,point3(x,'1/2','1/2')),locateBody3(body,point3(x,'1/2','1/2')));
 const box=createBoxBody3(point3(0n,0n,0n),1n,1n,1n);assert.throws(()=>booleanMaterialBodies3(body,box,'union'),/NURBS Body Boolean/);assert.throws(()=>booleanMaterialBodies3(box,body,'difference'),/NURBS Body Boolean/);assert.throws(()=>splitBodyByPlane3(body,plane3(1n,0n,0n,'-1/2')),/NURBS Body plane splitting/);
});
