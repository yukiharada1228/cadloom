/** Public API of the analytic curves and their exact NURBS forms (M1). */
export {
  type CurveFrame,
  type LineCurve,
  type CircleCurve,
  type EllipseCurve,
  type NurbsCurve3,
  type Curve3,
  storedFrameMismatch,
  createCurveFrame,
  createLineCurve,
  createSegmentCurve,
  createCircleCurve,
  createEllipseCurve,
  createNurbsCurve3,
  curveRange,
} from './types.ts';
export {
  type CurveDerivs3,
  type FrenetFrame,
  evaluateCurve3,
  curvePoint3,
  curveTangent,
  curveCurvature,
  curveFrenetFrame,
} from './evaluate.ts';
export { curveArcLength } from './length.ts';
export {
  type UnitArcNet,
  unitArcNet,
  unitArcAngleOfParam,
  unitArcParamOfAngle,
  rationalQuadraticArc,
  circleArcToNurbs,
  ellipseArcToNurbs,
  lineToNurbs,
  curveToNurbs,
} from './conic.ts';
export { type ClosestPoint3, closestPointOnCurve, lineProjectionParam } from './closest.ts';
export { conicFromConjugateAxes, transformCurve3 } from './transform.ts';
