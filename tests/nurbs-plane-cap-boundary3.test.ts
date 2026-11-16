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

function transformCube(roots:ReturnType<typeof cube>,map:(p:ReturnType<typeof point3>)=>ReturnType<typeof point3>){return roots.map(r=>{const proof=r.complex.embedding.faces[0]!;if(proof.kind!=='certified')throw Error('Expected local proof');const s=proof.certificate.surface,surface=nurbsSurface3(s.degreeU,s.degreeV,s.controlPoints.map(row=>row.map(map)),s.knotsU,s.knotsV,s.weights);return buildNurbsSourceBRep3(complex(surface,plane('100')),r.sense);});}
function containmentOf(r:ReturnType<typeof sewn>){const proof=certifySewnNurbsSourceEmbedding3(r);assert.equal(proof.kind,'certified');if(proof.kind!=='certified')throw Error('Expected global embedding');const q=analyzeSewnNurbsSourceContainment3(proof.certificate);assert.equal(q.kind,'analyzed');if(q.kind!=='analyzed')throw Error('Expected containment');return q.certificate;}
function materialOf(r:ReturnType<typeof sewn>){const q=certifySewnNurbsSourceMaterial3(containmentOf(r));assert.equal(q.kind,'certified');if(q.kind!=='certified')throw Error('Expected material boundary');return q.certificate;}

function assembled(material:Parameters<typeof intersectSewnNurbsSourceBoundaryPlane3>[0],plane:ReturnType<typeof plane3>){const r=intersectSewnNurbsSourceBoundaryPlane3(material,plane);assert.equal(r.kind,'assembled');if(r.kind!=='assembled')throw Error('Expected material plane assembly');return r;}


function wires(r:ReturnType<typeof assembled>){const q=certifyNurbsBoundaryPlaneWires3(r);assert.equal(q.kind,'certified');if(q.kind!=='certified')throw Error('Expected oriented wires');return q.certificate;}
function signedArea(c:ReturnType<typeof wires>,axis:'xy'|'yz'='xy'){return c.wires.map(w=>AlgebraicReal.productCombination(w.uses.flatMap(u=>{const e=c.source.edges[u.edge]!,a=c.source.vertices[u.direction===1?e.from:e.to]!.point,b=c.source.vertices[u.direction===1?e.to:e.from]!.point;return axis==='xy'?[{factors:[a.x,b.y],coefficient:1n},{factors:[a.y,b.x],coefficient:-1n}]:[{factors:[a.y,b.z],coefficient:1n},{factors:[a.z,b.y],coefficient:-1n}];})));}





function noded(r:ReturnType<typeof nodeNurbsPlaneCellSourceEdges3>){assert.equal(r.kind,'noded');if(r.kind!=='noded')throw Error('Expected complete source noding');return r;}
function auditNodes(r:ReturnType<typeof noded>){for(const loop of r.cells)for(let i=0;i<loop.length;i++){const a=loop[i]!,b=loop[(i+1)%loop.length]!,x=r.edges[a.edge]!,y=r.edges[b.edge]!;assert.equal(a.direction===1?x.to:x.from,b.direction===1?y.from:y.to);}for(const [old,uses] of r.sourceUses.entries()){let cursor=r.source.vertices.cells.edges[old]!.lower;for(const u of uses){const e=r.edges[u.edge]!;assert.equal(e.lower.compare(cursor),0);assert.ok(e.lower.compare(e.upper)<0);cursor=e.upper;}assert.equal(cursor.compare(r.source.vertices.cells.edges[old]!.upper),0);}for(const e of r.edges)if(e.source){const f=r.source.vertices.source.topology.edges[e.source.edge]!.curve,a=nurbsSourcePlaneEdgeFragmentPoint3(f,e.source.direction===1?e.source.lower:e.source.upper),b=nurbsSourcePlaneEdgeFragmentPoint3(f,e.source.direction===1?e.source.upper:e.source.lower);assert.equal(compareAlgebraicPoints3(a,r.vertices[e.from]!.point),0);assert.equal(compareAlgebraicPoints3(b,r.vertices[e.to]!.point),0);}}

function built(r:ReturnType<typeof buildNurbsPlaneSplitFaces3>){assert.equal(r.kind,'built');if(r.kind!=='built')throw Error('Expected adopted split faces');return r;}

