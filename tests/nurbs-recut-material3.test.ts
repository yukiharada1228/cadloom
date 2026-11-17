import {locateNurbsRecutMaterial3,certifyNurbsRecutMaterial3} from '../dist/index.js';
import {assertOwnedNurbsRecutMaterial3} from '../dist/geometry/nurbs-recut-material3.js';
import {analyzeNurbsRecutContainment3} from '../dist/index.js';
import {assertOwnedNurbsRecutContainment3} from '../dist/geometry/nurbs-recut-containment3.js';
import {intersectNurbsRecutLine3,intersectNurbsRecutRay3,queryNurbsRecutShellParity3,queryNurbsRecutShellParityAuto3} from '../dist/index.js';
import {certifyNurbsRecutEmbedding3,certifyNurbsRecutOldCapContacts3} from '../dist/index.js';
import {assertOwnedNurbsRecutEmbedding3,assertOwnedNurbsRecutOldCapContactCertificate3} from '../dist/geometry/nurbs-recut-embedding3.js';
import {analyzeNurbsRecutSourceCapVertices3,certifyNurbsRecutSourceCapContacts3} from '../dist/index.js';
import {nurbsRecutJoinedCurveContainsPoint3,assertOwnedNurbsRecutSourceCapContactCertificate3} from '../dist/geometry/nurbs-recut-source-cap-contact-gate3.js';
import {analyzeNurbsRecutBoundaryZeroArcs3,nurbsRecutBoundaryZeroArcPoint3} from '../dist/index.js';
import {inspectNurbsRecutSourceCapContacts3} from '../dist/index.js';
import {capNurbsRecutHalf3,locateNurbsRecutClosedSurface3,nurbsRecutNewCapPoint3} from '../dist/index.js';
import {certifyCappedNurbsPlaneEmbedding3,certifyNurbsRecutAssemblyEmbedding3,analyzeNurbsRecutCapDomains3,locateNurbsRecutCapFace3} from '../dist/index.js';
import {queryNurbsRecutCapWinding3,queryNurbsRecutCapLoopWinding3,partitionNurbsRecutCurveByAlgebraicPlane3} from '../dist/index.js';
import {selectNurbsRecutHalfBoundary3,nurbsRecutHalfCapBoundary3,nurbsRecutHalfCapBoundaryPoint3} from '../dist/index.js';
import {joinNurbsRecutAssembly3} from '../dist/index.js';
import {sewNurbsRecutSourceFaces3} from '../dist/index.js';
import {joinNurbsRecutSourceCaps3,nurbsRecutJoinedCurvePoint3,locateNurbsRecutJoinedSurface3} from '../dist/index.js';
import {alignNurbsRecutCapEdges3} from '../dist/index.js';
import {coverNurbsRecutSectionEdges3} from '../dist/index.js';
import {matchNurbsRecutSectionEdge3,nurbsRecutEdgeMatchPoint3} from '../dist/index.js';
import {partitionNurbsSplitFaceByPlane3,nurbsSourcePlaneCellPoint3,nurbsSourcePlaneCellBoundary3,nurbsSourcePlaneCellBoundaryPoint3,locateNurbsPlaneSplitFaceParameters3} from '../dist/index.js';
import {buildNurbsCapSplitFaces3,locateNurbsCapSplitSurface3,nurbsCapSplitSurfacePoint3} from '../dist/index.js';
import {queryNurbsCapSplitLoopWinding3,analyzeNurbsCapSplitDomains3,locateNurbsCapSplitFace3} from '../dist/index.js';
import {splitNurbsPlaneCapBoundaries3,nurbsCapSplitBoundaryPoint3} from '../dist/index.js';
import {intersectNurbsPlaneCapFacePlane3} from '../dist/index.js';
import {capNurbsPlaneSplitFaces3,locateNurbsPlaneCapFace3,nurbsPlaneCapFacePoint3} from '../dist/index.js';
import {analyzeNurbsPlaneCapContainment3,queryNurbsPlaneCapLoopWinding3} from '../dist/index.js';
import {partitionSewnNurbsSplitEdgeByAlgebraicPlane3,algebraicCoordinates2} from '../dist/index.js';
import {partitionSewnNurbsSplitEdgeByPlane3,queryNurbsPlaneCapWinding3} from '../dist/index.js';
import {nurbsPlaneCapBoundary3,nurbsPlaneCapBoundaryPoint3} from '../dist/index.js';
import {sewNurbsPlaneSplitFaces3,sewnNurbsPlaneSplitEdgePoint3} from '../dist/index.js';
import {buildNurbsPlaneSplitFaces3,nurbsPlaneSplitFaceEdgePoint3} from '../dist/index.js';
import {nodeNurbsPlaneCellSourceEdges3,nurbsSpanIntervalMatchParameters3,matchNurbsSpanIntervals3} from '../dist/index.js';
import {matchNurbsPlaneCellSourceEdges3,nurbsSpanIntervalMatchPoint3,nurbsSourcePlaneCellComplexEdgePoint3} from '../dist/index.js';
import {refineNurbsSourcePlaneEdgeParameters3,refineNurbsPlaneCellSourceVertices3} from '../dist/index.js';
import {nurbsBoundaryCoordinateRoots3} from '../dist/geometry/nurbs-intersection-boundary-nodes3.js';
import {nurbsSourcePlaneEdgeFragmentPointPreimages3,partitionNurbsSourceFaceByPlane3,buildNurbsSourcePlaneCellComplex3,matchNurbsPlaneCellSourceVertices3} from '../dist/index.js';
import {refineSewnNurbsSourceEdgesByPlane3,nurbsSourcePlaneEdgeFragmentPoint3} from '../dist/index.js';
import {nurbsPlaneDomain3,locateNurbsPlaneDomain3,nurbsPlaneDomainEdgePoint3,pointInPlaneFrame3,mapPlanePoint3,dot3,cross3,point2} from '../dist/index.js';
import {certifyNurbsBoundaryPlaneWires3} from '../dist/index.js';
import {intersectSewnNurbsSourceBoundaryPlane3,nurbsBoundaryPlaneEdgePoint3,intersectNurbsBodyBoundaryPlane3} from '../dist/index.js';
import test from 'node:test';
import {analyzeSewnNurbsSourceContainment3} from '../dist/index.js';
import {certifySewnNurbsSourceMaterial3,querySewnNurbsSourceShellParityAuto3} from '../dist/index.js';
import {locateSewnNurbsSourceMaterial3,algebraicCoordinates3,Polynomial} from '../dist/index.js';
import {intersectSewnNurbsSourceMaterialLine3} from '../dist/index.js';
import {bodyFromNurbsMaterial3,locateBody3,locateBodyFace3,bodyDocument3,serializeBody3,restoreBody3,intersectBodyLine3,intersectBodyRay3,intersectBodyLineMaterial3,booleanMaterialBodies3,splitBodyByPlane3,createBoxBody3,plane3,readNurbsBodyDocument3} from '../dist/index.js';
import type {KernelBody3,NurbsBody3} from '../dist/index.js';
import {transformBody3,similarityTransform3,transformPointBySimilarity3,transformVectorBySimilarity3,inverseSimilarityTransform3,composeSimilarityTransforms3} from '../dist/index.js';
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
function boundary(s:NurbsSurface3,t=plane('1'),d=unit()){const r=analyzeNurbsSourceFaceBoundaryRegularity3(selected(s,t,d));assert.equal(r.kind,'analyzed');if(r.kind!=='analyzed')throw Error('Expected boundary analysis');return r;}
function embedding(s:NurbsSurface3,t=plane('2'),d=unit()){const r=certifyNurbsSourceFaceEmbedding3(selected(s,t,d));assert.equal(r.kind,'analyzed');if(r.kind!=='analyzed')throw Error('Expected embedding analysis');return r;}
function complex(s:NurbsSurface3,t=plane('2'),d=unit()){const r=prepareNurbsSourceFaceComplex3(selected(s,t,d));assert.equal(r.kind,'prepared');if(r.kind!=='prepared')throw Error('Expected prepared complex');return r;}
function sewn(input:Parameters<typeof sewNurbsSourceBReps3>[0]){const r=sewNurbsSourceBReps3(input);assert.equal(r.kind,'sewn');if(r.kind!=='sewn')throw Error('Expected sewn source BReps');return r;}
function cube(nonlinear=false){const K=[0n,0n,1n,1n],F=nonlinear?['0','1/4','1']:['0','1'],frames=[(u:string,v:bigint)=>point3(u,v,0n),(u:string,v:bigint)=>point3(u,v,1n),(u:string,v:bigint)=>point3(u,0n,v),(u:string,v:bigint)=>point3(u,1n,v),(u:string,v:bigint)=>point3(0n,u,v),(u:string,v:bigint)=>point3(1n,u,v)],senses=[-1,1,1,-1,-1,1] as const;return frames.map((p,i)=>buildNurbsSourceBRep3(complex(nurbsSurface3(nonlinear?2:1,1,F.map(u=>[0n,1n].map(v=>p(u,v))),nonlinear?K2:K,K),plane('100')),senses[i]!));}
let cylinderCache:ReturnType<typeof sewn>|undefined;
function cylinder(){if(cylinderCache)return cylinderCache;const xy=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1],[1,0]],weights=[1n,1n,2n,2n,4n,4n,8n,8n,16n],surface=nurbsSurface3(2,1,xy.map(([x,y])=>[point3(BigInt(x!),BigInt(y!),0n),point3(BigInt(x!),BigInt(y!),1n)]),[0n,0n,0n,1n,1n,2n,2n,3n,3n,4n,4n,4n],K,weights.map(w=>[w,w])),walls=[0,1,2,3].map(k=>buildNurbsSourceBRep3(complex(surface,plane('100'),prepareNurbsParameterDomain2(ring(String(k),'0',String(k+1),'1')))));
 const curves=[0,1,2,3].map(k=>nurbsCurve3(2,xy.slice(2*k,2*k+3).map(([x,y])=>point3(new Rational(BigInt(x!)+1n,2n),new Rational(BigInt(y!)+1n,2n),0n)),K2,weights.slice(2*k,2*k+3))),domain=prepareNurbsParameterDomain2(curves),caps=[0n,1n].map(z=>buildNurbsSourceBRep3(complex(nurbsSurface3(1,1,[-1n,1n].map(x=>[-1n,1n].map(y=>point3(x,y,z))),K,K),plane('100'),domain),z===0n?-1:1));cylinderCache=sewn([...walls,...caps]);return cylinderCache;}
