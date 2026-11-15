import test from 'node:test';
import {AlgebraicReal,classifyPointToSurface3} from '../dist/index.js';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,planeFrame3,prepareRectangleFace3,partitionPlanarFaceByCylinders3,pointOnEllipse3,curveEndpoints3} from '../dist/index.js';
import {getQuadraticParameterization3,getPointParameterization3} from '../dist/geometry/algebraic-point3.js';
import {getAlgebraicAxialCoordinates3} from '../dist/geometry/algebraic-axial-point3.js';
import {pointInPlaneFrame3} from '../dist/geometry/plane-frame3.js';
test('irrational events from one disjoint circle retain a shared quadratic chart on the other circle',()=>{
 const frame=planeFrame3(point3(0n,0n,-1n),point3(0n,1n),point3(1n,0n)),face=prepareRectangleFace3(frame,-3n,3n,-3n,6n),Z=point3(0n,0n,1n),part=partitionPlanarFaceByCylinders3(face,[cylinder3(line3(point3(0n,0n),Z),3n),cylinder3(line3(point3(4n,0n),Z),1n)],[plane3(1n,1n,1n,-1n)]);
 let checked=0;
 for(const cell of part.cells)for(const curve of cell.boundary){if(curve.kind!=='elliptic-arc')continue;for(const p of curveEndpoints3(curve)){const chart=getQuadraticParameterization3(p);if(!chart||chart.parameter.rational!==null)continue;assert.equal(pointOnEllipse3(p,curve.arc.ellipse),true);assert.equal(pointInPlaneFrame3(part.frame,p)!.x.compare(chart.parameter),0);for(const k of ['x','y','z'] as const)assert.ok(p[k].polynomial.degree<=2*chart.parameter.polynomial.degree);checked++;}}
 assert.ok(checked>0,'fixture must construct nonrational shared quadratic endpoint charts');
});

test('rational line graph endpoints retain one irrational abscissa field across unrelated circle events',()=>{
 const frame=planeFrame3(point3(0n,0n),point3(1n,0n),point3(0n,1n)),face=prepareRectangleFace3(frame,-3n,3n,-3n,3n),line=plane3(1n,-1n,0n),part=partitionPlanarFaceByCylinders3(face,[cylinder3(line3(point3(0n,0n),point3(0n,0n,1n)),2n)],[line]),root=AlgebraicReal.fromRational(2n).sqrt();let checked=0;
 for(const cell of part.cells)for(const curve of cell.boundary){if(curve.kind!=='algebraic-segment')continue;for(const p of curveEndpoints3(curve)){if(p.x.compare(root)!==0||p.y.compare(root)!==0)continue;const chart=getPointParameterization3(p);assert.ok(chart);assert.equal(chart.parameter.rational,null);const axial=getAlgebraicAxialCoordinates3(p,part.frame.v);assert.ok(axial);const base=pointInPlaneFrame3(part.frame,axial.base)!,local=pointInPlaneFrame3(part.frame,p)!;assert.equal(base.x.compare(local.x),0);assert.equal(base.y.sign(),0);assert.equal(classifyPointToSurface3(p,{kind:'plane',plane:line}),0);for(const k of ['x','y','z'] as const)assert.ok(p[k].polynomial.degree<=chart.parameter.polynomial.degree);checked++;}}
 assert.ok(checked>0,'fixture must create the line point (sqrt(2),sqrt(2),0) at an unrelated circle event');
});
