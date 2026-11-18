/** Public API of the NURBS fundamentals: curves (M0), surfaces, surface knot insertion and degree elevation (M1). */
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
  reverseNurbsCurve,
  deBoorPoint,
  evaluateCurve,
  evaluateCurveBasis,
  curveDerivatives,
  MAX_DERIVATIVE_ORDER,
} from './curve.ts';
export { insertKnot, refineKnots } from './insert.ts';
export { type BezierSplit, deCasteljau, subdivideBezier } from './bezier.ts';
export {
  type ControlNet,
  type BSplineSurface,
  type NurbsSurface,
  type SurfaceDirection,
  type SurfaceDomain,
  type SurfaceDerivatives,
  createBSplineSurface,
  createNurbsSurface,
  isRationalSurface,
  surfaceDomain,
  homogeneousNet,
  evaluateSurface,
  evaluateSurfaceBasis,
  surfaceDerivatives,
  surfaceNormal,
  unitNormalFromPartials,
  isoparametricCurve,
  directionCurves,
  surfaceFromDirectionCurves,
} from './surface.ts';
export { mapDirectionCurves, insertKnotSurface, refineKnotsSurface } from './surface-insert.ts';
export {
  MAX_ELEVATED_DEGREE,
  elevateBezier,
  elevationMatrix,
  elevateCurveDegree,
  elevateSurfaceDegree,
} from './elevate.ts';
