/** Exact arithmetic and exact geometric predicates (public API of `src/exact`). */
export {
  DYADIC_ZERO,
  addDyadic,
  compareDyadic,
  doubleFields,
  dyadic,
  dyadicEquals,
  dyadicFromNumber,
  dyadicToFraction,
  mulDyadic,
  negDyadic,
  signDyadic,
  subDyadic,
  type DoubleFields,
  type Dyadic,
  type Sign,
} from './dyadic.ts';
export {
  ORIENT2D_ERRBOUND,
  ORIENT3D_ERRBOUND,
  orient2d,
  orient2dExact,
  orient2dFilter,
  orient3d,
  orient3dExact,
  orient3dFilter,
} from './predicates.ts';
export { INCIRCLE_ERRBOUND, incircle, incircleExactOnly, incircleFilter, incircleSign } from './incircle.ts';