function transformCube(roots:ReturnType<typeof cube>,map:(p:ReturnType<typeof point3>)=>ReturnType<typeof point3>){return roots.map(r=>{const proof=r.complex.embedding.faces[0]!;if(proof.kind!=='certified')throw Error('Expected local proof');const s=proof.certificate.surface,surface=nurbsSurface3(s.degreeU,s.degreeV,s.controlPoints.map(row=>row.map(map)),s.knotsU,s.knotsV,s.weights);return buildNurbsSourceBRep3(complex(surface,plane('100')),r.sense);});}
function containmentOf(r:ReturnType<typeof sewn>){const proof=certifySewnNurbsSourceEmbedding3(r);assert.equal(proof.kind,'certified');if(proof.kind!=='certified')throw Error('Expected global embedding');const q=analyzeSewnNurbsSourceContainment3(proof.certificate);assert.equal(q.kind,'analyzed');if(q.kind!=='analyzed')throw Error('Expected containment');return q.certificate;}
function materialOf(r:ReturnType<typeof sewn>){const q=certifySewnNurbsSourceMaterial3(containmentOf(r));assert.equal(q.kind,'certified');if(q.kind!=='certified')throw Error('Expected material boundary');return q.certificate;}
function sewnFaces(r:ReturnType<typeof sewNurbsPlaneSplitFaces3>){assert.equal(r.kind,'sewn');if(r.kind!=='sewn')throw Error('Expected sewn split faces');return r;}
function parts(source:ReturnType<typeof refineSewnNurbsSourceEdgesByPlane3>){return source.topology.faces.map((f,face)=>{const cells=buildNurbsSourcePlaneCellComplex3(partitionNurbsSourceFaceByPlane3(f.surface.source.complex,f.surface.face,source.plane));return buildNurbsPlaneSplitFaces3(nodeNurbsPlaneCellSourceEdges3(matchNurbsPlaneCellSourceEdges3(source,face,cells)));});}
function cap(source:Parameters<typeof nurbsPlaneCapBoundary3>[0]){const r=nurbsPlaneCapBoundary3(source);assert.equal(r.kind,'certified');if(r.kind!=='certified')throw Error('Expected cap boundary');return r.certificate;}
function containment(boundary:ReturnType<typeof cap>,material:ReturnType<typeof materialOf>,options={}){const q=analyzeNurbsPlaneCapContainment3(boundary,material,options);assert.equal(q.kind,'analyzed');if(q.kind!=='analyzed')throw Error('Expected cap containment');return q.certificate;}
function capped(r:ReturnType<typeof containment>){const q=capNurbsPlaneSplitFaces3(r);assert.equal(q.kind,'closed');if(q.kind!=='closed')throw Error('Expected closed capped incidence');return q;}
function previous(raw:ReturnType<typeof sewn>,p:ReturnType<typeof plane3>,sourceFace:number,side:1|-1=1){const R=refineSewnNurbsSourceEdgesByPlane3(raw,p),T=sewnFaces(sewNurbsPlaneSplitFaces3(R,parts(R),side)).topology,f=T.faces.find(f=>f.surface.sourceFace===sourceFace);if(!f)throw Error('Expected retained finite face');return f.surface;}
function repartition(s:Parameters<typeof partitionNurbsSplitFaceByPlane3>[0],p:ReturnType<typeof plane3>){const r=partitionNurbsSplitFaceByPlane3(s,p);assert.equal(r.kind,'partitioned');if(r.kind!=='partitioned')throw Error('Expected recut cells');return r;}
function recutAssembly(raw:ReturnType<typeof sewn>,oldPlane:ReturnType<typeof plane3>,nextPlane:ReturnType<typeof plane3>){const oldR=refineSewnNurbsSourceEdgesByPlane3(raw,oldPlane),old=sewnFaces(sewNurbsPlaneSplitFaces3(oldR,parts(oldR),1)),R=refineSewnNurbsSourceEdgesByPlane3(raw,nextPlane),inputs=old.topology.faces.map(f=>{const C=buildNurbsSourcePlaneCellComplex3(repartition(f.surface,nextPlane));return buildNurbsPlaneSplitFaces3(nodeNurbsPlaneCellSourceEdges3(matchNurbsPlaneCellSourceEdges3(R,f.surface.sourceFace,C)));});return {old,oldR,R,inputs};}
function whole(raw:ReturnType<typeof sewn>,p:ReturnType<typeof plane3>,next:ReturnType<typeof plane3>,reverseCap=false){const q=recutAssembly(raw,p,next),source=sewnFaces(sewNurbsRecutSourceFaces3(q.old,q.R,q.inputs)),closed=capped(containment(cap(q.old),materialOf(raw))),capReports=closed.capFaces.map(id=>{const s=closed.topology.faces[id]!.surface;if(s.kind!=='cap')throw Error('Expected cap');return splitNurbsPlaneCapBoundaries3(s,reverseCap?plane3(next.normal.x.neg(),next.normal.y.neg(),next.normal.z.neg(),next.offset.neg()):next);}),caps=capReports.map(c=>{const r=buildNurbsCapSplitFaces3(c);assert.equal(r.kind,'built');if(r.kind!=='built')throw Error('Expected cap');return r;}),alignments=q.inputs.map(input=>{if(input.kind!=='built')throw Error('Expected source');const c=coverNurbsRecutSectionEdges3(q.old,input.source.source.vertices.cells);assert.equal(c.kind,'covered');if(c.kind!=='covered')throw Error('Expected coverage');const a=alignNurbsRecutCapEdges3(c.certificate,capReports);assert.equal(a.kind,'aligned');if(a.kind!=='aligned')throw Error('Expected alignment');return a.certificate;}),r=joinNurbsRecutAssembly3(source,alignments,caps);assert.equal(r.kind,'joined');if(r.kind!=='joined')throw Error('Expected closed old boundary');return {q,source,alignments,caps,r};}
function selectedHalf(r:ReturnType<typeof whole>['r'],side:1|-1){const h=selectNurbsRecutHalfBoundary3(r,side);assert.equal(h.kind,'selected');if(h.kind!=='selected')throw Error('Expected selected half');return h;}
function capWindingSource(r:ReturnType<typeof whole>['r'],side:1|-1=1){return nurbsRecutHalfCapBoundary3(selectedHalf(r,side));}
function inherit(r:ReturnType<typeof whole>['r']){const p=r.source.previous;if(!p||p.kind!=='sewn')throw Error('Expected old source');const K=r.caps[0]?.source.surface.source??containment(cap(p),materialOf(p.source.source)),old=certifyCappedNurbsPlaneEmbedding3(capped(K));assert.equal(old.kind,'certified');if(old.kind!=='certified')throw Error('Expected previous embedding');const q=certifyNurbsRecutAssemblyEmbedding3(r,old.certificate);assert.equal(q.kind,'certified');if(q.kind!=='certified')throw Error('Expected inherited embedding');return {embedding:q.certificate,previous:old.certificate};}
function capDomains(r:ReturnType<typeof whole>['r'],side:1|-1=1){const {embedding}=inherit(r),boundary=capWindingSource(r,side),q=analyzeNurbsRecutCapDomains3(boundary,embedding);assert.equal(q.kind,'analyzed');if(q.kind!=='analyzed')throw Error('Expected cap domains');return q.certificate;}
function recapped(c:ReturnType<typeof capDomains>){const r=capNurbsRecutHalf3(c);assert.equal(r.kind,'closed');if(r.kind!=='closed')throw Error('Expected closed incidence');return r;}
function embedded(c:ReturnType<typeof recapped>){const q=certifyNurbsRecutEmbedding3(c);assert.equal(q.kind,'certified',q.kind==='not-certified'?q.reason+(q.reason==='old-cap-contact'&&q.oldCaps.kind==='unresolved'?':'+q.oldCaps.reason:''):q.kind);if(q.kind!=='certified')throw Error('Expected recut embedding');return q.certificate;}
function contained(e:ReturnType<typeof embedded>){const q=analyzeNurbsRecutContainment3(e);assert.equal(q.kind,'analyzed',q.kind==='unresolved'?q.reason:q.kind);if(q.kind!=='analyzed')throw Error('Expected recomputed containment');assertOwnedNurbsRecutContainment3(q.certificate);return q.certificate;}
function nested(){const scale=(n:bigint,d:bigint,o:bigint,od:bigint)=>(p:ReturnType<typeof point3>)=>point3(...(['x','y','z'] as const).map(k=>p[k].mul(new Rational(n,d)).add(new Rational(o,od))) as Parameters<typeof point3>),inner=transformCube(cube(),scale(3n,5n,1n,5n)).map(r=>buildNurbsSourceBRep3(r.complex,(-r.sense) as 1|-1)),island=transformCube(cube(),scale(1n,5n,2n,5n));return sewn([...cube(),...inner,...island]);}