function sewnFaces(r:ReturnType<typeof sewNurbsPlaneSplitFaces3>){assert.equal(r.kind,'sewn');if(r.kind!=='sewn')throw Error('Expected sewn split faces');return r;}
function parts(source:ReturnType<typeof refineSewnNurbsSourceEdgesByPlane3>){return source.topology.faces.map((f,face)=>{const cells=buildNurbsSourcePlaneCellComplex3(partitionNurbsSourceFaceByPlane3(f.surface.source.complex,f.surface.face,source.plane));return buildNurbsPlaneSplitFaces3(nodeNurbsPlaneCellSourceEdges3(matchNurbsPlaneCellSourceEdges3(source,face,cells)));});}
function between(a:AlgebraicReal,b:AlgebraicReal){while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
function cap(source:Parameters<typeof nurbsPlaneCapBoundary3>[0]){const r=nurbsPlaneCapBoundary3(source);assert.equal(r.kind,'certified');if(r.kind!=='certified')throw Error('Expected cap boundary');return r.certificate;}
function auditCap(c:ReturnType<typeof cap>){const T=c.source.topology,seen=new Set<number>();for(const loop of c.loops){assert.ok(loop.length>0);for(let i=0;i<loop.length;i++){const a=loop[i]!,b=loop[(i+1)%loop.length]!,e=T.edges[a.edge]!,f=T.edges[b.edge]!;assert.equal(e.coedges.length,1);assert.equal(a.direction,-T.coedges[e.coedges[0]!]!.direction);assert.equal(a.direction===1?e.end:e.start,b.direction===1?f.start:f.end);assert.equal(seen.has(a.edge),false);seen.add(a.edge);const q=nurbsPlaneCapBoundaryPoint3(c,a.edge,between(e.curve.lower,e.curve.upper)),p=sewnNurbsPlaneSplitEdgePoint3(e.curve,between(e.curve.lower,e.curve.upper));assert.equal(compareAlgebraicPoints3(mapPlanePoint3(c.frame,q),p),0);}}assert.equal(seen.size,T.edges.filter(e=>e.coedges.length===1).length);}
test('cap boundaries reverse every open coedge and preserve an exact oblique plane chart',()=>{
 const p=plane3(1n,0n,1n,'-11/10'),source=refineSewnNurbsSourceEdgesByPlane3(sewn(cube(true)),p),input=parts(source);
 for(const side of [1,-1] as const){const c=cap(sewnFaces(sewNurbsPlaneSplitFaces3(source,input,side)));assert.equal(c.sense,-side);assert.equal(c.loops.length,1);auditCap(c);assert.throws(()=>nurbsPlaneCapBoundaryPoint3({...c},0,0n),/factory/);assert.throws(()=>nurbsPlaneCapBoundaryPoint3(c,-1,0n),/boundary edge/);const edge=c.loops[0]![0]!.edge;assert.throws(()=>nurbsPlaneCapBoundaryPoint3(c,edge,-100n),/outside/);}
 assert.throws(()=>nurbsPlaneCapBoundary3({...sewnFaces(sewNurbsPlaneSplitFaces3(source,input,1))}),/factory/);
 const all=nurbsPlaneCapBoundary3(sewnFaces(sewNurbsPlaneSplitFaces3(source,input)));assert.equal(all.kind,'unresolved');if(all.kind==='unresolved')assert.equal(all.reason,'side-required');
});
test('weighted circular cut boundaries keep native curves and round-trip through the cap chart',()=>{
 const source=refineSewnNurbsSourceEdgesByPlane3(cylinder(),plane3(0n,0n,1n,'-1/2')),input=parts(source);
 for(const side of [1,-1] as const){const c=cap(sewnFaces(sewNurbsPlaneSplitFaces3(source,input,side)));assert.equal(c.loops.length,1);auditCap(c);for(const loop of c.loops)for(const u of loop){const e=c.source.topology.edges[u.edge]!.curve,q=nurbsPlaneCapBoundaryPoint3(c,u.edge,between(e.lower,e.upper));assert.equal(AlgebraicReal.productCombination([{factors:[q.x,q.x]},{factors:[q.y,q.y]}]).compare(AlgebraicReal.fromRational(1n)),0);}}
});
test('multiple and nested boundaries remain distinct without polygonal hole guesses',()=>{
 const outer=cube(),inner=transformCube(cube(),p=>point3(p.x.div(new Rational(3n)).add(new Rational(1n,3n)),p.y.div(new Rational(3n)).add(new Rational(1n,3n)),p.z.div(new Rational(3n)).add(new Rational(1n,3n)))).map(r=>buildNurbsSourceBRep3(r.complex,(-r.sense) as 1|-1)),other=transformCube(cube(),p=>point3(p.x.add(new Rational(2n)),p.y,p.z));
 const source=refineSewnNurbsSourceEdgesByPlane3(sewn([...outer,...inner,...other]),plane3(0n,0n,1n,'-1/2')),input=parts(source),c=cap(sewnFaces(sewNurbsPlaneSplitFaces3(source,input,1)));assert.equal(c.loops.length,3);auditCap(c);
 const signs=c.loops.map(loop=>AlgebraicReal.productCombination(loop.flatMap(u=>{const e=c.source.topology.edges[u.edge]!,a=pointInPlaneFrame3(c.frame,c.source.topology.vertices[u.direction===1?e.start:e.end]!)!,b=pointInPlaneFrame3(c.frame,c.source.topology.vertices[u.direction===1?e.end:e.start]!)!;return [{factors:[a.x,b.y],coefficient:1n},{factors:[a.y,b.x],coefficient:-1n}];})).sign());assert.equal(signs.filter(s=>s===-1).length,2);assert.equal(signs.filter(s=>s===1).length,1);
});
test('open parents and unresolved face selections cannot become cap certificates; disjoint cuts stay empty',()=>{
 const p=plane3(1n,0n,0n,'-1/2'),open=refineSewnNurbsSourceEdgesByPlane3(sewn(cube().slice(0,1)),p),r=nurbsPlaneCapBoundary3(sewnFaces(sewNurbsPlaneSplitFaces3(open,parts(open),1)));assert.equal(r.kind,'unresolved');if(r.kind==='unresolved')assert.equal(r.reason,'open-parent');
 const source=refineSewnNurbsSourceEdgesByPlane3(sewn(cube()),plane3(0n,0n,1n)),unresolved=nurbsPlaneCapBoundary3(sewNurbsPlaneSplitFaces3(source,parts(source),1));assert.equal(unresolved.kind,'unresolved');if(unresolved.kind==='unresolved')assert.equal(unresolved.reason,'face-sewing');
 const far=refineSewnNurbsSourceEdgesByPlane3(sewn(cube()),plane3(0n,0n,1n,-2n)),input=parts(far);for(const side of [1,-1] as const){const c=cap(sewnFaces(sewNurbsPlaneSplitFaces3(far,input,side)));assert.equal(c.loops.length,0);auditCap(c);}
});
