import {point3} from '../geometry/point3.js';
import {algebraicPoint3,algebraicCoordinates3,getPointParameterization3} from '../geometry/algebraic-point3.js';
import {getPointParameterization2,algebraicCoordinates2,algebraicPoint2} from '../geometry/algebraic-point2.js';
import type {AlgebraicCoordinates2} from '../geometry/algebraic-point2.js';
import {circle2} from '../geometry/circle2.js';
import {point2} from '../geometry/point2.js';
import {circularArc2} from '../geometry/circular-arc2.js';
import {circle3,circularArc3} from '../geometry/circle3.js';
import {ellipse3,ellipticArc3} from '../geometry/ellipse3.js';
import {plane3} from '../geometry/plane3.js';
import {line3,cylinder3} from '../geometry/surface3.js';
import type {Surface3} from '../geometry/surface3.js';
import {planeFrame3,planarArc3,lineInterval3,snapshotCurve3} from '../geometry/curve3.js';
import type {Curve3,PlaneFrame3} from '../geometry/curve3.js';
import {algebraicSegment3} from '../geometry/algebraic-segment3.js';
import {nurbsCurve3} from '../geometry/nurbs-curve3.js';
import type {NurbsCurve3} from '../geometry/nurbs-curve3.js';
import {nurbsSurface3} from '../geometry/nurbs-surface3.js';
import type {NurbsSurface3} from '../geometry/nurbs-surface3.js';
import {encodeRationalPoint3,decodeRationalPoint3,encodeExactReal3,decodeExactReal3,encodeExactPoint3,decodeExactPoint3} from './exact3.js';
import {RecordReader3} from '../record/schema.js';
import {curveSchema3,surfaceSchema3} from '../record/geometry3.js';
import type {FrameRecord3,CurveRecord3,SurfaceRecord3} from '../record/geometry3.js';
import type {ExactPointRecord3} from '../record/exact3.js';

