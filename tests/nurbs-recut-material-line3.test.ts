import {intersectNurbsRecutMaterialLine3} from '../dist/index.js';
import {materialOfRecutNurbsBody3} from '../dist/model/recut-nurbs-body3.js';
import {bodyFromRecutNurbsMaterial3,createCappedNurbsBody3,createRecutNurbsBody3,readRecutNurbsBodyDocument3,bodySplitInterface3} from '../dist/index.js';
import type {RecutNurbsBody3,RecutNurbsBodyDocument3} from '../dist/index.js';
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
function prepared(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const f=classifyNurbsSourceFaces3(buildNurbsSourceHalfedges3(buildNurbsSourceBoundaryComplex3(refined(s,t,d))));assert.equal(f.kind,'classified');return f;}
function lifted(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const r=liftNurbsSourceFaceBoundaries3(prepared(s,t,d));assert.equal(r.kind,'lifted');if(r.kind!=='lifted')throw Error('Expected lift');return r;}
function selected(s:NurbsSurface3,t:NurbsSurface3,d=unit()){const result=selectNurbsSourceFacePatches3(lifted(s,t,d));assert.equal(result.kind,'selected');if(result.kind!=='selected')throw Error('Expected patch selection');return result;}
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
function nested(){const scale=(n:bigint,d:bigint,o:bigint,od:bigint)=>(p:ReturnType<typeof point3>)=>point3(...(['x','y','z'] as const).map(k=>p[k].mul(new Rational(n,d)).add(new Rational(o,od))) as Parameters<typeof point3>),inner=transformCube(cube(),scale(3n,5n,1n,5n)).map(r=>buildNurbsSourceBRep3(r.complex,(-r.sense) as 1|-1)),island=transformCube(cube(),scale(1n,5n,2n,5n));return sewn([...cube(),...inner,...island]);}
function rawBody(raw:ReturnType<typeof sewn>){return bodyFromNurbsMaterial3(materialOf(raw));}
function buildPublic(){const root=rawBody(sewn(cube())),parent=createCappedNurbsBody3(root,plane3(1n,0n,0n,'-1/4'),1),split=splitBodyByPlane3(parent,plane3(0n,0n,1n,'-1/2'));assert.equal(split.representation,'nurbs-recut');if(split.representation!=='nurbs-recut')throw Error('Expected common recut split');return {root,parent,split,positive:split.positive,negative:split.negative};}
let publicCache:ReturnType<typeof buildPublic>|undefined;
function publicBodies(){return publicCache??=buildPublic();}

