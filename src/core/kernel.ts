/**
 * Tolerances of a kernel session (upstream `Tolerances`, SMLib `SM_*_TOL_*`).
 * There is no global state: every operation that needs a tolerance takes a `Kernel`.
 */
export interface Tolerances {
  /** Points closer than this are coincident (`SM_ZONE_TOL_3D`). */
  readonly zoneTol3d: number;
  /** Gap / intersection tolerance (`2 * zone`). */
  readonly xsectTol3d: number;
  /** Approximation tolerance (`zone / 2`). */
  readonly approxTol3d: number;
  /** Maximum angle between parallel vectors, in degrees. */
  readonly angTolDeg: number;
}

export interface Kernel {
  readonly tolerances: Tolerances;
}

export function defaultTolerances(zone = 1e-5): Tolerances {
  return Object.freeze({ zoneTol3d: zone, xsectTol3d: 2 * zone, approxTol3d: zone / 2, angTolDeg: 0.5 });
}

export function createKernel(tolerances: Partial<Tolerances> = {}): Kernel {
  return Object.freeze({ tolerances: Object.freeze({ ...defaultTolerances(), ...tolerances }) });
}
