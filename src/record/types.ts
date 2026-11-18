/**
 * The B-rep record: a body as versioned, JSON-safe plain data (geometry as data, no maths).
 *
 * A record mirrors the kernel's arena `Brep` (src/topology/brep.ts) field by field, with the geometry pulled
 * out into its own arenas so that it is plain data:
 *
 * - `vertices[i] = { p: [x, y, z] }`;
 * - `curves`, `surfaces`: tagged unions (`kind`) of the M1 `Curve3` / `Surface3` fields, frames as
 *   `{ normal, xAxis, yAxis }` triples; NURBS as `{ degree, knots, points, weights? }`;
 * - `pcurves`: 2D NURBS curves (`points` are `[u, v]`);
 * - `edges[i] = { curve, t0, t1, start, end }` (`curve` indexes `curves`);
 * - `coedges[i] = { edge, reversed, loop, next, prev, pcurve? }` (`pcurve` indexes `pcurves`). The kernel's
 *   `partner` link is not stored: like upstream's record (one record per logical use, "the mated halves a
 *   kernel keeps at run time left for it to rebuild"), it is derived when the body is built;
 * - `loops[i] = { face, first }`, `faces[i] = { shell, surface, loops, reversed }`,
 *   `shells[i] = { body, faces }`, `bodies[i] = { shells }`.
 *
 * Numbers. Every number of a record is a finite double (JSON holds no `NaN` or `Infinity`); `parseRecord`
 * rejects any other value. Decision: `-0` is normalised to `0` on parse, because JSON text cannot keep the
 * sign of zero (`JSON.stringify(-0) === '0'`) and one body must have one serialisation. Indices are
 * non-negative safe integers.
 *
 * Values of type `BrepRecord` come only from `parseRecord` (and the converters that call it): the type is
 * branded, the value deeply frozen and structurally valid (see `parse.ts`). Structural validity is counts,
 * index ranges, finite numbers, tagged-union shapes and NURBS array-length consistency; it is not geometric
 * validity (orthonormal frames, positive radii, increasing knots, positive weights are the kernel's checks,
 * made by `recordToBrep` through the kernel's constructors).
 *
 * Upstream consulted (for the shape, not translated): `solidcore/crates/solidcore-record/src/brep.rs` (the
 * record as STEP-like flat data, `deny_unknown_fields`, tagged `kind` unions, the item budget, the validation
 * that "checks structure and resource budgets only ... computes no geometry"), `crates/solidcore-record/src/native.rs`
 * (a versioned envelope), `solidcore/docs/layers.md` (record: geometry as data, never any maths) —
 * SolidCraft / solidcore, Apache-2.0 OR MIT.
 */

/** The `format` tag of every record. */
export const RECORD_FORMAT = 'cadloom-brep';
/** The record version this module reads and writes. */
export const RECORD_VERSION = 1;
/**
 * The most array items (records, points, coordinates, knots, weights, index-list entries) a record may hold,
 * counted over the whole input before any array is walked (upstream `MAX_ITEMS`).
 */
export const MAX_RECORD_ITEMS = 4_000_000;
/** The highest NURBS degree a record may carry. */
export const MAX_RECORD_DEGREE = 64;

export type RecordVec2 = readonly [number, number];
export type RecordVec3 = readonly [number, number, number];

/** A right-handed orthonormal frame as stored (`yAxis = normal × xAxis` is the kernel's check). */
export interface FrameRecord {
  readonly normal: RecordVec3;
  readonly xAxis: RecordVec3;
  readonly yAxis: RecordVec3;
}

export interface LineCurveRecord {
  readonly kind: 'line';
  readonly origin: RecordVec3;
  readonly direction: RecordVec3;
  readonly range: RecordVec2;
}
export interface CircleCurveRecord {
  readonly kind: 'circle';
  readonly center: RecordVec3;
  readonly frame: FrameRecord;
  readonly radius: number;
  readonly range: RecordVec2;
}
export interface EllipseCurveRecord {
  readonly kind: 'ellipse';
  readonly center: RecordVec3;
  readonly frame: FrameRecord;
  readonly majorRadius: number;
  readonly minorRadius: number;
  readonly range: RecordVec2;
}
/** A 3D NURBS curve: `knots.length === points.length + degree + 1`, `weights` (if any) one per point. */
export interface NurbsCurveRecord {
  readonly kind: 'nurbs';
  readonly degree: number;
  readonly knots: readonly number[];
  readonly points: readonly RecordVec3[];
  readonly weights?: readonly number[];
}
export type CurveRecord = LineCurveRecord | CircleCurveRecord | EllipseCurveRecord | NurbsCurveRecord;

