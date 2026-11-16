import test from 'node:test';
import assert from 'node:assert/strict';
import {algebraicCoordinates3,point3,planeFrame3,ellipse3,ellipticArc3,interiorPointOnEllipticArc3,locatePointOnEllipticArc3,AlgebraicReal,Polynomial} from '../dist/index.js';
import {algebraicQuadraticPoint3} from '../dist/geometry/algebraic-point3.js';
test('elliptic witnesses use exact phase signs for coupled quadratic endpoints in every quadrant and direction',()=>{
 const origin=point3(2n,-1n,3n),u=point3(1n,1n,0n),v=point3(0n,1n,1n),ellipse=ellipse3(planeFrame3(origin,u,v),1n,1n),one=new Polynomial([1n]);
 const points=([[1n,1n],[-1n,1n],[-1n,-1n],[1n,-1n]] as const).map(([x,y])=>algebraicQuadraticPoint3(AlgebraicReal.fromRational(0n),[new Polynomial([origin.x]),new Polynomial([origin.y]),new Polynomial([origin.z])],point3(x,x+y,y),new Polynomial(['1/2']),one));
 for(let i=0;i<points.length;i++)for(let j=0;j<points.length;j++)if(i!==j)for(const direction of ['cw','ccw'] as const){
  const arc=ellipticArc3(ellipse,points[i]!,points[j]!,{direction}),witness=interiorPointOnEllipticArc3(arc);assert.equal(locatePointOnEllipticArc3(witness,arc),'interior');assert.equal(interiorPointOnEllipticArc3(arc),witness);assert.throws(()=>interiorPointOnEllipticArc3({...arc,end:algebraicCoordinates3(99n,99n,99n)}),RangeError);
 }
});
