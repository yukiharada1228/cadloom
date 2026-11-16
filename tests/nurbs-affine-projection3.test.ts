import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,point3,nurbsSurface3,evaluateNurbsSurface3,insertNurbsSurfaceKnot3,reverseNurbsSurface3,certifyNurbsSurfaceAffineProjection3,nurbsAffineProjectionParameters3,locateAffineProjectedNurbsSurface3} from '../dist/index.js';
import type {NurbsSurface3} from '../dist/index.js';
const K=[0n,0n,1n,1n],K2=[0n,0n,0n,1n,1n,1n],q=(n:bigint,d=1n)=>new Rational(n,d),r=(s:bigint|string|Rational)=>AlgebraicReal.fromRational(s);
function certificate(s:NurbsSurface3){const result=certifyNurbsSurfaceAffineProjection3(s);assert.equal(result.kind,'certified');if(result.kind!=='certified')throw new Error('Expected a certificate');assert.ok(Object.isFrozen(result.certificate)&&Object.isFrozen(result.certificate.u)&&Object.isFrozen(result.certificate.v));return result.certificate;}
const saddle=()=>nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],K,K);
// S=(u,v,uv/(1+u)), using nonconstant positive rational homogeneous weights.
const weighted=()=>nurbsSurface3(2,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3('1/3',0n,0n),point3('1/3',1n,'1/3')],[point3(1n,0n,0n),point3(1n,1n,'1/2')]],K2,K,[[1n,1n],[q(3n,2n),q(3n,2n)],[2n,2n]]);
test('nonlinear graphs have an exact global parameter inverse and checked image membership',()=>{
 const c=certificate(saddle());for(const u of [q(0n),q(1n,3n),q(1n)])for(const v of [q(0n),q(2n,5n),q(1n)]){const p=point3(u,v,u.mul(v)),uv=nurbsAffineProjectionParameters3(c,p);assert.equal(uv.u.compare(r(u)),0);assert.equal(uv.v.compare(r(v)),0);assert.equal(locateAffineProjectedNurbsSurface3(c,p),u.sign()===0||u.equals(q(1n))||v.sign()===0||v.equals(q(1n))?'boundary':'inside');}assert.equal(locateAffineProjectedNurbsSurface3(c,point3('1/2','1/2',1n)),'outside');assert.equal(locateAffineProjectedNurbsSurface3(c,point3(2n,'1/2',1n)),'outside');
});
test('nullspace discovery finds oblique left inverses with huge translations and algebraic points',()=>{
 const base=weighted(),T=q(10n**30n),s=nurbsSurface3(base.degreeU,base.degreeV,base.controlPoints.map(row=>row.map(p=>point3(p.x.add(p.z).add(T),p.y.add(p.z.mul(q(2n))).sub(T),p.z.add(T.mul(q(2n)))))),base.knotsU,base.knotsV,base.weights),c=certificate(s),u=r('1/2').sqrt(),v=r('1/3'),z=u.mul(v).div(u.add(r(1n))),p={x:u.add(z).add(r(T)),y:v.add(z.mul(r(2n))).sub(r(T)),z:z.add(r(T.mul(q(2n))))},uv=nurbsAffineProjectionParameters3(c,p);assert.equal(uv.u.compare(u),0);assert.equal(uv.v.compare(v),0);assert.equal(locateAffineProjectedNurbsSurface3(c,p),'inside');assert.equal(c.u.normal.x.toString(),'1');assert.equal(c.u.normal.z.toString(),'-1');assert.equal(c.u.offset.toString(),T.toString());assert.equal(c.v.normal.z.toString(),'-2');assert.equal(c.v.offset.toString(),T.mul(q(5n)).toString());
 const off={x:p.x.add(r(1n)),y:p.y.add(r(2n)),z:p.z.add(r(1n))},candidate=nurbsAffineProjectionParameters3(c,off);assert.equal(candidate.u.compare(u),0);assert.equal(candidate.v.compare(v),0);assert.equal(locateAffineProjectedNurbsSurface3(c,off),'outside');
});
test('knot refinement, reversal and tiny parameter domains preserve exact affine recovery',()=>{
 const s=weighted(),refined=insertNurbsSurfaceKnot3(s,'u','1/2',2),c=certificate(refined),p=evaluateNurbsSurface3(s,'1/3','2/5');assert.equal(nurbsAffineProjectionParameters3(c,p).u.compare(r('1/3')),0);const reverse=certificate(reverseNurbsSurface3(s,'u'));assert.equal(nurbsAffineProjectionParameters3(reverse,p).u.compare(r('2/3')),0);assert.equal(locateAffineProjectedNurbsSurface3(reverse,p),'inside');
 const h=q(1n,10n**40n),tiny=nurbsSurface3(s.degreeU,s.degreeV,s.controlPoints,[0n,0n,0n,h,h,h],s.knotsV,s.weights),t=certificate(tiny);assert.equal(nurbsAffineProjectionParameters3(t,p).u.compare(r(h.div(q(3n)))),0);assert.equal(locateAffineProjectedNurbsSurface3(t,p),'inside');assert.equal(locateAffineProjectedNurbsSurface3(t,point3(2n,'1/5','2/15')),'outside');
});
test('continuous creases remain embedded while discontinuous height seams cannot be certified',()=>{
 const make=(z:readonly bigint[])=>nurbsSurface3(1,1,[0n,1n,1n,2n].map((x,i)=>[point3(x,0n,z[i]!),point3(x,1n,z[i]!)]),[0n,0n,1n,1n,2n,2n],K),crease=certificate(make([0n,0n,0n,1n]));assert.equal(locateAffineProjectedNurbsSurface3(crease,point3(1n,'1/2',0n)),'inside');const jump=certifyNurbsSurfaceAffineProjection3(make([0n,0n,1n,1n]));assert.equal(jump.kind,'not-certified');if(jump.kind==='not-certified')assert.equal(jump.reason,'discontinuous-seam');
});
test('failure of this sufficient certificate is not a claim that a surface is invalid',()=>{
 const cylinder=nurbsSurface3(2,1,[[point3(1n,0n,0n),point3(1n,0n,1n)],[point3(1n,1n,0n),point3(1n,1n,1n)],[point3(0n,1n,0n),point3(0n,1n,1n)]],K2,K,[[1n,1n],[1n,1n],[2n,2n]]),curved=certifyNurbsSurfaceAffineProjection3(cylinder);assert.equal(curved.kind,'not-certified');if(curved.kind==='not-certified')assert.equal(curved.reason,'no-affine-projection');const fold=nurbsSurface3(2,1,[0n,'1/2',0n].map(x=>[point3(x,0n,0n),point3(x,1n,0n)]),K2,K);assert.equal(certifyNurbsSurfaceAffineProjection3(fold).kind,'not-certified');
});
test('certificates require factory ownership and structural surfaces are resnapshotted',()=>{
 const s=saddle(),c=certificate({...s,startU:q(-999n)});assert.equal(c.surface.startU.toString(),'0');assert.throws(()=>nurbsAffineProjectionParameters3({...c},point3(0n,0n,0n)),/factory/);assert.throws(()=>locateAffineProjectedNurbsSurface3({...c},point3(0n,0n,0n)),/factory/);assert.throws(()=>certifyNurbsSurfaceAffineProjection3({...s,weights:s.weights.map((row,i)=>row.map((w,j)=>i===0&&j===0?q(-1n):w))}),/positive/);
});
