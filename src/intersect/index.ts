/**
 * Public API of the M4 intersection code: curve/curve and curve/surface (`curve-curve.ts`,
 * `curve-surface.ts`) and surface/surface (`surface-surface.ts` with its closed forms in
 * `ssi-exact.ts`). Every answer is `exact` (a closed form decided the components), `certified`
 * (a proof-pruned search plus a measured deviation) or a refusal by name (`refusal` /
 * `refusalReason`). The shared result types live in `types.ts`.
 * Formal models: formal/CadloomFormal/IntersectCurve.lean, formal/CadloomFormal/IntersectSurface.lean.
 */
export {
  type IntersectionClass,
  type ContactKind,
  type ParamRange,
  type SurfaceParam,
  type Certificate,
  type CurveCurvePoint,
  type CurveCurveOverlap,
  type CurveCurveHit,
  type CurveSurfacePoint,
  type CurveSurfaceOverlap,
  type CurveSurfaceHit,
  type IntersectionResult,
  type SsiPolyline,
  type SurfaceSurfaceCurve,
  type SurfaceSurfacePoint,
  type SurfaceSurfaceHit,
  type SurfaceIntersection,
  type RefusalReason,
  combineClass,
  intersectionResult,
  refusal,
  refusalReason,
} from './types.ts';
export {
  CURVE_PAIR_BUDGET,
  CURVE_MAX_DEPTH,
  type IntersectLimits,
  searchLimits,
  type LineCurve2,
  type CircleCurve2,
  type NurbsCurve2,
  type Curve2,
  cramer2,
  circlePlaneAngles,
  krawczykContracts,
  intersectCurves,
  intersectCurves2,
  liftCurve2,
} from './curve-curve.ts';
export { SURFACE_PAIR_BUDGET, krawczyk1, linePlaneParam, quadraticRoots, intersectCurveSurface, intersectRay } from './curve-surface.ts';
export { type ParamDomain, type SurfacePatch, type SsiOptions, surfacePatch } from './ssi-types.ts';
export { intersectSurfacesExact, planePlanePoint } from './ssi-exact.ts';
export { intersectSurfaces, marchSurfaces } from './surface-surface.ts';
