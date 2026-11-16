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
test('material-oriented plane wires put cube material on the left and reverse with the plane normal',()=>{
 const m=materialOf(sewn(cube(true))),a=wires(assembled(m,plane3(0n,0n,1n,'-1/2'))),b=wires(assembled(m,plane3(0n,0n,-1n,'1/2')));assert.equal(signedArea(a)[0]!.compare(AlgebraicReal.fromRational(2n)),0);assert.equal(signedArea(b)[0]!.compare(AlgebraicReal.fromRational(-2n)),0);assert.equal(a.edges.length,4);assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.wires[0]!.uses));
});
test('cavity and island wire directions follow physical face senses instead of arbitrary graph traversal',()=>{
 const scaled=(scale:string,shift:string,reverse=false)=>transformCube(cube(true),p=>{const f=(v:Rational)=>v.mul(Rational.parse(scale)).add(Rational.parse(shift));return point3(f(p.x),f(p.y),f(p.z));}).map(r=>reverse?buildNurbsSourceBRep3(r.complex,r.sense===1?-1:1):r),m=materialOf(sewn([...cube(true),...scaled('1/2','1/4',true),...scaled('1/4','3/8')])),c=wires(assembled(m,plane3(0n,0n,1n,'-1/2')));assert.equal(c.wires.length,3);assert.deepEqual(signedArea(c).map(x=>x.recognizeRational().rational?.toString()).sort(),['2','-1/2','1/8'].sort());
});
test('weighted curved sections certify both parameter axes and preserve orientation after reflection and replay',()=>{
 const m=materialOf(cylinder()),horizontal=wires(assembled(m,plane3(0n,0n,1n,'-1/2'))),vertical=wires(assembled(m,plane3(1n,0n,0n,'-1/2')));assert.equal(horizontal.wires.length,1);assert.equal(vertical.wires.length,1);assert.equal(signedArea(horizontal)[0]!.sign(),1);assert.equal(signedArea(vertical,'yz')[0]!.sign(),1);assert.ok(vertical.edges.some(e=>e.derivative==='u'));
 const reflection=similarityTransform3([point3(-1n,0n,0n),point3(0n,1n,0n),point3(0n,0n,1n)]),body=restoreBody3(serializeBody3(transformBody3(bodyFromNurbsMaterial3(m),reflection))),raw=intersectNurbsBodyBoundaryPlane3(body,plane3(0n,0n,1n,'-1/2'));assert.equal(raw.kind,'assembled');if(raw.kind==='assembled')assert.equal(signedArea(wires(raw))[0]!.sign(),1);
});
test('coplanar, tangent, isolated and vertex-contact cases remain unmodified but uncertified',()=>{
 const m=materialOf(sewn(cube()));for(const p of [plane3(0n,0n,1n),plane3(1n,1n,1n),plane3(1n,1n,0n),plane3(1n,1n,1n,-1n)]){const raw=assembled(m,p),q=certifyNurbsBoundaryPlaneWires3(raw);assert.equal(q.kind,'not-certified');if(q.kind==='not-certified')assert.equal(q.source,raw);}
 const tangent=certifyNurbsBoundaryPlaneWires3(assembled(materialOf(cylinder()),plane3(1n,0n,0n,-1n)));assert.equal(tangent.kind,'not-certified');const raw=assembled(m,plane3(0n,0n,1n,'-1/2'));assert.throws(()=>certifyNurbsBoundaryPlaneWires3({...raw}),/factory/);
 const empty=wires(assembled(materialOf(sewn([])),plane3(0n,0n,1n)));assert.equal(empty.wires.length,0);
});


test('implicit cap domain preserves curved boundaries and exact material membership in an oriented chart',()=>{
 const m=materialOf(cylinder()),raw=assembled(m,plane3(0n,0n,1n,'-1/2')),d=nurbsPlaneDomain3(wires(raw));
 assert.ok(dot3(cross3(d.frame.u,d.frame.v),raw.plane.normal).sign()>0);
 for(const [xyz,expected] of [[point3(0n,0n,'1/2'),'inside'],[point3(2n,0n,'1/2'),'outside'],[point3(1n,0n,'1/2'),'boundary']] as const){const uv=pointInPlaneFrame3(d.frame,xyz);assert.ok(uv);assert.equal(locateNurbsPlaneDomain3(d,uv).kind,expected);}
 for(const [edge,e] of raw.edges.entries()){const part=e.section.edges[e.edge]!,uv=nurbsPlaneDomainEdgePoint3(d,edge,part.lower),p=mapPlanePoint3(d.frame,uv),q=raw.vertices[e.from]!.point;assert.equal(compareAlgebraicPoints3(p,q),0);}
 const y=AlgebraicReal.isolate(new Polynomial([-3n,0n,4n]))[1]!,irrational=algebraicCoordinates3(AlgebraicReal.fromRational('1/2'),y,AlgebraicReal.fromRational('1/2')),local=pointInPlaneFrame3(d.frame,irrational);assert.ok(local);assert.equal(locateNurbsPlaneDomain3(d,local).kind,'boundary');assert.equal(compareAlgebraicPoints3(mapPlanePoint3(d.frame,local),irrational),0);
 const retry=locateNurbsPlaneDomain3(d,point2(0n,0n),{maxDirections:1,directions:[point3(1n,0n,0n)]});assert.equal(retry.kind,'unresolved');
 assert.throws(()=>nurbsPlaneDomain3({...d.boundary}),/factory/);assert.throws(()=>locateNurbsPlaneDomain3({...d},point2(0n,0n)),/factory/);
});
test('implicit cap domain retains cavity and island membership under an oblique chart',()=>{
 const scaled=(scale:string,shift:string,reverse=false)=>transformCube(cube(),p=>{const f=(v:Rational)=>v.mul(Rational.parse(scale)).add(Rational.parse(shift));return point3(f(p.x),f(p.y),f(p.z));}).map(r=>reverse?buildNurbsSourceBRep3(r.complex,r.sense===1?-1:1):r),m=materialOf(sewn([...cube(),...scaled('1/2','1/4',true),...scaled('1/4','3/8')]));
 const raw=assembled(m,plane3(1n,0n,1n,'-11/10')),d=nurbsPlaneDomain3(wires(raw));
 for(const [t,expected] of [['3/20','inside'],['2/5','outside'],['11/20','inside'],['2','outside']] as const){const x=Rational.parse(t),p=point3(x,x,Rational.parse('11/10').sub(x)),uv=pointInPlaneFrame3(d.frame,p);assert.ok(uv);assert.equal(locateNurbsPlaneDomain3(d,uv).kind,expected);}
});
