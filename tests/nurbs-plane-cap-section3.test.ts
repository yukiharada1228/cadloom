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
function winding(c:ReturnType<typeof cap>,x:string,y:string,options={}){return queryNurbsPlaneCapWinding3(c,point2(x,y),options);}
function located(r:ReturnType<typeof winding>){assert.equal(r.kind,'located');if(r.kind!=='located')throw Error('Expected winding');return r;}
function total(r:ReturnType<typeof winding>){return located(r).windings.reduce((a,b)=>a+b,0);}
function containment(boundary:ReturnType<typeof cap>,material:ReturnType<typeof materialOf>,options={}){const q=analyzeNurbsPlaneCapContainment3(boundary,material,options);assert.equal(q.kind,'analyzed');if(q.kind!=='analyzed')throw Error('Expected cap containment');return q.certificate;}
function auditContainment(c:ReturnType<typeof containment>){const used:number[]=[];for(const f of c.faces){assert.equal(c.loops[f.outer]!.depth%2,0);used.push(f.outer);for(const hole of f.holes){assert.equal(c.loops[hole]!.parent,f.outer);assert.equal(c.loops[hole]!.depth,c.loops[f.outer]!.depth+1);used.push(hole);}}assert.deepEqual(used.sort((a,b)=>a-b),c.loops.map(l=>l.loop));assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.loops)&&Object.isFrozen(c.faces));for(const l of c.loops){assert.ok(Object.isFrozen(l.containers));assert.equal(l.containers.length,l.depth);}}
function capped(r:ReturnType<typeof containment>){const q=capNurbsPlaneSplitFaces3(r);assert.equal(q.kind,'closed');if(q.kind!=='closed')throw Error('Expected closed capped incidence');return q;}
function auditCapped(r:ReturnType<typeof containment>){const c=capped(r),T=c.topology,old=r.boundary.source.topology;assert.equal(T.closedOrientedIncidence,true);assert.equal(T.boundaryLoops?.length,0);assert.deepEqual(T.issues,[]);assert.equal(T.edges.length,old.edges.length);assert.equal(T.faces.length,old.faces.length+r.faces.length);assert.equal(c.capFaces.length,r.faces.length);assert.equal(c.sourceFaces.length,old.faces.length);for(const [i,e] of old.edges.entries()){const n=T.edges[c.sourceEdges[i]!]!;assert.equal(n.curve,e.curve);assert.equal(n.coedges.length,2);const a=T.coedges[n.coedges[0]!]!,b=T.coedges[n.coedges[1]!]!;assert.equal(a.direction,-b.direction);assert.equal(a.twin,n.coedges[1]);assert.equal(b.twin,n.coedges[0]);assert.equal(compareAlgebraicPoints3(T.vertices[n.start]!,old.vertices[e.start]!),0);assert.equal(compareAlgebraicPoints3(T.vertices[n.end]!,old.vertices[e.end]!),0);}for(const [i,id] of c.sourceVertices.entries())assert.equal(compareAlgebraicPoints3(T.vertices[id]!,old.vertices[i]!),0);for(const [i,id] of c.sourceFaces.entries()){const f=T.faces[id]!;assert.equal(f.surface.kind,'source');if(f.surface.kind==='source')assert.equal(f.surface.source,old.faces[i]!.surface);assert.equal(f.sense,old.faces[i]!.sense);}for(const [i,id] of c.capFaces.entries()){const f=T.faces[id]!;assert.equal(f.surface.kind,'cap');assert.equal(f.sense,r.boundary.sense);assert.equal(f.loops.length,1+r.faces[i]!.holes.length);if(f.surface.kind==='cap'){const surface=f.surface;assert.equal(surface.source,r);assert.equal(surface.face,i);assert.throws(()=>locateNurbsPlaneCapFace3({...surface},point2(0n,0n)),/factory/);}}assert.equal(T.vertices.length-T.edges.length+T.faces.reduce((n,f)=>n+2-f.loops.length,0),2*T.shells.length);assert.throws(()=>capNurbsPlaneSplitFaces3({...r}),/factory/);return c;}

