export * from './core/error.ts';
export * from './core/kernel.ts';
export * from './math/vec.ts';
export * from './math/transform.ts';
export * from './exact/index.ts';
export * from './nurbs/index.ts';
export * from './topology/index.ts';
export * from './primitive/index.ts';
export * from './mass/index.ts';
export * from './curve/index.ts';
export * from './surface/index.ts';
export * from './record/index.ts';
export * from './convert/index.ts';
export * from './tess/index.ts';
export * from './profile/index.ts';
export * from './prism/index.ts';
export * from './sweep/index.ts';
/*
 * M4 interval layer. The generic interval arithmetic names (`add`, `mul`, `hull`, ...) are
 * exported with an `interval` prefix here; inside `src/interval` they keep their short names.
 */
export {
  type Interval,
  interval,
  point as pointInterval,
  isBounded as intervalIsBounded,
  contains as intervalContains,
  containsInterval as intervalContainsInterval,
  width as intervalWidth,
  midpoint as intervalMidpoint,
  magnitude as intervalMagnitude,
  neg as intervalNeg,
  add as intervalAdd,
  sub as intervalSub,
  mul as intervalMul,
  scale as intervalScale,
  sqr as intervalSqr,
  div as intervalDiv,
  sqrt as intervalSqrt,
  hull as intervalHull,
  intersect as intervalIntersect,
  expand as intervalExpand,
  bisect as intervalBisect,
  hullOf as intervalHullOf,
} from './interval/interval.ts';
export {
  UNIT_ROUNDOFF,
  gamma,
  nextUp,
  nextDown,
  twoSum,
  twoProduct,
  addDown,
  addUp,
  subDown,
  subUp,
  mulDown,
  mulUp,
  divDown,
  divUp,
  sqrtDown,
  sqrtUp,
} from './interval/float.ts';

export { TRIG_PAD, ACOS_PAD, sinInterval, cosInterval, tanInterval, acosUp, acosDown, atanUp } from './interval/trig.ts';
export {
  type IVec3,
  type Box3,
  type Box2,
  ivec3,
  ivecOfPoint,
  ivAdd,
  ivSub,
  ivScale,
  ivScaleVec,
  ivDot,
  ivCross,
  ivNormSq,
  ivContainsZero,
  boxOfIVec,
  ivecOfBox,
  boxAxis,
  box3,
  box2,
  box3OfPoints,
  box2OfPoints,
  boxesOverlap3,
  boxesOverlap2,
  boxesDisjoint3,
  boxesDisjoint2,
  unionBox3,
  unionBox2,
  intersectBox3,
  expandBox3,
  expandBox2,
  box3Contains,
  box2Contains,
  box3ContainsBox,
  box3Diagonal,
  lineBoxRange,
} from './interval/box.ts';
export { type SubPatch, spanWindow, boundNurbsCurve, boundNurbsSurface, subPatch, homogeneousPartials } from './interval/nurbs-hull.ts';
export { boundCurve, boundCurveDerivative, nurbsCurveAsSurface, boundSurface, pointBox } from './interval/bound.ts';
export { type NormalCone, coneOfDirections, boundNormalCone, normalConesSeparated } from './interval/normal-cone.ts';
export * from './intersect/index.ts';
export * from './query/index.ts';
/*
 * M5 heal (sewing, face merging, redundant vertices) and booleans. The set operations keep their short names
 * inside `src/boolean`; at the root they carry a `boolean` prefix (`intersect` would read as a geometric
 * intersection next to `intersectCurves` / `intersectSurfaces`, and `union` / `subtract` are as generic).
 */
export * from './heal/index.ts';
export {
  type BodySide,
  type EndContact,
  type PieceEnd,
  type IntersectionPiece,
  type FaceFaceDisjoint,
  type FaceFaceCurves,
  type FaceFaceCoincident,
  type FaceFaceIntersection,
  faceFaceIntersection,
  type EdgeCut,
  type FaceImprint,
  type EdgeSource,
  type Fragment,
  type ImprintedBody,
  type ImprintPair,
  brepCounts,
  imprintBody,
  imprintBodies,
  type BooleanOp,
  type FragmentLabel,
  type OperandSide,
  type SelectAction,
  BOOLEAN_OPS,
  FRAGMENT_LABELS,
  OPERAND_SIDES,
  SELECTION,
  LABEL_SIDES,
  selectAction,
  opEval,
  sideModelAction,
  type FragmentSample,
  type FragmentClassification,
  FRAGMENT_SAMPLE_GRID,
  SAMPLE_TRIES as FRAGMENT_SAMPLE_TRIES,
  CHECKS_PER_REGION,
  fragmentSamples,
  fragmentRegions,
  classifyFragments,
  type FaceOrigin,
  type BooleanStats,
  type FragmentRecord,
  type BooleanSolid,
  type BooleanEmpty,
  type BooleanResult,
  booleanOp,
  union as booleanUnion,
  intersect as booleanIntersect,
  subtract as booleanSubtract,
} from './boolean/index.ts';
