import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,nurbsSurface3,nurbsCurve3,prepareNurbsParameterDomain2,certifyNurbsSurfaceAffineProjection3,createAffineNurbsFace3,locateAffineNurbsFace3,affineNurbsFacePoint3,intersectAffineNurbsFacePlane3,plane3,AlgebraicReal,compareAlgebraicPoints3,evaluateNurbsSurfaceBoundaryPiece3,trimmedNurbsSectionEdgePoint3} from '../dist/index.js';
const K=[0n,0n,1n,1n];
function rectangle(a='0',b='0',c='1',d='1',cw=false){const p=[[a,b],[c,b],[c,d],[a,d]] as [string,string][];if(cw)p.reverse();return p.map((q,i)=>nurbsCurve3(1,[point3(q[0],q[1],0n),point3(p[(i+1)%4]![0],p[(i+1)%4]![1],0n)],K));}
const saddle=()=>nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],K,K);
function certificate(s=saddle()){const r=certifyNurbsSurfaceAffineProjection3(s);if(r.kind!=='certified')throw Error('Expected certificate');return r.certificate;}
const domain=()=>prepareNurbsParameterDomain2(rectangle(),[rectangle('2/5','2/5','3/5','3/5',true)]);
test('embedded face combines support equality, hole membership and lifted closed boundary loops',()=>{
 const f=createAffineNurbsFace3(certificate(),domain());assert.ok(Object.isFrozen(f)&&Object.isFrozen(f.boundaries)&&f.boundaries.every(Object.isFrozen));assert.equal(f.boundaries.length,2);assert.equal(locateAffineNurbsFace3(f,f.sample),'inside');
 for(const [u,v,z,where] of [['1/4','1/4','1/16','inside'],['1/2','1/2','1/4','outside'],['2/5','1/2','1/5','boundary'],['0','1/2','0','boundary'],['1/4','1/4','0','outside'],['2','1/2','1','outside']] as const)assert.equal(locateAffineNurbsFace3(f,point3(u,v,z)),where);
 for(const ring of f.boundaries)for(let i=0;i<ring.length;i++){const a=ring[i]!,b=ring[(i+1)%ring.length]!,last=a.pieces.length-1;assert.equal(compareAlgebraicPoints3(evaluateNurbsSurfaceBoundaryPiece3(a,last,a.pieces[last]!.endParameter),evaluateNurbsSurfaceBoundaryPiece3(b,0,b.pieces[0]!.startParameter)),0);}
 const a=AlgebraicReal.fromRational('1/2').sqrt(),p=affineNurbsFacePoint3(f,a,'1/4');assert.equal(locateAffineNurbsFace3(f,p),'inside');assert.equal(p.z.compare(a.affine('1/4')),0);assert.throws(()=>affineNurbsFacePoint3(f,'1/2','1/2'),/outside/);
});
test('plane sections preserve disjoint trimmed intervals and exact spatial membership',()=>{
 const f=createAffineNurbsFace3(certificate(),domain()),s=intersectAffineNurbsFacePlane3(f,plane3(0n,1n,0n,'-1/2'));assert.equal(s.edges.length,2);assert.equal(s.vertices.length,4);assert.equal(s.curveComponents.length,2);assert.equal(s.areas.length,0);
 for(const e of s.edges){const t=e.arc.lower.add(e.arc.upper).affine('1/2'),p=trimmedNurbsSectionEdgePoint3(s,s.edges.indexOf(e),t);assert.equal(locateAffineNurbsFace3(f,p),'inside');assert.equal(p.y.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(p.z.compare(p.x.affine('1/2')),0);}
});
test('a curved outer boundary leaving the support is rejected even when all endpoints fit',()=>{
 const r=rectangle('0','0','1','1/2');r[2]=nurbsCurve3(2,[point3(1n,'1/2',0n),point3('1/2',2n,0n),point3(0n,'1/2',0n)],[0n,0n,0n,1n,1n,1n]);const d=prepareNurbsParameterDomain2(r);assert.throws(()=>createAffineNurbsFace3(certificate(),d),/domain/);
 const good=prepareNurbsParameterDomain2(rectangle('1/4','1/4','3/4','3/4'));assert.equal(locateAffineNurbsFace3(createAffineNurbsFace3(certificate(),good),point3('1/2','1/2','1/4')),'inside');
});
test('domain geometry is revalidated and copied certificates or faces cannot confer ownership',()=>{
 const c=certificate(),d=domain(),f=createAffineNurbsFace3(c,{...d,locate:()=> 'inside',sample:{u:AlgebraicReal.fromRational(0n).lower,v:AlgebraicReal.fromRational(0n).lower}});assert.equal(locateAffineNurbsFace3(f,point3('1/2','1/2','1/4')),'outside');assert.equal(locateAffineNurbsFace3(f,f.sample),'inside');assert.throws(()=>createAffineNurbsFace3({...c},d),/factory/);assert.throws(()=>locateAffineNurbsFace3({...f},point3(0n,0n,0n)),/factory/);assert.throws(()=>affineNurbsFacePoint3({...f},0n,0n),/factory/);assert.throws(()=>intersectAffineNurbsFacePlane3({...f},plane3(0n,0n,1n)),/factory/);
 const reversed=prepareNurbsParameterDomain2(rectangle('0','0','1','1',true),[],-1),back=createAffineNurbsFace3(c,reversed);assert.equal(back.domain.sense,-1);assert.equal(locateAffineNurbsFace3(back,point3('1/2','1/2','1/4')),'inside');
});

test('C0 creases retain separate lifted pieces while the embedded face remains connected',()=>{
 const s=nurbsSurface3(1,1,[0n,1n,1n,2n].map((x,i)=>[point3(x,0n,i===3?1n:0n),point3(x,1n,i===3?1n:0n)]),[0n,0n,1n,1n,2n,2n],K),f=createAffineNurbsFace3(certificate(s),prepareNurbsParameterDomain2(rectangle('0','0','2','1')));
 assert.ok(f.boundaries[0]!.some(b=>b.pieces.length===2));assert.equal(locateAffineNurbsFace3(f,point3(1n,'1/2',0n)),'inside');assert.equal(locateAffineNurbsFace3(f,point3('3/2','1/2','1/2')),'inside');const cut=intersectAffineNurbsFacePlane3(f,plane3(0n,1n,0n,'-1/2'));assert.equal(cut.edges.length,2);assert.equal(cut.vertices.length,3);assert.equal(cut.curveComponents.length,1);
});
test('spatial getters are snapshotted once before support and trim checks',()=>{
 const f=createAffineNurbsFace3(certificate(),domain()),p=point3('1/4','1/4','1/16'),reads={x:0,y:0,z:0},input={get x(){reads.x++;return p.x;},get y(){reads.y++;return p.y;},get z(){reads.z++;return p.z;}};
 assert.equal(locateAffineNurbsFace3(f,input),'inside');assert.deepEqual(reads,{x:1,y:1,z:1});
});