function capSurfaces(raw:ReturnType<typeof sewn>,p=plane3(0n,0n,1n,'-1/2')){const m=materialOf(raw),r=refineSewnNurbsSourceEdgesByPlane3(raw,p),c=capped(containment(cap(sewnFaces(sewNurbsPlaneSplitFaces3(r,parts(r),1))),m));return c.capFaces.map(i=>{const s=c.topology.faces[i]!.surface;if(s.kind!=='cap')throw Error('Expected cap');return s;});}
function section(s:ReturnType<typeof capSurfaces>[number],p:ReturnType<typeof plane3>){const q=intersectNurbsPlaneCapFacePlane3(s,p);assert.equal(q.kind,'section');if(q.kind!=='section')throw Error('Expected section');return q;}
function ranges(q:ReturnType<typeof section>,axis:'x'|'y'='y'){return q.intervals.map(i=>[i.start.point[axis].rational?.toString(),i.end.point[axis].rational?.toString()].sort());}
test('finite cap plane section preserves interior chords, boundary overlap and isolated vertex contacts',()=>{
 const s=capSurfaces(sewn(cube(true)))[0]!,q=section(s,plane3(1n,0n,0n,'-1/3'));
 assert.deepEqual(ranges(q),[['0','1']]);assert.equal(q.events.length,2);assert.equal(q.isolated.length,0);assert.equal(q.intervals[0]!.spans[0]!.location,'inside');
 const edge=section(s,plane3(1n,0n,0n,0n));assert.deepEqual(ranges(edge),[['0','1']]);assert.equal(edge.intervals[0]!.spans[0]!.location,'boundary');assert.ok(edge.events.every(e=>e.boundary.length===2));
 const corner=section(s,plane3(1n,1n,0n,0n));assert.equal(corner.intervals.length,0);assert.equal(corner.isolated.length,1);assert.equal(corner.isolated[0]!.point.x.sign(),0);assert.equal(corner.isolated[0]!.point.y.sign(),0);
 assert.equal(section(s,plane3(1n,0n,0n,-2n)).events.length,0);
 assert.equal(intersectNurbsPlaneCapFacePlane3(s,plane3(0n,0n,-2n,1n)).kind,'coplanar');assert.equal(intersectNurbsPlaneCapFacePlane3(s,plane3(0n,0n,1n,-2n)).kind,'parallel');
 assert.throws(()=>intersectNurbsPlaneCapFacePlane3({...s},plane3(1n,0n,0n,0n)),/factory/);assert.throws(()=>intersectNurbsPlaneCapFacePlane3(s,plane3(1n,0n,0n,0n),{maxDirections:0}),/positive/);
 assert.ok(Object.isFrozen(q)&&Object.isFrozen(q.events)&&Object.isFrozen(q.events[0]!.boundary));
});
test('cap holes split a chord into distinct closed intervals and islands stay separate faces',()=>{
 const scale=(n:bigint,d:bigint,o:bigint,od:bigint)=>(p:ReturnType<typeof point3>)=>point3(...(['x','y','z'] as const).map(k=>p[k].mul(new Rational(n,d)).add(new Rational(o,od))) as Parameters<typeof point3>),inner=transformCube(cube(),scale(3n,5n,1n,5n)).map(r=>buildNurbsSourceBRep3(r.complex,(-r.sense) as 1|-1)),island=transformCube(cube(),scale(1n,5n,2n,5n)),surfaces=capSurfaces(sewn([...cube(),...inner,...island]));
 const reports=surfaces.map(s=>section(s,plane3(1n,0n,0n,'-1/2'))),all=reports.flatMap(q=>ranges(q));assert.deepEqual(all.sort(),[['0','1/5'],['2/5','3/5'],['4/5','1'].sort()].sort());assert.equal(reports.reduce((n,r)=>n+r.intervals.length,0),3);assert.ok(reports.every(r=>r.isolated.length===0));
});
test('weighted circular caps retain algebraic endpoints and exact tangent contacts',()=>{
 const s=capSurfaces(cylinder())[0]!,q=section(s,plane3(0n,1n,0n,'-1/3'));assert.equal(q.intervals.length,1);const i=q.intervals[0]!;
 for(const e of [i.start,i.end]){assert.equal(e.point.y.compare(AlgebraicReal.fromRational('1/3')),0);assert.equal(e.point.x.mul(e.point.x).compare(AlgebraicReal.fromRational('8/9')),0);assert.equal(e.point.x.rational,null);assert.equal(e.point.z.compare(AlgebraicReal.fromRational('1/2')),0);}
 assert.equal(i.start.point.x.sign()*i.end.point.x.sign(),-1);const tangent=section(s,plane3(1n,0n,0n,-1n));assert.equal(tangent.intervals.length,0);assert.equal(tangent.isolated.length,1);assert.equal(tangent.isolated[0]!.point.y.sign(),0);
});
test('oblique cap sections preserve spatial endpoints under signed plane rescaling',()=>{
 const s=capSurfaces(sewn(cube(true)),plane3(1n,0n,1n,'-11/10'))[0]!;
 for(const scale of [new Rational(1n),new Rational(-7n,3n)]){
  const q=section(s,plane3(0n,scale,0n,scale.div(new Rational(-3n))));assert.equal(q.intervals.length,1);assert.deepEqual(ranges(q,'x'),[['1','1/10'].sort()]);
  for(const e of q.events){assert.equal(e.point.y.compare(AlgebraicReal.fromRational('1/3')),0);assert.equal(AlgebraicReal.linearCombination([{value:e.point.x,coefficient:1n},{value:e.point.z,coefficient:1n}]).compare(AlgebraicReal.fromRational('11/10')),0);}
 }
});