export type RecordCurveGeometry3=Curve3|Readonly<{kind:'nurbs';curve:NurbsCurve3}>;
export type RecordSurfaceGeometry3=Surface3|Readonly<{kind:'nurbs';surface:NurbsSurface3}>;
const encodeFrame=(f:PlaneFrame3):FrameRecord3=>Object.freeze({origin:encodeRationalPoint3(f.origin),u:encodeRationalPoint3(f.u),v:encodeRationalPoint3(f.v)});
const decodeFrame=(f:FrameRecord3)=>planeFrame3(decodeRationalPoint3(f.origin),decodeRationalPoint3(f.u),decodeRationalPoint3(f.v));
function encodePoint2(p:AlgebraicCoordinates2):ExactPointRecord3 {const a=getPointParameterization2(p);return encodeExactPoint3(a?algebraicPoint3(point3(a.origin.x,a.origin.y,0n),point3(a.direction.x,a.direction.y,0n),a.parameter):algebraicCoordinates3(p.x,p.y,0n));}
function decodePoint2(p:ExactPointRecord3):AlgebraicCoordinates2 {const q=decodeExactPoint3(p);if(q.z.sign()!==0)throw new RangeError('A planar-circle local endpoint must have z=0');const a=getPointParameterization3(q);return a?algebraicPoint2(point2(a.origin.x,a.origin.y),point2(a.direction.x,a.direction.y),a.parameter):algebraicCoordinates2(q.x,q.y);}
export function encodeCurveRecord3(input:RecordCurveGeometry3):CurveRecord3 {
  if(input.kind==='nurbs'){const c=nurbsCurve3(input.curve.degree,input.curve.controlPoints,input.curve.knots,input.curve.weights);return Object.freeze({kind:'nurbs',degree:c.degree,points:Object.freeze(c.controlPoints.map(encodeRationalPoint3)),weights:Object.freeze(c.weights.map(w=>w.toString())),knots:Object.freeze(c.knots.map(k=>k.toString()))});}
  const c=snapshotCurve3(input);
  switch(c.kind){
    case 'line':return Object.freeze({kind:'line',origin:encodeRationalPoint3(c.interval.line.origin),direction:encodeRationalPoint3(c.interval.line.direction),start:encodeExactReal3(c.interval.startParameter),end:encodeExactReal3(c.interval.endParameter)});
    case 'algebraic-segment':return Object.freeze({kind:'segment',start:encodeExactPoint3(c.segment.start),end:encodeExactPoint3(c.segment.end)});
    case 'circular-arc':{const a=c.arc;return Object.freeze({kind:'circle',center:encodeRationalPoint3(a.circle.center),normal:encodeRationalPoint3(a.circle.normal),radiusSquared:a.circle.radiusSquared.toString(),start:encodeExactPoint3(a.start),end:encodeExactPoint3(a.end),direction:a.direction,full:a.fullCircle});}
    case 'elliptic-arc':{const a=c.arc;return Object.freeze({kind:'ellipse',frame:encodeFrame(a.ellipse.frame),radiusUSquared:a.ellipse.radiusUSquared.toString(),radiusVSquared:a.ellipse.radiusVSquared.toString(),start:encodeExactPoint3(a.start),end:encodeExactPoint3(a.end),direction:a.direction,full:a.fullEllipse});}
    case 'planar-arc':{const a=c.arc.arc;return Object.freeze({kind:'planar-circle',frame:encodeFrame(c.arc.frame),center:Object.freeze([a.circle.center.x.toString(),a.circle.center.y.toString()] as const),radiusSquared:a.circle.radiusSquared.toString(),start:encodePoint2(a.start),end:encodePoint2(a.end),direction:a.direction,full:a.fullCircle});}
  }
}
/** Geometry construction checks happen here, not in the structural record reader. */
export function decodeCurveRecord3(input:CurveRecord3):RecordCurveGeometry3 {
  const c=curveSchema3(input,'curve',new RecordReader3()) as CurveRecord3;
  switch(c.kind){
    case 'line':return Object.freeze({kind:'line',interval:lineInterval3(line3(decodeRationalPoint3(c.origin),decodeRationalPoint3(c.direction)),decodeExactReal3(c.start),decodeExactReal3(c.end))});
    case 'segment':return Object.freeze({kind:'algebraic-segment',segment:algebraicSegment3(decodeExactPoint3(c.start),decodeExactPoint3(c.end))});
    case 'circle':return Object.freeze({kind:'circular-arc',arc:circularArc3(circle3(decodeRationalPoint3(c.center),decodeRationalPoint3(c.normal),c.radiusSquared),decodeExactPoint3(c.start),decodeExactPoint3(c.end),{direction:c.direction,fullCircle:c.full})});
    case 'ellipse':return Object.freeze({kind:'elliptic-arc',arc:ellipticArc3(ellipse3(decodeFrame(c.frame),c.radiusUSquared,c.radiusVSquared),decodeExactPoint3(c.start),decodeExactPoint3(c.end),{direction:c.direction,fullEllipse:c.full})});
    case 'planar-circle':return Object.freeze({kind:'planar-arc',arc:planarArc3(decodeFrame(c.frame),circularArc2(circle2(point2(c.center[0],c.center[1]),c.radiusSquared),decodePoint2(c.start),decodePoint2(c.end),{direction:c.direction,fullCircle:c.full}))});
    case 'nurbs':return Object.freeze({kind:'nurbs',curve:nurbsCurve3(c.degree,c.points.map(decodeRationalPoint3),c.knots,c.weights)});
  }
}
export function encodeSurfaceRecord3(input:RecordSurfaceGeometry3):SurfaceRecord3 {
  switch(input.kind){
    case 'plane':{const p=plane3(input.plane.normal.x,input.plane.normal.y,input.plane.normal.z,input.plane.offset);return Object.freeze({kind:'plane',normal:encodeRationalPoint3(p.normal),offset:p.offset.toString()});}
    case 'cylinder':{const c=cylinder3(input.cylinder.axis,input.cylinder.radiusSquared);return Object.freeze({kind:'cylinder',origin:encodeRationalPoint3(c.axis.origin),direction:encodeRationalPoint3(c.axis.direction),radiusSquared:c.radiusSquared.toString()});}
    case 'nurbs':{const a=input.surface,s=nurbsSurface3(a.degreeU,a.degreeV,a.controlPoints,a.knotsU,a.knotsV,a.weights);return Object.freeze({kind:'nurbs',degreeU:s.degreeU,degreeV:s.degreeV,points:Object.freeze(s.controlPoints.map(row=>Object.freeze(row.map(encodeRationalPoint3)))),weights:Object.freeze(s.weights.map(row=>Object.freeze(row.map(w=>w.toString())))),knotsU:Object.freeze(s.knotsU.map(x=>x.toString())),knotsV:Object.freeze(s.knotsV.map(x=>x.toString()))});}
  }
}
export function decodeSurfaceRecord3(input:SurfaceRecord3):RecordSurfaceGeometry3 {
  const s=surfaceSchema3(input,'surface',new RecordReader3()) as SurfaceRecord3;
  switch(s.kind){
    case 'plane':return Object.freeze({kind:'plane',plane:plane3(s.normal[0],s.normal[1],s.normal[2],s.offset)});
    case 'cylinder':return Object.freeze({kind:'cylinder',cylinder:cylinder3(line3(decodeRationalPoint3(s.origin),decodeRationalPoint3(s.direction)),s.radiusSquared)});
    case 'nurbs':return Object.freeze({kind:'nurbs',surface:nurbsSurface3(s.degreeU,s.degreeV,s.points.map(row=>row.map(decodeRationalPoint3)),s.knotsU,s.knotsV,s.weights)});
  }
}
