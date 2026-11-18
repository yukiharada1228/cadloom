/**
 * How closely a display mesh follows the exact geometry: the chord tolerance (the farthest a segment or a
 * facet may stand off its curve or surface), the facet angle (the most one segment or facet may turn) and an
 * optional maximum edge length.
 *
 * A display mesh is drawn, never measured: nothing a model depends on is decided from it.
 *
 * Upstream consulted (for the rules and defaults, not translated): `solidcore/crates/solidcore-tess/src/tolerance.rs`
 * (`MeshTolerance`: a chord and a facet angle, the 20° display angle, a one-degree floor on the angle),
 * `crates/solidcore-tess/src/curve.rs` (no segment spans more than a quarter turn) — SolidCraft / solidcore,
 * Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';

/** A tolerance as given by a caller. Missing fields take the defaults of `defaultMeshTolerance`. */
export interface MeshTolerance {
  /** Maximum distance of a segment or facet from its curve or surface (model units), `> 0`. */
  readonly chord: number;
  /** Maximum turn of the tangent / normal over one segment or facet, in degrees, `> 0`. */
  readonly angleDeg: number;
  /** Optional maximum length of a boundary segment and grid step, `> 0`. */
  readonly maxEdgeLength?: number;
}

/** The display facet angle of upstream (`DISPLAY_ANGLE`): 20 degrees. */
export const DISPLAY_ANGLE_DEG = 20;
/** The finest facet angle used (upstream `MIN_DISPLAY_ANGLE`): one degree. */
export const MIN_ANGLE_DEG = 1;
/** The coarsest facet angle used: a quarter turn (upstream: a segment never spans more than a quarter turn). */
export const MAX_ANGLE_DEG = 90;
/** The default chord tolerance as a multiple of the kernel's `zoneTol3d` (0.01 for the default zone 1e-5). */
export const DEFAULT_CHORD_ZONES = 1000;

/** The tolerance the mesher works with: validated, with the angle in radians. */
export interface MeshRules {
  readonly chord: number;
  /** The facet angle in radians, in `[1°, 90°]`. */
  readonly angle: number;
  /** `Infinity` when no maximum edge length is given. */
  readonly maxEdgeLength: number;
}

/** The default tolerance: chord `1000 * zoneTol3d`, facet angle 20°, no maximum edge length. */
export function defaultMeshTolerance(kernel: Kernel): MeshTolerance {
  return Object.freeze({ chord: DEFAULT_CHORD_ZONES * kernel.tolerances.zoneTol3d, angleDeg: DISPLAY_ANGLE_DEG });
}

/**
 * Validates a (partial) tolerance against the kernel and fills in the defaults. The chord is raised to at least
 * `zoneTol3d` (finer is meaningless), the angle is clamped into `[1°, 90°]`. Fails with `invalid-input` for a
 * non-finite or non-positive chord, angle or maximum edge length.
 */
export function meshRules(kernel: Kernel, tol: Partial<MeshTolerance> = {}): Result<MeshRules> {
  const op = 'tess.meshRules';
  const def = defaultMeshTolerance(kernel);
  const chord = tol.chord ?? def.chord;
  const angleDeg = tol.angleDeg ?? def.angleDeg;
  if (!(Number.isFinite(chord) && chord > 0)) return invalidInput(op, 'chord tolerance must be finite and positive');
  if (!(Number.isFinite(angleDeg) && angleDeg > 0)) return invalidInput(op, 'facet angle must be finite and positive');
  const maxEdge = tol.maxEdgeLength;
  if (maxEdge !== undefined && !(Number.isFinite(maxEdge) && maxEdge > 0)) {
    return invalidInput(op, 'maximum edge length must be finite and positive');
  }
  const deg = Math.min(Math.max(angleDeg, MIN_ANGLE_DEG), MAX_ANGLE_DEG);
  return ok(
    Object.freeze({
      chord: Math.max(chord, kernel.tolerances.zoneTol3d),
      angle: (deg * Math.PI) / 180,
      maxEdgeLength: maxEdge ?? Infinity,
    }),
  );
}
