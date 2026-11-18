/**
 * Reference measures of an extruded profile.
 *
 * `prismVolume(kernel, profile, extent)` is `area × |h|` (Cavalieri: a prism, right or oblique, has the volume
 * of its cross-section times its height `h = v · n` along the plane normal). The area is the profile's Green area
 * (`profileArea`): exact in closed form for lines and arcs (up to rounding), Gauss–Legendre for NURBS segments.
 * `formal/CadloomFormal/Prism.lean` proves that the divergence-theorem volume of the faces `extrude` builds
 * (`prismDet`, for polygonal wires, any reference point, any extrusion vector) is exactly `h` times the
 * shoelace area (`prism_volume`), which is what `polyhedronMass` computes in exact arithmetic.
 *
 * Upstream consulted (for the quantities, not translated): `solidcore/crates/solidcore/src/prism/measure.rs`
 * (the measures of an extruded region), `solidcore/crates/solidcore/src/mass/integrator.rs` — SolidCraft /
 * solidcore, Apache-2.0 OR MIT.
 */
import { invalidInput, ok, type Result } from '../core/error.ts';
import type { Kernel } from '../core/kernel.ts';
import type { Vec3 } from '../math/vec.ts';
import { profileArea, type Profile } from '../profile/profile.ts';
import { extrusionOf } from './extrude.ts';

/** The volume of `profile` extruded by `extent` (a distance along the normal or a vector): `area × |v · n|`. */
export function prismVolume(kernel: Kernel, profile: Profile, extent: number | Vec3): Result<number> {
  const e = extrusionOf(kernel, profile.plane, extent);
  if (!e.ok) return e;
  const a = profileArea(profile);
  if (!a.ok) return a;
  const v = a.value * Math.abs(e.value.height);
  if (!Number.isFinite(v)) return invalidInput('prism.prismVolume', 'volume is not finite');
  return ok(v);
}
