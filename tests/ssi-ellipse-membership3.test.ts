import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,point3,line3,cylinder3,plane3,intersectCylinders3,intersectPlaneCylinder3,evaluateCylinderIntersectionArc3,pointOnArc3,algebraicPoint3,locatePointInEllipse3,algebraicCoordinates3} from '../dist/index.js';
import {getBiparameterization3} from '../dist/geometry/algebraic-point3.js';
test('genuine biparametric SSI points use exact cylinder-section ellipse membership',()=>{
 const O=point3(0n,0n),a=cylinder3(line3(O,point3(0n,0n,1n)),1n),b=cylinder3(line3(O,point3(1n,0n)),4n),g=intersectCylinders3(a,b);assert.equal(g.kind,'bounded');if(g.kind!=='bounded')return;
 const q=algebraicPoint3(O,point3(1n,1n),AlgebraicReal.fromRational('1/2').sqrt()),arc=g.arcs.find(a=>a.branch===1&&pointOnArc3(q,a.base))!;assert.ok(arc);const p=evaluateCylinderIntersectionArc3(arc,q);assert.ok(getBiparameterization3(p));
 const hit=intersectPlaneCylinder3(plane3(1n,-1n,0n),b);assert.equal(hit.kind,'ellipse');if(hit.kind!=='ellipse')return;
 assert.equal(locatePointInEllipse3(p,hit.ellipse),'boundary');
 const shifted=intersectPlaneCylinder3(plane3(1n,-1n,0n,1n),b);assert.equal(shifted.kind,'ellipse');if(shifted.kind==='ellipse')assert.equal(locatePointInEllipse3(p,shifted.ellipse),'outside');
 const forged=algebraicCoordinates3(p.x,p.y,p.z.affine(2n));assert.equal(locatePointInEllipse3(forged,hit.ellipse),'outside');
});
