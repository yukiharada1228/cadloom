/** Public API of the NURBS curve fundamentals (M0). */
export {
  type Knots,
  validateKnots,
  knotDomain,
  isClamped,
  knotMultiplicity,
  findSpan,
  clampedUniformKnots,
} from './knots.ts';
export { basisFuns, dersBasisFuns } from './basis.ts';
export {
  type ControlPoint,
  type BSplineCurve,
  type NurbsCurve,
  createBSplineCurve,
  createNurbsCurve,
  isRational,
  curveDomain,
  homogeneousPoints,
  deBoorPoint,
  evaluateCurve,
  evaluateCurveBasis,
  curveDerivatives,
} from './curve.ts';
export { insertKnot, refineKnots } from './insert.ts';
export { type BezierSplit, deCasteljau, subdivideBezier } from './bezier.ts';
