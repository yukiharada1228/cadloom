/** Public API of prisms (M3): linear extrusion of planar profiles, the shared prism layout and reference measures. */
export { type ExtrudeOptions, type Extrusion, extrude, extrusionOf } from './extrude.ts';
export {
  type EdgeGeom,
  type PrismLayout,
  type PrismSide,
  type PrismSideEdges,
  buildPrismRegion,
  placeSegment,
  segmentNurbs3,
} from './layout.ts';
export { prismVolume } from './measure.ts';