export interface PlaneSurfaceRecord { readonly kind: 'plane'; readonly origin: RecordVec3; readonly frame: FrameRecord }
export interface CylinderSurfaceRecord {
  readonly kind: 'cylinder';
  readonly origin: RecordVec3;
  readonly frame: FrameRecord;
  readonly radius: number;
}
export interface ConeSurfaceRecord {
  readonly kind: 'cone';
  readonly origin: RecordVec3;
  readonly frame: FrameRecord;
  readonly baseRadius: number;
  readonly semiAngle: number;
}
export interface SphereSurfaceRecord {
  readonly kind: 'sphere';
  readonly center: RecordVec3;
  readonly frame: FrameRecord;
  readonly radius: number;
}
export interface TorusSurfaceRecord {
  readonly kind: 'torus';
  readonly center: RecordVec3;
  readonly frame: FrameRecord;
  readonly majorRadius: number;
  readonly minorRadius: number;
}
/**
 * A 3D NURBS surface: `points[i][j]`, `i` along u (`knotsU.length === rows + degreeU + 1`), `j` along v
 * (`knotsV.length === columns + degreeV + 1`); `weights`, if any, has the shape of `points`.
 */
export interface NurbsSurfaceRecord {
  readonly kind: 'nurbs';
  readonly degreeU: number;
  readonly degreeV: number;
  readonly knotsU: readonly number[];
  readonly knotsV: readonly number[];
  readonly points: readonly (readonly RecordVec3[])[];
  readonly weights?: readonly (readonly number[])[];
}
export type SurfaceRecord =
  | PlaneSurfaceRecord
  | CylinderSurfaceRecord
  | ConeSurfaceRecord
  | SphereSurfaceRecord
  | TorusSurfaceRecord
  | NurbsSurfaceRecord;

/** A 2D NURBS curve in a face's `(u, v)`. */
export interface PcurveRecord {
  readonly degree: number;
  readonly knots: readonly number[];
  readonly points: readonly RecordVec2[];
  readonly weights?: readonly number[];
}

export interface VertexRecord { readonly p: RecordVec3 }
export interface EdgeRecord {
  readonly curve: number;
  readonly t0: number;
  readonly t1: number;
  readonly start: number;
  readonly end: number;
}
export interface CoedgeRecord {
  readonly edge: number;
  readonly reversed: boolean;
  readonly loop: number;
  readonly next: number;
  readonly prev: number;
  readonly pcurve?: number;
}
export interface LoopRecord { readonly face: number; readonly first: number }
export interface FaceRecord {
  readonly shell: number;
  readonly surface: number;
  readonly loops: readonly number[];
  readonly reversed: boolean;
}
export interface ShellRecord { readonly body: number; readonly faces: readonly number[] }
export interface BodyRecord { readonly shells: readonly number[] }

/** The plain data of a record (what `parseRecord` reads). */
export interface BrepRecordData {
  readonly format: typeof RECORD_FORMAT;
  readonly version: typeof RECORD_VERSION;
  readonly vertices: readonly VertexRecord[];
  readonly curves: readonly CurveRecord[];
  readonly surfaces: readonly SurfaceRecord[];
  readonly pcurves: readonly PcurveRecord[];
  readonly edges: readonly EdgeRecord[];
  readonly coedges: readonly CoedgeRecord[];
  readonly loops: readonly LoopRecord[];
  readonly faces: readonly FaceRecord[];
  readonly shells: readonly ShellRecord[];
  readonly bodies: readonly BodyRecord[];
}

declare const recordBrand: unique symbol;
/** A structurally valid, deeply frozen record. Made only by `parseRecord`; the brand is type-only. */
export type BrepRecord = BrepRecordData & { readonly [recordBrand]: true };
