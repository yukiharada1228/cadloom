/**
 * M5 healing: sewing a face soup into a closed B-rep, merging faces on one surface, removing redundant
 * vertices. See the module comments of `sew.ts`, `orient.ts`, `shells.ts`, `merge.ts` and `union-find.ts`.
 *
 * Upstream consulted: `solidcore/crates/solidcore/src/heal/` (stitch, gap, heal_data, face_props),
 * `topology/brep_constructor.rs` — SolidCraft / solidcore, Apache-2.0 OR MIT.
 */
export { type HealIssue, healError, healIssue } from './error.ts';
export { mergeLabels, disjointSets, clusterPoints, type PointClusters } from './union-find.ts';
export { type EdgeUsePair, type Orientation, usesOpposite, propagateOrientation } from './orient.ts';
export { type Plan, type PlanEdge, type PlanCoedge, type PlanFace, buildPlan, planOfBrep, flipPlanFace } from './plan.ts';
export { type ShellLayout, layoutShells } from './shells.ts';
export {
  type SoupEdgePiece,
  type SoupFace,
  type FaceSoup,
  type SewOptions,
  type GapReport,
  type SewResult,
  EDGE_SAMPLE_FRACTIONS,
  sewFaces,
  sewFacesReport,
  faceSoupOfBrep,
} from './sew.ts';
export {
  type MergeOptions,
  surfacesCoincide,
  mergedLoopCount,
  mergeCoplanarFaces,
  mergeCosurfaceFaces,
  removeRedundantVertices,
} from './merge.ts';
