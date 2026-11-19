/**
 * Public API of body queries (M4): prepared bodies and certified bounds, point-in-face, point classification
 * against solids, ray picking, nearest points and distances, edge lengths and face areas.
 * Formal model: formal/CadloomFormal/Query.lean.
 */
export { type Periodicity, type FaceDomain, type PreparedBody, type BodyInput, type BodyBounds, periodicity, prepareBody, bodyBounds } from './domain.ts';
export { type EdgeCrossing, type CrossingCount, edgeCrossing, crossingCount } from './crossing.ts';
export { axisGap, boxDistanceSq, canPrune, rayBoxRange } from './box.ts';
export { type PointClass, type FacePointClass, type EdgeFoot, edgeDistance, pointInFace } from './face.ts';
export {
  type RayTransition,
  type RayFaceHit,
  type RayFaceOverlap,
  type RayBodyHit,
  type RayBodyResult,
  type ClassifyOptions,
  type PointClassification,
  RAY_DIRECTIONS,
  rayBody,
  classifyPoint,
  transitionsAlternate,
} from './classify.ts';
export { SAMPLE_GRID, type BodyClosestPoint, closestPointOnBody, distancePointBody } from './distance.ts';
export { GL_POINTS, AREA_REL_TOL, MAX_AREA_DEPTH, MAX_AREA_PIECES, edgeLength, faceArea } from './measure.ts';
