/** Floating-point vector algebra (upstream `math`). Values are immutable plain objects. */
export interface Vec2 { readonly x: number; readonly y: number }
export interface Vec3 { readonly x: number; readonly y: number; readonly z: number }
export type Point2 = Vec2;
export type Point3 = Vec3;

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });
export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const point3 = vec3;

export const add3 = (a: Vec3, b: Vec3): Vec3 => vec3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub3 = (a: Vec3, b: Vec3): Vec3 => vec3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale3 = (a: Vec3, s: number): Vec3 => vec3(a.x * s, a.y * s, a.z * s);
export const dot3 = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross3 = (a: Vec3, b: Vec3): Vec3 =>
  vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length3 = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const distance3 = (a: Vec3, b: Vec3): number => length3(sub3(a, b));
/** `(1 - t) a + t b`. */
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 =>
  vec3((1 - t) * a.x + t * b.x, (1 - t) * a.y + t * b.y, (1 - t) * a.z + t * b.z);

/** Unit vector, or `undefined` for a zero or non-finite vector. */
export function normalize3(a: Vec3): Vec3 | undefined {
  const len = length3(a);
  if (!(len > 0) || !Number.isFinite(len)) return undefined;
  return scale3(a, 1 / len);
}

export const isFinite3 = (a: Vec3): boolean =>
  Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z);
