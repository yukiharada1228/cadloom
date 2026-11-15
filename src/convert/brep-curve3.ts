import {encodeCurveRecord3,decodeCurveRecord3} from './geometry3.js';
import {encodeRationalPoint3,decodeRationalPoint3,encodeExactPoint3,decodeExactPoint3} from './exact3.js';
import {brepCurveSchema3} from '../record/brep-curve3.js';
import type {BRepCurveRecord3,CylinderSupportRecord3} from '../record/brep-curve3.js';
import {RecordReader3} from '../record/schema.js';
import type {RecordReadLimits3} from '../record/schema.js';
import {snapshotBRepCurve3,nativeBRepCurve3,cylinderIntersectionBRepCurve3} from '../geometry/brep-curve3.js';
import type {BRepCurve3} from '../geometry/brep-curve3.js';
import {cylinder3,line3} from '../geometry/surface3.js';
import type {Cylinder3} from '../geometry/surface3.js';
import {pointOnArc3,comparePointsOnArc3} from '../geometry/circle3.js';
import {compareAlgebraicPoints3} from '../geometry/algebraic-point3.js';
import {intersectCylinders3,evaluateCylinderIntersectionArc3,splitCylinderIntersectionArc3} from '../geometry/cylinder-cylinder3.js';
const encodeCylinder=(c:Cylinder3):CylinderSupportRecord3=>Object.freeze({origin:encodeRationalPoint3(c.axis.origin),direction:encodeRationalPoint3(c.axis.direction),radiusSquared:c.radiusSquared.toString()});
const decodeCylinder=(c:CylinderSupportRecord3)=>cylinder3(line3(decodeRationalPoint3(c.origin),decodeRationalPoint3(c.direction)),c.radiusSquared);
export function encodeBRepCurveRecord3(input:BRepCurve3):BRepCurveRecord3 {
 const c=snapshotBRepCurve3(input);if(c.kind==='native')return Object.freeze({kind:'native',curve:encodeCurveRecord3(c.curve)});
 return Object.freeze({kind:'cylinder-ssi',first:encodeCylinder(c.arc.first),second:encodeCylinder(c.arc.second),baseStart:encodeExactPoint3(c.arc.base.start),baseEnd:encodeExactPoint3(c.arc.base.end),branch:c.arc.branch,direction:c.direction});
}
/** Reconstruct a whole owned branch interval; endpoint agreement alone is insufficient. */
export function decodeBRepCurveRecord3(input:BRepCurveRecord3,limits:RecordReadLimits3={}):BRepCurve3 {
 const r=brepCurveSchema3(input,'brepCurve',new RecordReader3(limits)) as BRepCurveRecord3;
 if(r.kind==='native'){const c=decodeCurveRecord3(r.curve);if(c.kind==='nurbs')throw new RangeError('NURBS are not yet supported by mixed BRep curves');return nativeBRepCurve3(c);}
 const graph=intersectCylinders3(decodeCylinder(r.first),decodeCylinder(r.second));if(graph.kind!=='bounded')throw new RangeError('SSI curve requires nonparallel bounded cylinder intersection');
 const start=decodeExactPoint3(r.baseStart),end=decodeExactPoint3(r.baseEnd);
 const arc=graph.arcs.find(a=>a.branch===r.branch&&pointOnArc3(start,a.base)&&pointOnArc3(end,a.base)&&comparePointsOnArc3(a.base,start,end)<0);
 if(!arc)throw new RangeError('SSI interval must lie in one factory branch interval in forward base order');
 const pieces=splitCylinderIntersectionArc3(arc,[evaluateCylinderIntersectionArc3(arc,start),evaluateCylinderIntersectionArc3(arc,end)]),piece=pieces.find(a=>compareAlgebraicPoints3(a.base.start,start)===0&&compareAlgebraicPoints3(a.base.end,end)===0);
 if(!piece)throw new Error('Validated SSI interval was not reconstructed');return cylinderIntersectionBRepCurve3(piece,r.direction);
}
