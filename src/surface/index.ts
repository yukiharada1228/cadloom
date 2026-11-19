/** Public API of the analytic surfaces, their exact NURBS forms and differential geometry (M1). */
export {
  type SurfaceFrame,
  type PlaneSurface,
  type CylinderSurface,
  type ConeSurface,
  type SphereSurface,
  type TorusSurface,
  type NurbsSurface3,
  type AnalyticSurface3,
  type Surface3,
  createPlaneSurface,
  createCylinderSurface,
  createConeSurface,
  createSphereSurface,
  createTorusSurface,
  createNurbsSurface3,
} from './types.ts';
export {
  type SurfaceDerivs3,
  type FirstFundamentalForm,
  type SecondFundamentalForm,
  type SurfaceCurvature,
  evaluateSurface3,
  surfacePoint3,
  surfaceNormal3,
  curvatureFromDerivatives,
  surfaceCurvature,
  normalCurvature,
} from './evaluate.ts';
export {
  type SurfaceProjection,
  type RefineProjectionOptions,
  type RefinedProjection,
  implicitValue,
  projectPoint,
  refineProjection,
} from './implicit.ts';
export {
  type ParamBox,
  revolveCurveToNurbs,
  planeToNurbs,
  cylinderToNurbs,
  coneToNurbs,
  ruledRevolutionToNurbs,
  sphereToNurbs,
  torusToNurbs,
  surfaceToNurbs,
} from './nurbs-form.ts';
export { transformSurface3 } from './transform.ts';
