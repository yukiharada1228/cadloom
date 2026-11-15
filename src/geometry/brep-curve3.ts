import {snapshotCurve3,curveEndpoints3,pointOnCurve3,curveOnSurface3,reverseCurve3} from './curve3.js';
import type {Curve3} from './curve3.js';
import type {Surface3} from './surface3.js';
import type {Point3} from './point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {assertOwnedCylinderIntersectionArc3,pointOnCylinderIntersectionArc3} from './cylinder-cylinder3.js';
import type {CylinderIntersectionArc3} from './cylinder-cylinder3.js';
import {cylinderIntersectionArcOnSurface3} from './cylinder-intersection-support3.js';
import {buildBRepTopologyWithAdapter3} from './brep-topology3.js';
import type {BRepFaceInput3,BRepTopology3} from './brep-topology3.js';

/** Native bounded analytic geometry plus owned algebraic cylinder SSI arcs.
 * Native BodyRecord codecs do not yet accept this mixed edge type.
 */
export type BRepCurve3=
 | {readonly kind:'native';readonly curve:Curve3}
 | {readonly kind:'cylinder-ssi';readonly arc:CylinderIntersectionArc3;readonly direction:1|-1};
export function nativeBRepCurve3(curve:Curve3):BRepCurve3{return Object.freeze({kind:'native',curve:snapshotCurve3(curve)});}
export function cylinderIntersectionBRepCurve3(arc:CylinderIntersectionArc3,direction:1|-1=1):BRepCurve3 {
  assertOwnedCylinderIntersectionArc3(arc);if(direction!==1&&direction!==-1)throw new RangeError('SSI edge direction must be +1 or -1');return Object.freeze({kind:'cylinder-ssi',arc,direction});
}
export function snapshotBRepCurve3(input:BRepCurve3):BRepCurve3 {
  switch(input.kind){case 'native':return nativeBRepCurve3(input.curve);case 'cylinder-ssi':return cylinderIntersectionBRepCurve3(input.arc,input.direction);default:throw new RangeError('Unknown BRep curve kind');}
}
export function brepCurveEndpoints3(input:BRepCurve3):readonly [AlgebraicCoordinates3,AlgebraicCoordinates3] {
  const c=snapshotBRepCurve3(input);return c.kind==='native'?curveEndpoints3(c.curve):Object.freeze(c.direction===1?[c.arc.start,c.arc.end]:[c.arc.end,c.arc.start]);
}
export function pointOnBRepCurve3(point:Point3|AlgebraicCoordinates3,input:BRepCurve3):boolean {
  const c=snapshotBRepCurve3(input);return c.kind==='native'?pointOnCurve3(point,c.curve):pointOnCylinderIntersectionArc3(point,c.arc);
}
export function brepCurveOnSurface3(input:BRepCurve3,surface:Surface3):boolean {
  const c=snapshotBRepCurve3(input);return c.kind==='native'?curveOnSurface3(c.curve,surface):cylinderIntersectionArcOnSurface3(c.arc,surface);
}
export function reverseBRepCurve3(input:BRepCurve3):BRepCurve3 {
  const c=snapshotBRepCurve3(input);return c.kind==='native'?nativeBRepCurve3(reverseCurve3(c.curve)):cylinderIntersectionBRepCurve3(c.arc,c.direction===1?-1:1);
}
/** Explicit edge sharing with whole-curve support certificates. Incidence only:
 * does not certify bounded face domains, orientation/embedding or material.
 */
export function buildMixedBRepTopology3(edges:readonly BRepCurve3[],faces:readonly BRepFaceInput3[]):BRepTopology3<BRepCurve3> {
  return buildBRepTopologyWithAdapter3(edges,faces,{snapshot:snapshotBRepCurve3,endpoints:brepCurveEndpoints3,onSurface:brepCurveOnSurface3,closed:c=>c.kind==='cylinder-ssi'?c.arc.base.fullCircle:c.curve.kind==='circular-arc'?c.curve.arc.fullCircle:c.curve.kind==='elliptic-arc'?c.curve.arc.fullEllipse:c.curve.kind==='planar-arc'&&c.curve.arc.arc.fullCircle});
}
