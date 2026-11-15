import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,point2,point3,planeFrame3,mapPlanePoint3,pointInPlaneFrame3,algebraicPoint2} from '../dist/index.js';
import {getPointParameterization2} from '../dist/geometry/algebraic-point2.js';
test('repeated inverse charts preserve affine correlation but copied coordinates cannot forge provenance',()=>{
 const frame=planeFrame3(point3(1n,2n,3n),point3(1n,1n),point3(0n,1n,1n)),s=AlgebraicReal.fromRational(2n).sqrt(),q=algebraicPoint2(point2(1n,2n),point2(3n,-1n),s),p=mapPlanePoint3(frame,q);
 for(let i=0;i<4;i++){const r=pointInPlaneFrame3(frame,p)!;assert.equal(r.x.compare(q.x),0);assert.equal(r.y.compare(q.y),0);assert.ok(getPointParameterization2(r));}
 const copied:any={...p};const r=pointInPlaneFrame3(frame,copied)!;assert.equal(r.x.compare(q.x),0);assert.equal(r.y.compare(q.y),0);assert.equal(getPointParameterization2(r),undefined);
 copied.x=copied.x.add(AlgebraicReal.fromRational(1n));assert.equal(pointInPlaneFrame3(frame,copied),null);copied.x=p.x;assert.equal(pointInPlaneFrame3(frame,copied)!.x.compare(q.x),0);
});
test('mutable frame and point inputs are resnapshotted and singular copied frames still reject',()=>{
 const frame:any={origin:point3(0n,0n),u:point3(2n,0n),v:point3(0n,3n)},p:any={x:new Rational(4n),y:new Rational(9n),z:new Rational(0n)},check=(x:bigint,y:bigint)=>{const q=pointInPlaneFrame3(frame,p)!;assert.equal(q.x.compare(AlgebraicReal.fromRational(x)),0);assert.equal(q.y.compare(AlgebraicReal.fromRational(y)),0);};
 check(2n,3n);p.x=new Rational(8n);check(4n,3n);p.z=new Rational(1n);assert.equal(pointInPlaneFrame3(frame,p),null);p.z=new Rational(0n);frame.u=point3(4n,0n);check(2n,3n);frame.origin=point3(0n,0n,1n);assert.equal(pointInPlaneFrame3(frame,p),null);p.z=new Rational(1n);check(2n,3n);
 const owned=planeFrame3(frame.origin,frame.u,frame.v);frame.v=point3(8n,0n);assert.throws(()=>pointInPlaneFrame3(frame,p),/independent/);assert.equal(pointInPlaneFrame3(owned,p)!.y.compare(AlgebraicReal.fromRational(3n)),0);const copy:any={...owned};copy.v=copy.u;assert.throws(()=>pointInPlaneFrame3(copy,p),/independent/);
});