function resolved(q:ReturnType<typeof intersectNurbsRecutMaterialLine3>){assert.equal(q.kind,'resolved',q.kind==='unresolved'?q.reason:q.kind);if(q.kind!=='resolved')throw Error('Expected complete closed material line');return q;}
function bounds(q:ReturnType<typeof resolved>){return q.intervals.map(i=>[i.start.parameter.recognizeRational().rational?.toString(),i.end.parameter.recognizeRational().rational?.toString()]);}
test('closed material line intervals keep nonunit parameters and both kinds of source provenance',()=>{
 const b=publicBodies().positive,q=resolved(intersectBodyLineMaterial3(b,point3(-1n,'1/2','3/4'),point3(2n,0n,0n)));assert.deepEqual(bounds(q),[['5/8','1']]);assert.deepEqual(q.isolated,[]);assert.ok(q.intervals[0]!.start.cutPlanes.includes(0));assert.notEqual(q.intervals[0]!.end.sourceHit,null);for(const i of q.intervals)for(const s of i.spans){assert.equal(s.location,'inside');assert.equal(locateBody3(b,s.sample),'inside');}assert.ok(Object.isFrozen(q)&&Object.isFrozen(q.intervals));
 const m=materialOfRecutNurbsBody3(b);assert.throws(()=>intersectNurbsRecutMaterialLine3({...m},line3(point3(0n,0n,0n),point3(1n,0n,0n))),RangeError);assert.throws(()=>intersectNurbsRecutMaterialLine3(m,line3(point3(0n,0n,0n),point3(1n,0n,0n)),{maxFaceDirections:0}),RangeError);
});
test('lines contained in old and new cap planes return closed boundary spans',()=>{
 const b=publicBodies().positive;
 for(const [o,d,expected] of [[point3('1/4',-1n,'3/4'),point3(0n,2n,0n),[['1/2','1']]],[point3(-1n,'1/2','1/2'),point3(2n,0n,0n),[['5/8','1']]]] as const){const q=resolved(intersectBodyLineMaterial3(b,o,d));assert.deepEqual(bounds(q),expected);assert.ok(q.intervals.every(i=>i.spans.every(s=>s.location==='boundary')));for(const i of q.intervals)for(const s of i.spans)assert.equal(locateBody3(b,s.sample),'boundary');}
});
test('weighted curved material lines preserve algebraic endpoints and true isolated tangencies',()=>{
 const parent=createCappedNurbsBody3(rawBody(cylinder()),plane3(0n,1n,0n,'-1/3'),1),b=createRecutNurbsBody3(parent,plane3(0n,0n,1n,'-1/2'),1),q=resolved(intersectBodyLineMaterial3(b,point3(-2n,'1/2','3/4'),point3(1n,0n,0n)));assert.equal(q.intervals.length,1);for(const h of [q.intervals[0]!.start,q.intervals[0]!.end]){assert.equal(h.parameter.rational,null);assert.equal(h.point.x.mul(h.point.x).add(h.point.y.mul(h.point.y)).compare(AlgebraicReal.fromRational(1n)),0);}
 const tangent=resolved(intersectBodyLineMaterial3(b,point3(-2n,1n,'3/4'),point3(1n,0n,0n)));assert.equal(tangent.intervals.length,0);assert.equal(tangent.isolated.length,1);assert.equal(tangent.isolated[0]!.parameter.compare(AlgebraicReal.fromRational(2n)),0);
 const discarded=resolved(intersectBodyLineMaterial3(b,point3(-2n,0n,'3/4'),point3(1n,0n,0n)));assert.deepEqual(discarded.intervals,[]);assert.deepEqual(discarded.isolated,[]);
});
test('coincident-plane refinement detects a short surviving boundary interval inside a raw overlap',()=>{
 const roots=cube(),U=['0','1/2','1'],A=['-3/50','19/100','-14/25'];
 roots[1]=buildNurbsSourceBRep3(complex(nurbsSurface3(2,2,U.map((x,i)=>U.map((y,j)=>point3(x,y,new Rational(1n).add(j===2?Rational.parse(A[i]!):new Rational(0n))))),K2,K2),plane('100')));
 roots[3]=buildNurbsSourceBRep3(complex(nurbsSurface3(2,1,U.map((x,i)=>[point3(x,1n,0n),point3(x,1n,new Rational(1n).add(Rational.parse(A[i]!)))]),K2,K),plane('100')),-1);
 for(const [index,x,a,sense] of [[4,0n,A[0]!,-1],[5,1n,A[2]!,1]] as const)roots[index]=buildNurbsSourceBRep3(complex(nurbsSurface3(2,1,U.map((y,j)=>[point3(x,y,0n),point3(x,y,new Rational(1n).add(j===2?Rational.parse(a):new Rational(0n)))]),K2,K),plane('100')),sense);
 const parent=createCappedNurbsBody3(rawBody(sewn(roots)),plane3(1n,0n,0n,1n),1),b=createRecutNurbsBody3(parent,plane3(0n,0n,1n,-1n),1),q=resolved(intersectBodyLineMaterial3(b,point3(0n,0n,1n),point3(1n,0n,0n)));assert.deepEqual(bounds(q),[['1/5','3/10']]);assert.ok(q.intervals.every(i=>i.spans.every(s=>s.location==='boundary')));assert.ok(q.intervals[0]!.start.refinement&&q.intervals[0]!.end.refinement);
});
test('an opened cavity and island produce three closed line intervals with no void span',()=>{
 const parent=createCappedNurbsBody3(rawBody(nested()),plane3(1n,0n,0n,'-1/10'),1),b=createRecutNurbsBody3(parent,plane3(0n,0n,1n,'-1/2'),1),q=resolved(intersectBodyLineMaterial3(b,point3(-1n,'1/2','11/20'),point3(1n,0n,0n)));assert.deepEqual(bounds(q),[['11/10','6/5'],['7/5','8/5'],['9/5','2']]);assert.deepEqual(q.isolated,[]);for(const i of q.intervals)for(const s of i.spans)assert.equal(locateBody3(b,s.sample),'inside');
});

test('two simultaneous clipping roots retain an isolated corner contact absent from raw source hits',()=>{
 const b=publicBodies().positive,q=resolved(intersectBodyLineMaterial3(b,point3(0n,'1/2','3/4'),point3(1n,0n,-1n)));assert.deepEqual(q.intervals,[]);assert.equal(q.isolated.length,1);const h=q.isolated[0]!;assert.equal(h.parameter.compare(AlgebraicReal.fromRational('1/4')),0);assert.deepEqual(h.cutPlanes,[0,1]);assert.equal(h.sourceHit,null);assert.equal(compareAlgebraicPoints3(h.point,algebraicCoordinates3('1/4','1/2','1/2')),0);
});