function materialized(e:ReturnType<typeof embedded>){const q=certifyNurbsRecutMaterial3(contained(e));assert.equal(q.kind,'certified',q.kind==='unresolved'?q.reason:q.kind);if(q.kind!=='certified')throw Error('Expected recut material');return q.certificate;}
let boxCache:ReturnType<typeof materialized>|undefined;
function boxMaterial(){return boxCache??=materialized(embedded(recapped(capDomains(whole(sewn(cube()),plane3(1n,0n,0n,'-1/4'),plane3(0n,0n,1n,'-1/2')).r))));}
function auditMaterial(c:ReturnType<typeof materialized>){
 assertOwnedNurbsRecutMaterial3(c);assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.orientations)&&Object.isFrozen(c.regions));
 for(const o of c.orientations){assert.equal(o.orientation,o.expectedOrientation);assert.equal(o.ray.kind,'regular');assert.ok(o.ray.hits.every(h=>h.dotSign!==0));const outside=queryNurbsRecutShellParityAuto3(c.containment.embedding,o.shell,o.exteriorWitness),inside=queryNurbsRecutShellParityAuto3(c.containment.embedding,o.shell,o.interiorWitness);assert.equal(outside.kind,'parity');assert.equal(inside.kind,'parity');if(outside.kind==='parity')assert.equal(outside.parity,'even');if(inside.kind==='parity')assert.equal(inside.parity,'odd');assert.ok(Object.isFrozen(o));}
 for(const r of c.regions){assert.equal(locateNurbsRecutMaterial3(c.containment.embedding,r.sample).kind,'inside');const actual:number[]=[];for(const s of c.containment.shells){const q=queryNurbsRecutShellParityAuto3(c.containment.embedding,s.shell,r.sample);assert.equal(q.kind,'parity');if(q.kind==='parity'&&q.parity==='odd')actual.push(s.shell);}assert.deepEqual(r.containingShells,actual);assert.ok(AlgebraicReal.fromRational(r.sampleParameter).compare(r.ray.hits[r.entry]!.parameter)>0&&AlgebraicReal.fromRational(r.sampleParameter).compare(r.ray.hits[r.entry+1]!.parameter)<0);assert.ok(Object.isFrozen(r));}
}
test('a recut box certifies actual orientation and a strict complete-boundary material gap',()=>{
 const c=boxMaterial();auditMaterial(c);assert.equal(c.orientations.length,1);assert.equal(c.orientations[0]!.orientation,1);assert.equal(c.regions.length,1);assert.throws(()=>assertOwnedNurbsRecutMaterial3({...c}),RangeError);assert.throws(()=>certifyNurbsRecutMaterial3({...c.containment}),RangeError);
});
test('exact box membership agrees with independent closed halfspace inequalities on a rational grid',()=>{
 const c=boxMaterial(),E=c.containment.embedding,V=['-1/2','0','1/4','1/2','3/4','1','3/2'];
 for(const x of V)for(const y of V)for(const z of V){const p=point3(x,y,z),outside=p.x.compare(Rational.parse('1/4'))<0||p.x.compare(new Rational(1n))>0||p.y.sign()<0||p.y.compare(new Rational(1n))>0||p.z.compare(Rational.parse('1/2'))<0||p.z.compare(new Rational(1n))>0,boundary=p.x.compare(Rational.parse('1/4'))===0||p.x.compare(new Rational(1n))===0||p.y.sign()===0||p.y.compare(new Rational(1n))===0||p.z.compare(Rational.parse('1/2'))===0||p.z.compare(new Rational(1n))===0;assert.equal(locateNurbsRecutMaterial3(E,p).kind,outside?'outside':boundary?'boundary':'inside',`${x},${y},${z}`);}
 assert.equal(locateNurbsRecutMaterial3(E,point3(0n,0n,'3/4')).kind,'outside');
});
test('closed cavity and island material uses actual outward/inward signs and avoids void witnesses',()=>{
 const E=embedded(recapped(capDomains(whole(nested(),plane3(1n,0n,0n,'-1/10'),plane3(0n,0n,1n,'-1/10')).r))),c=materialized(E);auditMaterial(c);
 assert.deepEqual(c.orientations.map(o=>[c.containment.shells[o.shell]!.depth,o.orientation]).sort((a,b)=>a[0]!-b[0]!),[[0,1],[1,-1],[2,1]]);assert.equal(c.regions.length,2);
 const outer=c.regions.find(r=>c.containment.shells[r.shell]!.depth===0)!,island=c.regions.find(r=>c.containment.shells[r.shell]!.depth===2)!;assert.equal(outer.cavities.length,1);assert.equal(island.cavities.length,0);assert.ok(['x','y','z'].some(k=>outer.sample[k as 'x'|'y'|'z'].compare(Rational.parse('1/5'))<0||outer.sample[k as 'x'|'y'|'z'].compare(Rational.parse('4/5'))>0));
 for(const [p,kind] of [[point3('3/20','1/2','1/2'),'inside'],[point3('3/10','3/10','3/10'),'outside'],[point3('1/2','1/2','1/2'),'inside'],[point3('1/2','1/2','1/10'),'boundary']] as const)assert.equal(locateNurbsRecutMaterial3(E,p).kind,kind);
});
test('opening the cavity produces two independently oriented material regions',()=>{
 const E=embedded(recapped(capDomains(whole(nested(),plane3(1n,0n,0n,'-1/10'),plane3(0n,0n,1n,'-1/2')).r))),c=materialized(E);auditMaterial(c);assert.equal(c.regions.length,2);assert.ok(c.orientations.every(o=>o.orientation===1));assert.ok(c.regions.every(r=>r.cavities.length===0&&r.containingShells.length===1));
 for(const [p,kind] of [[point3('9/10','1/2','3/4'),'inside'],[point3('3/10','3/10','11/20'),'outside'],[point3('1/2','1/2','11/20'),'inside'],[point3('1/2','1/2','3/4'),'outside']] as const)assert.equal(locateNurbsRecutMaterial3(E,p).kind,kind);
});
test('weighted curved material preserves algebraic interior and boundary point membership',()=>{
 const E=embedded(recapped(capDomains(whole(cylinder(),plane3(0n,1n,0n,'-1/3'),plane3(0n,0n,1n,'-1/2')).r))),c=materialized(E);auditMaterial(c);assert.equal(c.regions.length,1);
 const inside=algebraicCoordinates3(AlgebraicReal.fromRational('1/7').sqrt(),'1/2','3/4'),boundary=algebraicCoordinates3(AlgebraicReal.fromRational('3/4').sqrt(),'1/2','3/4');assert.equal(locateNurbsRecutMaterial3(E,inside).kind,'inside');assert.equal(locateNurbsRecutMaterial3(E,boundary).kind,'boundary');
 for(const [p,kind] of [[point3(0n,'1/2','3/4'),'inside'],[point3(0n,0n,'3/4'),'outside'],[point3(0n,'1/2','1/4'),'outside'],[point3(0n,'1/3','3/4'),'boundary'],[point3(0n,'1/2','1/2'),'boundary']] as const)assert.equal(locateNurbsRecutMaterial3(E,p).kind,kind);
});
test('regularization removes a discarded tangent remnant and empty material has no invented region',()=>{
 const r=whole(cylinder(),plane3(0n,0n,1n,'-1/2'),plane3(1n,0n,0n,-1n));
 const empty=materialized(embedded(recapped(capDomains(r.r)))),full=materialized(embedded(recapped(capDomains(r.r,-1))));assert.deepEqual(empty.orientations,[]);assert.deepEqual(empty.regions,[]);assert.equal(locateNurbsRecutMaterial3(empty.containment.embedding,point3(1n,0n,'3/4')).kind,'outside');assert.equal(locateNurbsRecutMaterial3(full.containment.embedding,point3(1n,0n,'3/4')).kind,'boundary');
});
test('direction exhaustion and invalid owners or budgets never issue material certificates',()=>{
 const c=boxMaterial(),E=c.containment.embedding,p=point3('1/2','1/2','3/4'),q=certifyNurbsRecutMaterial3(c.containment,{directions:[point3(-1n,0n,0n)],maxDirections:1});assert.equal(q.kind,'unresolved');if(q.kind==='unresolved')assert.equal(q.reason,'ray-budget');
 const source=locateNurbsRecutMaterial3(E,p,{directions:[point3(2n,2n,1n)],maxDirections:1});assert.equal(source.kind,'unresolved');if(source.kind==='unresolved')assert.equal(source.reason,'source-material');assert.throws(()=>locateNurbsRecutMaterial3({...E},p),RangeError);
 for(const n of [0,-1,1.5,NaN,Infinity]){assert.throws(()=>certifyNurbsRecutMaterial3(c.containment,{maxDirections:n}),RangeError);assert.throws(()=>certifyNurbsRecutMaterial3(c.containment,{maxFaceDirections:n}),RangeError);assert.throws(()=>locateNurbsRecutMaterial3(E,p,{maxDirections:n}),RangeError);assert.throws(()=>locateNurbsRecutMaterial3(E,p,{maxFaceDirections:n}),RangeError);}
});

test('reversed cutting normals and both selected halves retain actual cap orientation',()=>{
 const r=whole(sewn(cube(true)),plane3(-1n,0n,0n,'3/4'),plane3(0n,0n,-7n,'7/2'));
 for(const side of [1,-1] as const){const E=embedded(recapped(capDomains(r.r,side))),c=materialized(E);auditMaterial(c);assert.equal(c.orientations.length,1);assert.equal(c.orientations[0]!.orientation,1);assert.equal(locateNurbsRecutMaterial3(E,point3('1/4','1/2',side===1?'1/4':'3/4')).kind,'inside');assert.equal(locateNurbsRecutMaterial3(E,point3('1/4','1/2',side===1?'3/4':'1/4')).kind,'outside');assert.equal(locateNurbsRecutMaterial3(E,point3('1/4','1/2','1/2')).kind,'boundary');assert.equal(locateNurbsRecutMaterial3(E,point3('7/8','1/2','1/2')).kind,'outside');}
});
