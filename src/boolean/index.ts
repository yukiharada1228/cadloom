/**
 * M5 boolean operations: face/face intersection and imprinting (`face-intersect.ts`, `imprint.ts`), fragment
 * classification (`classify.ts`), the selection table (`select.ts`) and the regularized operations with
 * assembly by heal (`boolean.ts`). Formal models: formal/CadloomFormal/Imprint.lean, formal/CadloomFormal/Boolean.lean.
 *
 * Upstream consulted: `solidcore/crates/solidcore/src/boolean/` (api_brep, merge, topology_intersector),
 * `intersect/point_class.rs`, `solidcore/docs/booleans.md` — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
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
} from './face-intersect.ts';
export {
  type EdgeCut,
  type FaceImprint,
  type EdgeSource,
  type Fragment,
  type ImprintedBody,
  type ImprintPair,
  brepCounts,
  imprintBody,
  imprintBodies,
} from './imprint.ts';
export {
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
} from './select.ts';
export {
  type FragmentSample,
  type FragmentClassification,
  SAMPLE_GRID as FRAGMENT_SAMPLE_GRID,
  SAMPLE_TRIES,
  CHECKS_PER_REGION,
  fragmentSamples,
  fragmentRegions,
  classifyFragments,
} from './classify.ts';
export {
  type FaceOrigin,
  type BooleanStats,
  type FragmentRecord,
  type BooleanSolid,
  type BooleanEmpty,
  type BooleanResult,
  booleanOp,
  union,
  intersect,
  subtract,
} from './boolean.ts';
