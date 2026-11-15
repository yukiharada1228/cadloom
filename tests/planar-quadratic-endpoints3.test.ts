import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,planeFrame3,prepareRectangleFace3,partitionPlanarFaceByCylinders3,pointOnEllipse3,curveEndpoints3} from '../dist/index.js';
import {getQuadraticParameterization3} from '../dist/geometry/algebraic-point3.js';
import {pointInPlaneFrame3} from '../dist/geometry/plane-frame3.js';
test('irrational events from one disjoint circle retain a shared quadratic chart on the other circle',()=>{
 const frame=planeFrame3(point3(0n,0n,-1n),point3(0n,1n),point3(1n,0n)),face=prepareRectangleFace3(frame,-3n,3n,-3n,6n),Z=point3(0n,0n,1n),part=partitionPlanarFaceByCylinders3(face,[cylinder3(line3(point3(0n,0n),Z),3n),cylinder3(line3(point3(4n,0n),Z),1n)],[plane3(1n,1n,1n,-1n)]);
 let checked=0;
 for(const cell of part.cells)for(const curve of cell.boundary){if(curve.kind!=='elliptic-arc')continue;for(const p of curveEndpoints3(curve)){const chart=getQuadraticParameterization3(p);if(!chart||chart.parameter.rational!==null)continue;assert.equal(pointOnEllipse3(p,curve.arc.ellipse),true);assert.equal(pointInPlaneFrame3(part.frame,p)!.x.compare(chart.parameter),0);for(const k of ['x','y','z'] as const)assert.ok(p[k].polynomial.degree<=2*chart.parameter.polynomial.degree);checked++;}}
 assert.ok(checked>0,'fixture must construct nonrational shared quadratic endpoint charts');
});
