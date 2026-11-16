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
test('independent algebraic cap-chart coordinates preserve exact interior, exterior and boundary winding',()=>{
 const source=refineSewnNurbsSourceEdgesByPlane3(cylinder(),plane3(0n,0n,1n,'-1/2')),c=cap(sewnFaces(sewNurbsPlaneSplitFaces3(source,parts(source),1))),a=AlgebraicReal.fromRational(2n).sqrt(),b=AlgebraicReal.fromRational(3n).sqrt();
 assert.equal(total(queryNurbsPlaneCapWinding3(c,algebraicCoordinates2(a.affine('1/4'),b.affine('1/4')))),-1);
 assert.equal(total(queryNurbsPlaneCapWinding3(c,algebraicCoordinates2(a,b))),0);
 const root=AlgebraicReal.fromRational('1/2').sqrt();assert.equal(queryNurbsPlaneCapWinding3(c,algebraicCoordinates2(root,root)).kind,'boundary');assert.equal(queryNurbsPlaneCapWinding3(c,algebraicCoordinates2(root.neg(),root)).kind,'boundary');
 const q={x:a.affine('1/4'),y:b.affine('1/4')},r=queryNurbsPlaneCapWinding3(c,q);q.x=AlgebraicReal.fromRational(100n);assert.equal(r.point.x.compare(a.affine('1/4')),0);assert.ok(Object.isFrozen(r.point));
});
test('algebraic plane offsets discard the other conjugate level on source and section curves',()=>{
 const source=refineSewnNurbsSourceEdgesByPlane3(cylinder(),plane3(0n,0n,1n,'-1/2')),half=sewnFaces(sewNurbsPlaneSplitFaces3(source,parts(source),1)),c=cap(half),value=AlgebraicReal.fromRational('1/2').sqrt(),p={normal:point3(1n,0n,0n),offset:value.neg()};let hits=0;
 for(const use of c.loops.flat()){const e=half.topology.edges[use.edge]!.curve,r=partitionSewnNurbsSplitEdgeByAlgebraicPlane3(e,p);for(const v of r.vertices)if(v.sign===0){hits++;assert.equal(v.point.x.compare(value),0);}for(let i=1;i+1<r.vertices.length;i++)assert.equal(r.vertices[i]!.sign,0);}
 assert.equal(hits,2);
 let sourceHits=0;for(const e of half.topology.edges)if(e.curve.kind==='source'&&sewnNurbsPlaneSplitEdgePoint3(e.curve,e.curve.lower).z.compare(AlgebraicReal.fromRational(1n))===0&&sewnNurbsPlaneSplitEdgePoint3(e.curve,e.curve.upper).z.compare(AlgebraicReal.fromRational(1n))===0){const r=partitionSewnNurbsSplitEdgeByAlgebraicPlane3(e.curve,p);for(const v of r.vertices)if(v.sign===0){sourceHits++;assert.equal(v.point.x.compare(value),0);}}
 assert.equal(sourceHits,2);
});
test('a norm polynomial shared by a conjugate constant branch does not create a false overlap',()=>{
 const source=refineSewnNurbsSourceEdgesByPlane3(cylinder(),plane3(1n,1n,0n,'-1/2')),input=parts(source),c=cap(sewnFaces(sewNurbsPlaneSplitFaces3(source,input,1))),value=AlgebraicReal.fromRational(7n).sqrt().affine('1/4','1/4');let overlaps=0,other=0;
 for(const use of c.loops.flat()){const e=c.source.topology.edges[use.edge]!.curve,a=sewnNurbsPlaneSplitEdgePoint3(e,e.lower),b=sewnNurbsPlaneSplitEdgePoint3(e,e.upper);if(a.z.compare(b.z)===0)continue;const r=partitionSewnNurbsSplitEdgeByAlgebraicPlane3(e,{normal:point3(1n,0n,0n),offset:value.neg()});if(a.x.compare(value)===0){overlaps++;assert.ok(r.intervals.every(v=>v.sign===0));assert.ok(r.vertices.every(v=>v.sign===0));}else {other++;assert.ok(r.intervals.every(v=>v.sign===-1));assert.ok(r.vertices.every(v=>v.sign===-1));}}
 for(const r of input)if(r.kind==='built')for(const edge of r.source.source.edges)if(edge.kind==='matched'){const p=edge.parameterization.span;assert.equal(p.weight.gcd(p.x).gcd(p.y).gcd(p.z).degree,0);}
 assert.equal(overlaps,1);assert.equal(other,1);
});
test('trim inverse intersects both coordinate norm equations before selecting the actual branches',async()=>{
 const {nurbsTrimPointParameters3}=await import('../dist/geometry/nurbs-plane-cell-rational-map3.js');
 const span={index:0,startParameter:new Rational(-10n),endParameter:new Rational(10n),x:new Polynomial([1n,0n,-1n]),y:new Polynomial([0n,2n]),z:new Polynomial(),weight:new Polynomial([1n,0n,1n])},a=AlgebraicReal.fromRational(7n).sqrt().affine('1/4','1/4'),b=AlgebraicReal.fromRational(7n).sqrt().affine('-1/4','1/4'),roots=nurbsTrimPointParameters3(span,a,b);
 assert.equal(roots.length,1);assert.equal(roots[0]!.polynomial.degree,2);assert.equal(roots[0]!.sign(),-1);assert.equal(roots[0]!.rationalFunction(span.x,span.weight).compare(a),0);assert.equal(roots[0]!.rationalFunction(span.y,span.weight).compare(b),0);assert.equal(nurbsTrimPointParameters3(span,a,a).length,0);
 const rational=nurbsTrimPointParameters3(span,AlgebraicReal.fromRational(1n),AlgebraicReal.fromRational(0n));assert.equal(rational.length,1);assert.equal(rational[0]!.rational?.toString(),'0');
});
test('joint coordinate inversion preserves constants, poles and empty preimages',async()=>{
 const {nurbsBoundaryCoordinatesRoots3}=await import('../dist/geometry/nurbs-intersection-boundary-nodes3.js'),real=(s:string)=>AlgebraicReal.fromRational(s),span={index:0,startParameter:new Rational(0n),endParameter:new Rational(1n),x:new Polynomial([0n,1n]),y:new Polynomial(),z:new Polynomial([0n,2n]),weight:new Polynomial([0n,1n])};
 assert.equal(nurbsBoundaryCoordinatesRoots3(span,[{key:'x',value:real('1')},{key:'z',value:real('2')}]),null);assert.equal(nurbsBoundaryCoordinatesRoots3(span,[{key:'x',value:real('2')}])?.length,0);
 const nonconstant={...span,x:new Polynomial([0n,0n,1n])};assert.equal(nurbsBoundaryCoordinatesRoots3(nonconstant,[{key:'x',value:real('0')}])?.length,0);const roots=nurbsBoundaryCoordinatesRoots3(nonconstant,[{key:'x',value:real('1/2')},{key:'z',value:real('2')}]);assert.equal(roots?.length,1);assert.equal(roots![0]!.rational?.toString(),'1/2');
});
