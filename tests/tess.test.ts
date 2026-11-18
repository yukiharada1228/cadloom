import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/core/kernel.ts';
import { unwrap } from '../src/core/error.ts';
import { cross3, dot3, normalize3, sub3, vec2, vec3, type Point2, type Point3 } from '../src/math/vec.ts';
import { createCircleCurve, createEllipseCurve, createSegmentCurve, TWO_PI } from '../src/curve/types.ts';
import { curvePoint3 } from '../src/curve/evaluate.ts';
import { circleArcToNurbs } from '../src/curve/conic.ts';
import { createNurbsCurve3 } from '../src/curve/types.ts';
import { createNurbsCurve, type NurbsCurve } from '../src/nurbs/curve.ts';
import { createConeSurface, createCylinderSurface, createNurbsSurface3, createPlaneSurface, createSphereSurface, createTorusSurface, type Surface3 } from '../src/surface/types.ts';
import { createNurbsSurface } from '../src/nurbs/surface.ts';
import { surfaceNormal3 } from '../src/surface/evaluate.ts';
import { BOX_FACES, boxCorner } from '../src/primitive/index.ts';
import { implicitValue } from '../src/surface/implicit.ts';
import { BrepBuilder, edgeId, planePcurve, type Brep, type CoedgeUse, type EdgeId } from '../src/topology/index.ts';
import { fanVectorArea2 } from '../src/topology/polyhedron.ts';
import { buildPolyhedron } from '../src/topology/polyhedron.ts';
import { makeBox } from '../src/primitive/index.ts';
import { fanTriangles } from '../src/mass/index.ts';
import { orient2d } from '../src/exact/predicates.ts';
import {
  MAX_LINE_SEGMENTS,
  Triangulation,
  bridgeHoles,
  chordAngle,
  circleStepCount,
  curvePoints,
  defaultMeshTolerance,
  earClip,
  isConsistentlyOriented,
  isWatertight,
  loopOrientation,
  meshEdgeUseCounts,
  meshRules,
  meshSignedVolume,
  sagitta,
  sampleEdge,
  segmentsMeet,
  shoelace2,
  tessellate,
  triangulatePolygon,
  weldVertices,
  weldedTriangles,
  type Mesh,
  type MeshRules,
  type Tri,
} from '../src/tess/index.ts';
import { incircle, incircleExactOnly, incircleFilter } from '../src/exact/index.ts';

const k = createKernel();
const rules = (chord: number, angleDeg = 20, maxEdgeLength?: number): MeshRules =>
  unwrap(meshRules(k, maxEdgeLength === undefined ? { chord, angleDeg } : { chord, angleDeg, maxEdgeLength }));

/** Twice the signed area of a triangle of 2D points. */
const tri2 = (P: readonly Point2[], [a, b, c]: Tri): number => {
  const A = P[a]!, B = P[b]!, C = P[c]!;
  return (B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y);
};
const sumTri2 = (P: readonly Point2[], ts: readonly Tri[]): number => ts.reduce((s, t) => s + tri2(P, t), 0);

/** A deterministic pseudo-random sequence (tests only). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A star-shaped polygon with integer coordinates (counter-clockwise), `n` vertices. */
function starPolygon(n: number, seed: number): Point2[] {
  const rnd = lcg(seed);
  const out: Point2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (TWO_PI * i) / n;
    const r = 20 + Math.floor(rnd() * 80);
    out.push(vec2(Math.round(r * Math.cos(a)), Math.round(r * Math.sin(a))));
  }
  // Remove consecutive duplicates produced by rounding.
  return out.filter((p, i) => {
    const q = out[(i + 1) % out.length]!;
    return !(p.x === q.x && p.y === q.y);
  });
}

// ---------------------------------------------------------------------------------------------------------
// Fixtures

/** Closed cylinder of radius r, height h about +z, with a seam (as in tests/topology-geometry.test.ts). */
function cylinder(r = 2, h = 3, withPcurves = true): Brep {
  const b = new BrepBuilder();
  const shell = b.addShell(b.addBody());
  const v0 = b.addVertex(vec3(r, 0, 0));
  const v1 = b.addVertex(vec3(r, 0, h));
  const z = vec3(0, 0, 1), x = vec3(1, 0, 0);
  const bottom = unwrap(createCircleCurve(k, vec3(0, 0, 0), z, x, r));
  const top = unwrap(createCircleCurve(k, vec3(0, 0, h), z, x, r));
  const e0 = b.addEdge(v0, v0, bottom);
  const e1 = b.addEdge(v1, v1, top);
  const e2 = b.addEdge(v0, v1, unwrap(createSegmentCurve(vec3(r, 0, 0), vec3(r, 0, h))), 0, 1);
  const p0 = unwrap(createPlaneSurface(k, vec3(0, 0, 0), z, x));
  const p1 = unwrap(createPlaneSurface(k, vec3(0, 0, h), z, x));
  const f0 = b.addFace(shell, p0, true);
  b.addLoop(f0, [{ edge: e0, reversed: true, pcurve: unwrap(planePcurve(k, p0, { curve: bottom, t0: 0, t1: TWO_PI }, true)) }]);
  const f1 = b.addFace(shell, p1);
  b.addLoop(f1, [{ edge: e1, reversed: false, pcurve: unwrap(planePcurve(k, p1, { curve: top, t0: 0, t1: TWO_PI }, false)) }]);
  const cyl = unwrap(createCylinderSurface(k, vec3(0, 0, 0), z, x, r));
  const f2 = b.addFace(shell, cyl);
  const uvLine = (u0: number, v0_: number, u1: number, v1_: number): NurbsCurve =>
    unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[u0, v0_], [u1, v1_]]));
  const side: CoedgeUse[] = [
    { edge: e0, reversed: false, pcurve: uvLine(0, 0, TWO_PI, 0) },
    { edge: e2, reversed: false, pcurve: uvLine(TWO_PI, 0, TWO_PI, h) },
    { edge: e1, reversed: true, pcurve: uvLine(TWO_PI, h, 0, h) },
    { edge: e2, reversed: true, pcurve: uvLine(0, h, 0, 0) },
  ];
  b.addLoop(f2, withPcurves ? side : side.map(({ edge, reversed }) => ({ edge, reversed })));
  return b.build();
}

/**
 * A planar polyhedron whose faces may have holes: each face is a list of loops of point indices (outer loop
 * counter-clockwise from outside, holes clockwise), line edges shared by index pairs, exact plane pcurves.
 */
function planarSolid(
  points: readonly Point3[],
  faces: readonly (readonly (readonly number[])[])[],
  surfaceOf?: (face: number) => { surface: Surface3; reversed: boolean } | undefined,
): Brep {
  const b = new BrepBuilder();
  const shell = b.addShell(b.addBody());
  const vs = points.map((p) => b.addVertex(p));
  const edges = new Map<string, { id: EdgeId; start: number }>();
  for (const [fi, loops] of faces.entries()) {
    const outer = loops[0]!.map((i) => points[i]!);
    const custom = surfaceOf?.(fi);
    const n = unwrap(normalize3(fanVectorArea2(outer)) === undefined ? { ok: false, error: { kind: 'degenerate', operation: 'test' } } : { ok: true, value: normalize3(fanVectorArea2(outer))! });
    const plane = unwrap(createPlaneSurface(k, outer[0]!, n, sub3(outer[1]!, outer[0]!)));
    const f = custom === undefined ? b.addFace(shell, plane) : b.addFace(shell, custom.surface, custom.reversed);
    for (const loop of loops) {
      const uses: CoedgeUse[] = [];
      for (const [j, a] of loop.entries()) {
        const c = loop[(j + 1) % loop.length]!;
        const key = a < c ? `${a},${c}` : `${c},${a}`;
        let known = edges.get(key);
        if (known === undefined) {
          known = { id: unwrap(b.addLineEdge(vs[a]!, vs[c]!)), start: a };
          edges.set(key, known);
        }
        const reversed = known.start !== a;
        const lo = known.start, hi = known.start === a ? c : a;
        const curve = unwrap(createSegmentCurve(points[lo]!, points[hi]!));
        uses.push(custom === undefined ? { edge: known.id, reversed, pcurve: unwrap(planePcurve(k, plane, { curve, t0: 0, t1: 1 }, reversed)) } : { edge: known.id, reversed });
      }
      b.addLoop(f, uses);
    }
  }
  return b.build();
}

/**
 * A torus (R = 3, r = 1) as one face with two seams: the u-circle at v = 0 and the v-circle at u = 0, both closed
 * edges on one vertex, each used twice by the face (pcurves on v = 0 / 2π and u = 0 / 2π).
 */
function torus(R = 3, r = 1): Brep {
  const b = new BrepBuilder();
  const shell = b.addShell(b.addBody());
  const v = b.addVertex(vec3(R + r, 0, 0));
  const eu = b.addEdge(v, v, unwrap(createCircleCurve(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), R + r)));
  // S(0, v) = (R + r cos v, 0, r sin v): a circle about (R, 0, 0) with x along +x and y along +z.
  const ev = b.addEdge(v, v, unwrap(createCircleCurve(k, vec3(R, 0, 0), vec3(0, -1, 0), vec3(1, 0, 0), r)));
  const f = b.addFace(shell, unwrap(createTorusSurface(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), R, r)));
  const L = (u0: number, v0: number, u1: number, v1: number): NurbsCurve => unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[u0, v0], [u1, v1]]));
  b.addLoop(f, [
    { edge: eu, reversed: false, pcurve: L(0, 0, TWO_PI, 0) },
    { edge: ev, reversed: false, pcurve: L(TWO_PI, 0, TWO_PI, TWO_PI) },
    { edge: eu, reversed: true, pcurve: L(TWO_PI, TWO_PI, 0, TWO_PI) },
    { edge: ev, reversed: true, pcurve: L(0, TWO_PI, 0, 0) },
  ]);
  return b.build();
}

/** A square plate [0,4]² × [0,1] with a square hole [1,3]² through it (genus 1). */
function frame(): Brep {
  const P: Point3[] = [];
  const sq = (s0: number, s1: number, z: number): number[] => {
    const base = P.length;
    P.push(vec3(s0, s0, z), vec3(s1, s0, z), vec3(s1, s1, z), vec3(s0, s1, z));
    return [base, base + 1, base + 2, base + 3];
  };
  const ob = sq(0, 4, 0), ot = sq(0, 4, 1), ib = sq(1, 3, 0), it = sq(1, 3, 1);
  const faces: number[][][] = [
    // bottom (normal -z): outer clockwise seen from +z, hole counter-clockwise seen from +z
    [[ob[0]!, ob[3]!, ob[2]!, ob[1]!], [ib[0]!, ib[1]!, ib[2]!, ib[3]!]],
    // top (normal +z)
    [[ot[0]!, ot[1]!, ot[2]!, ot[3]!], [it[0]!, it[3]!, it[2]!, it[1]!]],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    faces.push([[ob[i]!, ob[j]!, ot[j]!, ot[i]!]]); // outer walls, outward
    faces.push([[ib[j]!, ib[i]!, it[i]!, it[j]!]]); // inner walls, facing the hole's axis
  }
  return planarSolid(P, faces);
}

const vertexPoint = (m: Mesh, i: number): Point3 => vec3(m.positions[3 * i]!, m.positions[3 * i + 1]!, m.positions[3 * i + 2]!);
const vertexNormal = (m: Mesh, i: number): Point3 => vec3(m.normals[3 * i]!, m.normals[3 * i + 1]!, m.normals[3 * i + 2]!);

/** Each triangle's geometric normal agrees with its vertex normals (outward when the normals are). */
function assertTrianglesFaceTheirNormals(m: Mesh): void {
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t]!, m.indices[t + 1]!, m.indices[t + 2]!];
    const n = cross3(sub3(vertexPoint(m, b), vertexPoint(m, a)), sub3(vertexPoint(m, c), vertexPoint(m, a)));
    for (const v of [a, b, c]) assert.ok(dot3(n, vertexNormal(m, v)) > 0, `triangle ${t / 3} faces against its normals`);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Tolerances

test('meshRules: defaults from the kernel, clamping, and invalid input', () => {
  const d = defaultMeshTolerance(k);
  assert.equal(d.chord, 1000 * k.tolerances.zoneTol3d);
  assert.equal(d.angleDeg, 20);
  const r = unwrap(meshRules(k));
  assert.equal(r.chord, d.chord);
  assert.ok(Math.abs(r.angle - (20 * Math.PI) / 180) < 1e-15);
  assert.equal(r.maxEdgeLength, Infinity);
  assert.equal(unwrap(meshRules(k, { chord: 1e-12 })).chord, k.tolerances.zoneTol3d);
  assert.ok(Math.abs(unwrap(meshRules(k, { angleDeg: 0.01 })).angle - Math.PI / 180) < 1e-15);
  assert.ok(Math.abs(unwrap(meshRules(k, { angleDeg: 400 })).angle - Math.PI / 2) < 1e-15);
  for (const bad of [{ chord: 0 }, { chord: NaN }, { angleDeg: -1 }, { maxEdgeLength: 0 }, { maxEdgeLength: Infinity }]) {
    const res = meshRules(k, bad);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.kind, 'invalid-input');
  }
  const box = unwrap(makeBox(k, vec3(0, 0, 0), 1, 1, 1));
  assert.equal(tessellate(k, box, { chord: -1 }).ok, false);
});

// ---------------------------------------------------------------------------------------------------------
// Box

test('box mesh: 12 triangles, watertight, consistently oriented, volume dx*dy*dz, outward normals', () => {
  const [dx, dy, dz] = [1.5, 2, 3.25];
  const m = unwrap(tessellate(k, unwrap(makeBox(k, vec3(-1, 2, 0.5), dx, dy, dz))));
  assert.equal(m.indices.length / 3, 12);
  assert.equal(m.stats.triangles, 12);
  assert.equal(m.stats.meshedFaces, 6);
  assert.equal(m.faceRanges.length, 6);
  for (const r of m.faceRanges) assert.equal(r.triangleCount, 2);
  assert.ok(isWatertight(m));
  assert.ok(isConsistentlyOriented(m));
  assert.equal(meshSignedVolume(m), dx * dy * dz);
  assertTrianglesFaceTheirNormals(m);
  // Normals point away from the centre.
  const c = vec3(-1 + dx / 2, 2 + dy / 2, 0.5 + dz / 2);
  for (let i = 0; i < m.positions.length / 3; i++) assert.ok(dot3(vertexNormal(m, i), sub3(vertexPoint(m, i), c)) > 0);
  // 8 welded corners, 18 undirected edges (12 box edges + 6 face diagonals).
  assert.equal(new Set(weldVertices(m)).size, 8);
  assert.equal(meshEdgeUseCounts(m).length, 18);
  // Edge polylines: line edges are their end points only, which are the vertex points.
  assert.equal(m.edgePolylines.length, 12);
  for (const p of m.edgePolylines) assert.equal(p.points.length, 6);
});

test('box mesh with maxEdgeLength: boundary segments split, still watertight with the exact volume', () => {
  const m = unwrap(tessellate(k, unwrap(makeBox(k, vec3(0, 0, 0), 1, 2, 3)), { maxEdgeLength: 0.5 }));
  assert.ok(isWatertight(m));
  assert.ok(Math.abs(meshSignedVolume(m) - 6) < 1e-12);
  for (const p of m.edgePolylines) {
    for (let i = 0; i + 5 < p.points.length; i += 3) {
      const d = Math.hypot(p.points[i + 3]! - p.points[i]!, p.points[i + 4]! - p.points[i + 1]!, p.points[i + 5]! - p.points[i + 2]!);
      assert.ok(d <= 0.5 + 1e-12);
    }
  }
  assert.ok(m.stats.triangles > 12);
  assertTrianglesFaceTheirNormals(m);
});

// ---------------------------------------------------------------------------------------------------------
// Cylinder

test('cylinder mesh: watertight across the seam, 4n - 4 triangles, outward normals', () => {
  const r = 2, h = 3;
  const tol = rules(0.01);
  const m = unwrap(tessellate(k, cylinder(r, h), { chord: 0.01 }));
  assert.equal(m.stats.failedFaces.length, 0);
  const n = circleStepCount(r, TWO_PI, tol).steps;
  assert.equal(m.stats.triangles, 4 * n - 4);
  assert.ok(isWatertight(m));
  assert.ok(isConsistentlyOriented(m));
  assertTrianglesFaceTheirNormals(m);
  // Side normals are radial; the bottom disc (reversed face) points down, the top up.
  for (const fr of m.faceRanges) {
    for (let i = fr.firstVertex; i < fr.firstVertex + fr.vertexCount; i++) {
      const p = vertexPoint(m, i), nv = vertexNormal(m, i);
      if (fr.face === 0) assert.deepEqual(nv, vec3(0, 0, -1));
      else if (fr.face === 1) assert.deepEqual(nv, vec3(0, 0, 1));
      else {
        const radial = vec3(p.x / r, p.y / r, 0);
        assert.ok(dot3(nv, radial) > 1 - 1e-12);
      }
    }
  }
  // The seam is drawn twice in (u, v) (u = 0 and u = 2π) but welds into one edge used once each way.
  const side = m.faceRanges[2]!;
  const ring = side.loops[0]!;
  assert.equal(ring.length, 2 * n + 2);
  const w = weldVertices(m);
  assert.equal(new Set(ring.map((v) => w[v])).size, 2 * n);
});

test('cylinder volume: within the chord bound of πr²h, equal to the inscribed prism, converging as the chord shrinks', () => {
  const r = 2, h = 3;
  const exact = Math.PI * r * r * h;
  let prevErr = Infinity;
  for (const chord of [0.1, 0.01, 0.001]) {
    const m = unwrap(tessellate(k, cylinder(r, h), { chord }));
    assert.ok(isWatertight(m));
    const v = meshSignedVolume(m);
    const n = circleStepCount(r, TWO_PI, rules(chord)).steps;
    const prism = (h * n * r * r * Math.sin(TWO_PI / n)) / 2;
    assert.ok(Math.abs(v - prism) < 1e-9 * exact, `${v} vs inscribed ${prism}`);
    const e = exact - v;
    assert.ok(e >= 0 && e <= TWO_PI * r * chord * h, `error ${e} at chord ${chord}`);
    assert.ok(e < prevErr);
    prevErr = e;
  }
});

test('cylinder without pcurves on the side: the seam is still resolved by continuity of (u, v)', () => {
  const m = unwrap(tessellate(k, cylinder(2, 3, false), { chord: 0.01 }));
  assert.equal(m.stats.failedFaces.length, 0);
  assert.ok(isWatertight(m));
});

test('per-face failures are reported, the rest of the body is meshed: a cylinder band without a seam', () => {
  // The side face bounded by the two circles only: its loops do not close in (u, v).
  const r = 1, h = 2;
  const b = new BrepBuilder();
  const shell = b.addShell(b.addBody());
  const z = vec3(0, 0, 1), x = vec3(1, 0, 0);
  const v0 = b.addVertex(vec3(r, 0, 0)), v1 = b.addVertex(vec3(r, 0, h));
  const bottom = unwrap(createCircleCurve(k, vec3(0, 0, 0), z, x, r));
  const top = unwrap(createCircleCurve(k, vec3(0, 0, h), z, x, r));
  const e0 = b.addEdge(v0, v0, bottom), e1 = b.addEdge(v1, v1, top);
  const f0 = b.addFace(shell, unwrap(createPlaneSurface(k, vec3(0, 0, 0), z, x)), true);
  b.addLoop(f0, [{ edge: e0, reversed: true }]);
  const f1 = b.addFace(shell, unwrap(createPlaneSurface(k, vec3(0, 0, h), z, x)));
  b.addLoop(f1, [{ edge: e1, reversed: false }]);
  const f2 = b.addFace(shell, unwrap(createCylinderSurface(k, vec3(0, 0, 0), z, x, r)));
  b.addLoop(f2, [{ edge: e0, reversed: false }]);
  b.addLoop(f2, [{ edge: e1, reversed: true }]);
  const brep = b.build();
  const m = tessellate(k, brep);
  assert.ok(m.ok, 'the body is structurally valid: only the side face fails');
  assert.equal(m.value.stats.meshedFaces, 2);
  assert.equal(m.value.stats.failedFaces.length, 1);
  assert.equal(m.value.stats.failedFaces[0]!.face, 2);
  const e = m.value.stats.failedFaces[0]!.error;
  assert.equal(e.kind, 'invalid-topology');
  if (e.kind === 'invalid-topology') assert.match(e.reason, /does not close/);
  assert.ok(m.value.stats.triangles > 0);
  assert.equal(isWatertight(m.value), false);
});

test('torus (two seams, curved both ways): watertight, facets within the chord, volume converging to 2π²Rr²', () => {
  const R = 3, r = 1;
  const brep = torus(R, r);
  const surface = brep.faces[0]!.surface;
  const exact = 2 * Math.PI ** 2 * R * r * r;
  const area = 4 * Math.PI ** 2 * R * r;
  let prev = Infinity;
  for (const chord of [0.1, 0.03, 0.01]) {
    const m = unwrap(tessellate(k, brep, { chord }));
    assert.equal(m.stats.failedFaces.length, 0);
    assert.ok(isWatertight(m));
    assert.ok(isConsistentlyOriented(m));
    assertTrianglesFaceTheirNormals(m);
    // Every facet's centroid lies within the chord of the surface (inside: the mesh is inscribed on the outer side).
    for (let t = 0; t < m.indices.length; t += 3) {
      const [a, b, c] = [m.indices[t]!, m.indices[t + 1]!, m.indices[t + 2]!].map((i) => vertexPoint(m, i)) as [Point3, Point3, Point3];
      const g = vec3((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3);
      assert.ok(Math.abs(unwrap(implicitValue(surface, g))) <= chord);
    }
    // Normals point away from the tube's core circle.
    for (let i = 0; i < m.positions.length / 3; i++) {
      const p = vertexPoint(m, i);
      const rho = Math.hypot(p.x, p.y);
      const core = vec3((R * p.x) / rho, (R * p.y) / rho, 0);
      assert.ok(dot3(vertexNormal(m, i), sub3(p, core)) > 0);
    }
    const e = Math.abs(exact - meshSignedVolume(m));
    assert.ok(e <= area * chord, `volume error ${e} at chord ${chord}`);
    assert.ok(e < prev);
    prev = e;
  }
});

test('cylinder with maxEdgeLength: interior grid points are inserted (Delaunay), still watertight', () => {
  const m = unwrap(tessellate(k, cylinder(2, 3), { chord: 0.05, maxEdgeLength: 0.5 }));
  assert.ok(isWatertight(m));
  assert.ok(isConsistentlyOriented(m));
  assertTrianglesFaceTheirNormals(m);
  const side = m.faceRanges[2]!;
  const boundary = side.loops[0]!.length;
  assert.ok(side.vertexCount > boundary, 'grid points inside the side face');
  for (let i = side.firstVertex; i < side.firstVertex + side.vertexCount; i++) {
    const p = vertexPoint(m, i);
    assert.ok(Math.abs(Math.hypot(p.x, p.y) - 2) < 1e-12);
  }
  const n = circleStepCount(2, TWO_PI, rules(0.05, 20, 0.5)).steps;
  const prism = (3 * n * 4 * Math.sin(TWO_PI / n)) / 2;
  assert.ok(Math.abs(meshSignedVolume(m) - prism) < 1e-9, `${meshSignedVolume(m)} vs ${prism} n ${n} side ${side.vertexCount} ${boundary}`);
});

test('a NURBS face (bilinear top of a box, edges without pcurves): (u, v) by projection, watertight, exact volume', () => {
  const [dx, dy, dz] = [2, 3, 1];
  const P = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => boxCorner(vec3(0, 0, 0), dx, dy, dz, i));
  const net = [[[0, 0, dz], [0, dy, dz]], [[dx, 0, dz], [dx, dy, dz]]];
  const srf = unwrap(createNurbsSurface3(unwrap(createNurbsSurface(1, 1, [0, 0, 1, 1], [0, 0, 1, 1], net))));
  const up = unwrap(surfaceNormal3(k, srf, 0.5, 0.5)).z > 0;
  const brep = planarSolid(P, BOX_FACES.map((f) => [f]), (fi) => (fi === 1 ? { surface: srf, reversed: !up } : undefined));
  const m = unwrap(tessellate(k, brep, { chord: 0.01 }));
  assert.equal(m.stats.failedFaces.length, 0, JSON.stringify(m.stats.failedFaces));
  assert.ok(isWatertight(m));
  assert.ok(Math.abs(meshSignedVolume(m) - dx * dy * dz) < 1e-9);
  assertTrianglesFaceTheirNormals(m);
  const top = m.faceRanges[1]!;
  for (let i = top.firstVertex; i < top.firstVertex + top.vertexCount; i++) assert.ok(vertexNormal(m, i).z > 1 - 1e-12);
});

test('Triangulation.insertPoint: inside splits one triangle, on an interior edge splits two, never on a constrained edge', () => {
  const P = [vec2(0, 0), vec2(4, 0), vec2(4, 4), vec2(0, 4)];
  const sides = [[0, 1], [1, 2], [2, 3], [3, 0]] as const;
  const T = unwrap(Triangulation.create(P, [[0, 1, 2], [0, 2, 3]], sides, true));
  assert.equal(T.insertPoint(vec2(2, 2)), 4); // on the diagonal 0-2
  assert.equal(T.tris.length, 4);
  assert.equal(T.insertPoint(vec2(1, 0.5)), 5); // inside
  assert.equal(T.tris.length, 6);
  assert.equal(T.insertPoint(vec2(2, 0)), -1); // on the constrained side 0-1
  assert.equal(T.insertPoint(vec2(5, 5)), -1); // outside
  assert.equal(T.insertPoint(vec2(4, 4)), -1); // on a vertex
  const area = T.tris.reduce((s0, t) => s0 + tri2(T.points, t), 0);
  assert.equal(area, 32);
  for (const t of T.tris) assert.ok(tri2(T.points, t) > 0);
});

// ---------------------------------------------------------------------------------------------------------
// Holes and degenerate boundaries

test('planar faces with holes: a square frame is watertight with volume 16 - 4, its caps have n + 2h - 2 triangles', () => {
  const m = unwrap(tessellate(k, frame()));
  assert.equal(m.stats.failedFaces.length, 0);
  assert.ok(isWatertight(m));
  assert.ok(isConsistentlyOriented(m));
  assert.equal(meshSignedVolume(m), 12);
  assertTrianglesFaceTheirNormals(m);
  assert.equal(m.faceRanges[0]!.triangleCount, 8);
  assert.equal(m.faceRanges[1]!.triangleCount, 8);
  assert.equal(m.stats.triangles, 8 + 8 + 8 * 2);
});

test('triangulatePolygon: square with a square hole, several holes, area = outer + holes', () => {
  const P = [vec2(0, 0), vec2(10, 0), vec2(10, 10), vec2(0, 10), vec2(2, 2), vec2(2, 4), vec2(4, 4), vec2(4, 2), vec2(6, 6), vec2(6, 8), vec2(8, 8), vec2(8, 6)];
  const outer = [0, 1, 2, 3], h1 = [4, 5, 6, 7], h2 = [8, 9, 10, 11];
  const one = unwrap(triangulatePolygon(P, [outer, h1]));
  assert.equal(one.length, 8 + 2 - 2);
  assert.equal(sumTri2(P, one), 2 * (100 - 4));
  const two = unwrap(triangulatePolygon(P, [outer, h1, h2]));
  assert.equal(two.length, 12 + 4 - 2);
  assert.equal(sumTri2(P, two), 2 * (100 - 8));
  for (const t of two) assert.ok(tri2(P, t) > 0);
  // Wrong orientations are refused.
  assert.equal(triangulatePolygon(P, [[3, 2, 1, 0]]).ok, false);
  assert.equal(triangulatePolygon(P, [outer, [7, 6, 5, 4]]).ok, false);
  assert.equal(triangulatePolygon(P, [[0, 1]]).ok, false);
});

test('degenerate / collinear boundary samples: a prism whose top has edge midpoints is watertight with the exact volume', () => {
  // Bottom square, top square with the four edge midpoints as extra vertices (collinear boundary samples).
  const P = [
    vec3(0, 0, 0), vec3(2, 0, 0), vec3(2, 2, 0), vec3(0, 2, 0),
    vec3(0, 0, 1), vec3(2, 0, 1), vec3(2, 2, 1), vec3(0, 2, 1),
    vec3(1, 0, 1), vec3(2, 1, 1), vec3(1, 2, 1), vec3(0, 1, 1),
  ];
  const faces = [
    [0, 3, 2, 1],
    [4, 8, 5, 9, 6, 10, 7, 11],
    [0, 1, 5, 8, 4],
    [1, 2, 6, 9, 5],
    [2, 3, 7, 10, 6],
    [3, 0, 4, 11, 7],
  ];
  const m = unwrap(tessellate(k, unwrap(buildPolyhedron(k, P, faces))));
  assert.ok(isWatertight(m));
  assert.ok(isConsistentlyOriented(m));
  assert.equal(meshSignedVolume(m), 4);
  assert.equal(m.stats.triangles, 2 + 6 + 4 * 3);
  // Flips removed the zero-area ears: every triangle has positive area.
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t]!, m.indices[t + 1]!, m.indices[t + 2]!];
    const n = cross3(sub3(vertexPoint(m, b), vertexPoint(m, a)), sub3(vertexPoint(m, c), vertexPoint(m, a)));
    assert.ok(Math.hypot(n.x, n.y, n.z) > 0);
  }
  assertTrianglesFaceTheirNormals(m);
});

test('earClip on collinear samples: many points on each side of a square give n - 2 triangles of the right total area', () => {
  const P: Point2[] = [];
  const side = 7;
  for (let i = 0; i < side; i++) P.push(vec2(i, 0));
  for (let i = 0; i < side; i++) P.push(vec2(side, i));
  for (let i = 0; i < side; i++) P.push(vec2(side - i, side));
  for (let i = 0; i < side; i++) P.push(vec2(0, side - i));
  const ring = P.map((_, i) => i);
  const ts = unwrap(earClip(P, ring));
  assert.equal(ts.length, P.length - 2);
  assert.equal(sumTri2(P, ts), 2 * side * side);
  for (const t of ts) assert.ok(tri2(P, t) >= 0);
  // After the zero-area flips every triangle has positive area and the count is unchanged.
  const constrained = ring.map((v, i) => [v, ring[(i + 1) % ring.length]!] as const);
  const T = unwrap(Triangulation.create(P, ts, constrained, false));
  T.legalizeAll();
  assert.equal(T.tris.length, P.length - 2);
  for (const t of T.tris) assert.ok(tri2(P, t) > 0);
  assert.equal(sumTri2(P, T.tris), 2 * side * side);
  // A loop that is not simple has no ear decomposition: a bow tie is refused.
  const bow = [vec2(0, 0), vec2(2, 2), vec2(2, 0), vec2(0, 2)];
  assert.equal(triangulatePolygon(bow, [[0, 1, 2, 3]]).ok, false);
});

// ---------------------------------------------------------------------------------------------------------
// Lean theorems (formal/CadloomFormal/Tess.lean)

test('earClip_length / earClip_area / area2_clip: random star polygons clip into n - 2 triangles of the shoelace area', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const P = starPolygon(5 + (seed % 23), seed);
    const ring = P.map((_, i) => i);
    assert.equal(unwrap(loopOrientation(P, ring)), 1);
    const ts = unwrap(earClip(P, ring));
    assert.equal(ts.length, P.length - 2);
    assert.equal(sumTri2(P, ts), shoelace2(P, ring));
    // area2_clip: removing the first clipped ear (a, b, c) removes exactly its area.
    const [, b] = ts[0]!;
    const rest = ring.filter((v) => v !== b);
    assert.equal(shoelace2(P, ring), tri2(P, ts[0]!) + shoelace2(P, rest));
  }
});

test('chord_ends_on_circle / chord_midpoint / area2_rotN: circle samples lie on the circle; the shoelace area does not depend on the ring start', () => {
  const r = 2.5;
  const c = unwrap(createCircleCurve(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), r));
  const s = unwrap(curvePoints(c, [0, TWO_PI], rules(0.01)));
  for (let i = 0; i + 1 < s.points.length; i++) {
    const a = s.points[i]!, b = s.points[i + 1]!;
    assert.ok(Math.abs(Math.hypot(a.x, a.y) - r) < 1e-12);
    // The chord midpoint is r cos(θ/2) from the centre.
    const theta = s.params[i + 1]! - s.params[i]!;
    assert.ok(Math.abs(Math.hypot((a.x + b.x) / 2, (a.y + b.y) / 2) - r * Math.cos(theta / 2)) < 1e-12);
  }
  const P = starPolygon(17, 3);
  const ring = P.map((_, i) => i);
  for (let start = 0; start < ring.length; start++) {
    const rot = [...ring.slice(start), ...ring.slice(0, start)];
    assert.equal(shoelace2(P, rot), shoelace2(P, ring));
    assert.equal(sumTri2(P, unwrap(earClip(P, rot))), shoelace2(P, ring));
  }
});

test('fan_area: the M0 fan triangles of a polygon sum to its shoelace area (any convex polygon, any start)', () => {
  const P = starPolygon(12, 7).map((p) => vec3(p.x, p.y, 0));
  for (let start = 0; start < P.length; start++) {
    const rot = [...P.slice(start), ...P.slice(0, start)];
    const fan = fanTriangles(rot);
    assert.equal(fan.length, P.length - 2);
    const sum = fan.reduce((s, [a, b, c]) => s + cross3(sub3(b, a), sub3(c, a)).z, 0);
    assert.equal(sum, shoelace2(P.map((p) => vec2(p.x, p.y)), P.map((_, i) => i)));
  }
});

test('bridge_length / bridge_area: bridging adds |hole| + 2 nodes and keeps area(outer) + area(hole)', () => {
  const P = [vec2(0, 0), vec2(12, 0), vec2(12, 9), vec2(0, 9), vec2(3, 3), vec2(3, 6), vec2(7, 6), vec2(7, 3), vec2(9, 1)];
  const outer = [0, 1, 8, 2, 3].filter((i) => i !== 8);
  const hole = [4, 5, 6, 7];
  const ring = unwrap(bridgeHoles(P, outer, [hole]));
  assert.equal(ring.length, outer.length + hole.length + 2);
  assert.equal(shoelace2(P, ring), shoelace2(P, outer) + shoelace2(P, hole));
  // The bridge is p -> m ... m -> p: m is the hole's rightmost vertex (7, 6) or (7, 3).
  const ts = unwrap(earClip(P, ring));
  assert.equal(ts.length, outer.length + hole.length + 2 - 2);
  assert.equal(sumTri2(P, ts), shoelace2(P, outer) + shoelace2(P, hole));
});

test('triangle_patch / union_balanced / patches_balanced / watertight_of_balanced: per-face patches of the cylinder mesh glue into a balanced union', () => {
  const m = unwrap(tessellate(k, cylinder(), { chord: 0.05 }));
  const w = weldVertices(m);
  const T = weldedTriangles(m);
  const key = (a: number, b: number): string => `${a},${b}`;
  const count = (list: readonly (readonly [number, number])[]): Map<string, number> => {
    const c = new Map<string, number>();
    for (const [a, b] of list) c.set(key(a, b), (c.get(key(a, b)) ?? 0) + 1);
    return c;
  };
  const triEdges = (ts: readonly (readonly [number, number, number])[]): [number, number][] =>
    ts.flatMap(([a, b, c]) => [[a, b], [b, c], [c, a]] as [number, number][]);
  const allB: [number, number][] = [];
  for (const fr of m.faceRanges) {
    const Tf = T.slice(fr.firstTriangle, fr.firstTriangle + fr.triangleCount);
    const B: [number, number][] = [];
    for (const r of fr.loops) for (let i = 0; i < r.length; i++) B.push([w[r[i]!]!, w[r[(i + 1) % r.length]!]!]);
    allB.push(...B);
    // Patch: dcount T e + count B (swap e) = dcount T (swap e) + count B e, for every edge e that occurs.
    const d = count(triEdges(Tf)), bc = count(B);
    for (const [a, b] of [...triEdges(Tf), ...B]) {
      const lhs = (d.get(key(a, b)) ?? 0) + (bc.get(key(b, a)) ?? 0);
      const rhs = (d.get(key(b, a)) ?? 0) + (bc.get(key(a, b)) ?? 0);
      assert.equal(lhs, rhs, `face ${fr.face} edge ${a},${b}`);
    }
  }
  // Boundaries cancel in total (each edge's samples are used by its two coedges in opposite directions) ...
  const bAll = count(allB);
  for (const [a, b] of allB) assert.equal(bAll.get(key(a, b)), bAll.get(key(b, a)));
  // ... so the union is balanced, and with no directed edge used twice it is watertight.
  const dAll = count(triEdges(T));
  for (const [a, b] of triEdges(T)) {
    assert.equal(dAll.get(key(a, b)), dAll.get(key(b, a)));
    assert.equal(dAll.get(key(a, b)), 1);
  }
  assert.ok(isWatertight(m));
  // A mesh with one triangle removed is not watertight; a triangle duplicated is not consistently oriented.
  const cut = { positions: m.positions, indices: m.indices.slice(3) };
  assert.equal(isWatertight(cut), false);
  const dup = { positions: m.positions, indices: [...m.indices, ...m.indices.slice(0, 3)] };
  assert.equal(isConsistentlyOriented(dup), false);
  assert.equal(isWatertight(dup), false);
});

test('sagitta_eq_gap / sagitta_le_iff: every circle step has sagitta r(1 - cos(θ/2)) within the chord', () => {
  for (const r of [0.01, 0.5, 2, 37, 1000]) {
    for (const chord of [1e-4, 1e-3, 0.05, 1]) {
      const R = rules(chord, 90);
      for (const sweep of [0.3, Math.PI, TWO_PI]) {
        const { steps } = circleStepCount(r, sweep, R);
        const theta = sweep / steps;
        // The chord midpoint lies r cos(θ/2) from the centre; its gap to the circle is the sagitta.
        const mid = r * Math.cos(theta / 2);
        assert.ok(Math.abs(r - mid - sagitta(r, theta)) <= 1e-12 * r);
        assert.ok(sagitta(r, theta) <= chord * (1 + 1e-9) || steps === 4096, `r ${r} chord ${chord}`);
      }
      // The bound angle has sagitta exactly the chord (when the chord is below the diameter).
      if (chord < 2 * r) assert.ok(Math.abs(sagitta(r, chordAngle(r, chord)) - chord) <= 1e-9 * Math.max(chord, r));
    }
  }
});

test('step_le / steps_reach_end: n = ceil(sweep/θ) steps of sweep/n ≤ θ, the last sample is the interval end exactly', () => {
  const R = rules(0.003);
  for (const [t0, t1] of [[0, TWO_PI], [0.1, 2], [-1, 1.5], [3, 3 + 1e-3]] as const) {
    const c = unwrap(createCircleCurve(k, vec3(1, 2, 3), vec3(0, 1, 1), vec3(1, 0, 0), 2.5, [t0, t1]));
    const s = unwrap(curvePoints(c, [t0, t1], R));
    const n = s.params.length - 1;
    assert.equal(n, circleStepCount(2.5, t1 - t0, R).steps);
    const theta = Math.min(R.angle, Math.PI / 2, chordAngle(2.5, R.chord));
    assert.ok((t1 - t0) / n <= theta * (1 + 1e-12));
    assert.equal(s.params[0], t0);
    assert.equal(s.params[n], t1);
    for (let i = 1; i <= n; i++) assert.ok(s.params[i]! > s.params[i - 1]!);
  }
});

// ---------------------------------------------------------------------------------------------------------
// Curve sampling

/** Largest deviation of the curve from its polyline, by dense sampling between the samples. */
function maxSag(at: (t: number) => Point3, params: readonly number[], points: readonly Point3[]): number {
  let worst = 0;
  for (let i = 0; i + 1 < params.length; i++) {
    const a = points[i]!, b = points[i + 1]!;
    const ab = sub3(b, a);
    for (let j = 1; j < 16; j++) {
      const p = at(params[i]! + ((params[i + 1]! - params[i]!) * j) / 16);
      const t = Math.min(1, Math.max(0, dot3(sub3(p, a), ab) / dot3(ab, ab)));
      worst = Math.max(worst, Math.hypot(p.x - a.x - t * ab.x, p.y - a.y - t * ab.y, p.z - a.z - t * ab.z));
    }
  }
  return worst;
}

test('curvePoints: a line is its end points; circles, ellipses and NURBS arcs stay within the chord', () => {
  const R = rules(0.01);
  const line = unwrap(createSegmentCurve(vec3(0, 0, 0), vec3(10, 0, 0)));
  assert.equal(unwrap(curvePoints(line, [0, 1], R)).points.length, 2);
  assert.equal(unwrap(curvePoints(line, [0, 1], rules(0.01, 20, 3))).points.length, 5);
  const circle = unwrap(createCircleCurve(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 10));
  const cs = unwrap(curvePoints(circle, [0, TWO_PI], R));
  assert.ok(maxSag((t) => unwrap(curvePoint3(circle, t)), cs.params, cs.points) <= 0.01);
  const ell = unwrap(createEllipseCurve(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 10, 2));
  const es = unwrap(curvePoints(ell, [0, TWO_PI], R));
  assert.ok(maxSag((t) => unwrap(curvePoint3(ell, t)), es.params, es.points) <= 0.01);
  const nurbs = unwrap(createNurbsCurve3(unwrap(circleArcToNurbs(unwrap(createCircleCurve(k, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 10, [0, 3]))))));
  const ns = unwrap(curvePoints(nurbs, [ns0(nurbs), ns1(nurbs)], R));
  assert.ok(ns.points.length >= 3);
  assert.equal(ns.capped, false);
  assert.ok(maxSag((t) => unwrap(curvePoint3(nurbs, t)), ns.params, ns.points) <= 0.01);
  // Facet angle: at most 20° per segment on the circle.
  for (let i = 0; i + 1 < cs.params.length; i++) assert.ok(cs.params[i + 1]! - cs.params[i]! <= (20 * Math.PI) / 180 + 1e-12);
  // Bad intervals.
  assert.equal(curvePoints(line, [1, 0], R).ok, false);
  assert.equal(curvePoints(line, [0, NaN], R).ok, false);
  assert.equal(curvePoints(circle, [0, 7], R).ok, false);
});

function ns0(c: { kind: 'nurbs'; curve: NurbsCurve }): number {
  return c.curve.knots[c.curve.degree]!;
}
function ns1(c: { kind: 'nurbs'; curve: NurbsCurve }): number {
  return c.curve.knots[c.curve.knots.length - 1 - c.curve.degree]!;
}

test('sampleEdge: both ends are the vertex points exactly, so faces share boundary points by value', () => {
  const brep = cylinder();
  const R = rules(0.01);
  for (let i = 0; i < brep.edges.length; i++) {
    const e = brep.edges[i]!;
    const s = unwrap(sampleEdge(brep, edgeId(i), R));
    assert.equal(s.points[0], brep.vertices[e.start]!.point);
    assert.equal(s.points[s.points.length - 1], brep.vertices[e.end]!.point);
  }
});

// ---------------------------------------------------------------------------------------------------------
// Predicates and determinism

test('incircle: exact sign, filter agrees with the exact path, cocircular points give 0', () => {
  const sq = [vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1)] as const;
  assert.equal(unwrap(incircle(sq[0], sq[1], sq[2], sq[3])), 0);
  assert.equal(unwrap(incircle(sq[0], sq[1], sq[2], vec2(0.5, 0.5))), 1);
  assert.equal(unwrap(incircle(sq[0], sq[1], sq[2], vec2(5, 5))), -1);
  // Orientation flips the sign.
  assert.equal(unwrap(incircle(sq[0], sq[2], sq[1], vec2(0.5, 0.5))), -1);
  const rnd = lcg(99);
  for (let i = 0; i < 300; i++) {
    const p = (): Point2 => vec2(rnd() * 10 - 5, rnd() * 10 - 5);
    const [a, b, c] = [p(), p(), p()];
    // A point near the circumcircle: a tiny perturbation of a rotated copy of a around the circumcentre.
    const d = i % 2 === 0 ? p() : vec2(a.x + 1e-14 * (rnd() - 0.5), a.y + 1e-14 * (rnd() - 0.5));
    const f = incircleFilter(a, b, c, d);
    const e = incircleExactOnly(a, b, c, d);
    if (f !== undefined) assert.equal(f, e);
    assert.equal(unwrap(incircle(a, b, c, d)), e);
  }
  // The exact orientation the mesher uses is the M0 one.
  assert.equal(unwrap(orient2d(vec2(0, 0), vec2(1, 0), vec2(0.5, 1e-300))), 1);
});

test('deterministic output: the same input gives identical arrays', () => {
  for (const brep of [cylinder(), frame(), torus(), unwrap(makeBox(k, vec3(0, 0, 0), 1, 2, 3))]) {
    const a = unwrap(tessellate(k, brep, { chord: 0.02 }));
    const b = unwrap(tessellate(k, brep, { chord: 0.02 }));
    assert.deepEqual(a.positions, b.positions);
    assert.deepEqual(a.normals, b.normals);
    assert.deepEqual(a.indices, b.indices);
    assert.deepEqual(a.faceRanges, b.faceRanges);
    assert.deepEqual(a.edgePolylines, b.edgePolylines);
    assert.ok(Object.isFrozen(a.positions) && Object.isFrozen(a.indices) && Object.isFrozen(a));
  }
});

// ---------------------------------------------------------------------------------------------------------
// Review additions: hostile input, reversed faces, other surfaces, scales, triangle shape

const L1 = (u0: number, v0: number, u1: number, v1: number): NurbsCurve => unwrap(createNurbsCurve(1, [0, 0, 1, 1], [[u0, v0], [u1, v1]]));

/** The cylinder of `cylinder()` with every face reversed and every loop run the other way: an inside-out solid. */
function insideOutCylinder(r = 2, h = 3): Brep {
  const b = new BrepBuilder();
  const shell = b.addShell(b.addBody());
  const v0 = b.addVertex(vec3(r, 0, 0));
  const v1 = b.addVertex(vec3(r, 0, h));
  const z = vec3(0, 0, 1), x = vec3(1, 0, 0);
  const bottom = unwrap(createCircleCurve(k, vec3(0, 0, 0), z, x, r));
  const top = unwrap(createCircleCurve(k, vec3(0, 0, h), z, x, r));
  const e0 = b.addEdge(v0, v0, bottom);
  const e1 = b.addEdge(v1, v1, top);
  const e2 = b.addEdge(v0, v1, unwrap(createSegmentCurve(vec3(r, 0, 0), vec3(r, 0, h))), 0, 1);
  const p0 = unwrap(createPlaneSurface(k, vec3(0, 0, 0), z, x));
  const p1 = unwrap(createPlaneSurface(k, vec3(0, 0, h), z, x));
  const f0 = b.addFace(shell, p0, false);
  b.addLoop(f0, [{ edge: e0, reversed: false, pcurve: unwrap(planePcurve(k, p0, { curve: bottom, t0: 0, t1: TWO_PI }, false)) }]);
  const f1 = b.addFace(shell, p1, true);
  b.addLoop(f1, [{ edge: e1, reversed: true, pcurve: unwrap(planePcurve(k, p1, { curve: top, t0: 0, t1: TWO_PI }, true)) }]);
  const f2 = b.addFace(shell, unwrap(createCylinderSurface(k, vec3(0, 0, 0), z, x, r)), true);
  b.addLoop(f2, [
    { edge: e2, reversed: false, pcurve: L1(0, 0, 0, h) },
    { edge: e1, reversed: false, pcurve: L1(0, h, TWO_PI, h) },
    { edge: e2, reversed: true, pcurve: L1(TWO_PI, h, TWO_PI, 0) },
    { edge: e0, reversed: true, pcurve: L1(TWO_PI, 0, 0, 0) },
  ]);
  return b.build();
}

/** A solid of revolution about +z: a sphere zone (latitudes 0.2 .. 1.0, R = 2) or a cone frustum, planar caps, one seam. */
function revolvedBand(kind: 'sphere' | 'cone'): { brep: Brep; volume: number; area: number } {
  const b = new BrepBuilder();
  const shell = b.addShell(b.addBody());
  const z = vec3(0, 0, 1), x = vec3(1, 0, 0);
  let r0: number, z0: number, r1: number, z1: number, v0: number, v1: number, volume: number, area: number;
  let side: Surface3;
  let seamEdge: (va: ReturnType<BrepBuilder['addVertex']>, vb: ReturnType<BrepBuilder['addVertex']>) => EdgeId;
  if (kind === 'sphere') {
    const R = 2;
    v0 = 0.2; v1 = 1.0;
    r0 = R * Math.cos(v0); z0 = R * Math.sin(v0); r1 = R * Math.cos(v1); z1 = R * Math.sin(v1);
    side = unwrap(createSphereSurface(k, vec3(0, 0, 0), z, x, R));
    // The meridian at u = 0, parametrised by the latitude.
    seamEdge = (va, vb) => b.addEdge(va, vb, unwrap(createCircleCurve(k, vec3(0, 0, 0), vec3(0, -1, 0), x, R)), v0, v1);
    volume = Math.PI * (R * R * (z1 - z0) - (z1 ** 3 - z0 ** 3) / 3);
    area = TWO_PI * R * (z1 - z0) + Math.PI * (r0 * r0 + r1 * r1);
  } else {
    const a = 0.3, base = 2;
    v0 = 0; v1 = 1.5;
    r0 = base; z0 = 0; r1 = base + Math.tan(a) * v1; z1 = v1;
    side = unwrap(createConeSurface(k, vec3(0, 0, 0), z, x, base, a));
    seamEdge = (va, vb) => b.addEdge(va, vb, unwrap(createSegmentCurve(vec3(r0, 0, z0), vec3(r1, 0, z1))), 0, 1);
    volume = (Math.PI * (z1 - z0) / 3) * (r0 * r0 + r0 * r1 + r1 * r1);
    area = Math.PI * (r0 + r1) * Math.hypot(r1 - r0, z1 - z0) + Math.PI * (r0 * r0 + r1 * r1);
  }
  const va = b.addVertex(vec3(r0, 0, z0)), vb = b.addVertex(vec3(r1, 0, z1));
  const c0 = unwrap(createCircleCurve(k, vec3(0, 0, z0), z, x, r0));
  const c1 = unwrap(createCircleCurve(k, vec3(0, 0, z1), z, x, r1));
  const e0 = b.addEdge(va, va, c0), e1 = b.addEdge(vb, vb, c1);
  const e2 = seamEdge(va, vb);
  const p0 = unwrap(createPlaneSurface(k, vec3(0, 0, z0), z, x));
  const p1 = unwrap(createPlaneSurface(k, vec3(0, 0, z1), z, x));
  const f0 = b.addFace(shell, p0, true);
  b.addLoop(f0, [{ edge: e0, reversed: true, pcurve: unwrap(planePcurve(k, p0, { curve: c0, t0: 0, t1: TWO_PI }, true)) }]);
  const f1 = b.addFace(shell, p1);
  b.addLoop(f1, [{ edge: e1, reversed: false, pcurve: unwrap(planePcurve(k, p1, { curve: c1, t0: 0, t1: TWO_PI }, false)) }]);
  const f2 = b.addFace(shell, side);
  b.addLoop(f2, [
    { edge: e0, reversed: false, pcurve: L1(0, v0, TWO_PI, v0) },
    { edge: e2, reversed: false, pcurve: L1(TWO_PI, v0, TWO_PI, v1) },
    { edge: e1, reversed: true, pcurve: L1(TWO_PI, v1, 0, v1) },
    { edge: e2, reversed: true, pcurve: L1(0, v1, 0, v0) },
  ]);
  return { brep: b.build(), volume, area };
}

test('hostile input: public triangulation helpers return errors instead of throwing', () => {
  const bad = [vec2(0, 0), vec2(1, 0), vec2(NaN, 1)];
  assert.equal(earClip(bad, [0, 1, 2]).ok, false);
  assert.equal(earClip([vec2(0, 0), vec2(1, 0), vec2(0, 1)], [0, 1, 7]).ok, false);
  assert.equal(earClip([vec2(0, 0), vec2(1, 0), vec2(0, 1)], [0, 1, 0.5]).ok, false);
  assert.equal(bridgeHoles(bad, [0, 1, 2], [[0, 1, 2]]).ok, false);
  assert.equal(bridgeHoles([vec2(0, 0), vec2(1, 0), vec2(0, 1)], [0, 1, 2], [[]]).ok, false);
  assert.equal(triangulatePolygon(bad, [[0, 1, 2]]).ok, false);
  assert.equal(loopOrientation(bad, [0, 1, 2]).ok, false);
  assert.equal(segmentsMeet(bad[0]!, bad[1]!, bad[2]!, bad[0]!).ok, false);
  assert.equal(unwrap(segmentsMeet(vec2(0, 0), vec2(2, 2), vec2(0, 2), vec2(2, 0))), true);
  assert.equal(unwrap(segmentsMeet(vec2(0, 0), vec2(1, 0), vec2(2, 0), vec2(3, 0))), false);
  assert.equal(incircle(vec2(0, 0), vec2(1, 0), vec2(0, 1), vec2(Infinity, 0)).ok, false);
  assert.equal(incircleFilter(vec2(0, 0), vec2(1, 0), vec2(0, 1), vec2(NaN, 0)), undefined);
  const unit = [vec2(0, 0), vec2(1, 0), vec2(0, 1)];
  assert.equal(Triangulation.create([vec2(0, NaN), ...unit.slice(1)], [[0, 1, 2]], [], true).ok, false);
  assert.equal(Triangulation.create(unit, [[0, 1, 5]], [], true).ok, false);
  assert.equal(Triangulation.create(unit, [[0, 1, 1]], [], true).ok, false);
  assert.equal(Triangulation.create(unit, [[0, 1, 2]], [[0, 9]], true).ok, false);
  const T = unwrap(Triangulation.create(unit, [[0, 1, 2]], [], true));
  assert.equal(T.insertPoint(vec2(NaN, 0.1)), -1);
  assert.equal(T.insertPoint(vec2(0.2, Infinity)), -1);
  assert.equal(T.tris.length, 1);
});

test('hostile B-rep: a non-finite vertex fails its edges and faces, the rest is meshed and finite', () => {
  const box = unwrap(makeBox(k, vec3(0, 0, 0), 1, 1, 1));
  const bad = { ...box, vertices: box.vertices.map((v, i) => (i === 0 ? { ...v, point: vec3(NaN, 0, 0) } : v)) } as Brep;
  const m = unwrap(tessellate(k, bad));
  assert.ok(m.stats.failedEdges.length > 0);
  assert.ok(m.stats.failedFaces.length > 0);
  assert.ok(m.stats.meshedFaces > 0 && m.stats.meshedFaces < 6);
  assert.ok(m.positions.every(Number.isFinite) && m.normals.every(Number.isFinite));
});

test('reversed faces: an inside-out cylinder is watertight and consistently oriented with volume -(the outward one)', () => {
  const out = unwrap(tessellate(k, cylinder(), { chord: 0.01 }));
  const inv = unwrap(tessellate(k, insideOutCylinder(), { chord: 0.01 }));
  assert.equal(inv.stats.failedFaces.length, 0);
  assert.ok(isWatertight(inv) && isConsistentlyOriented(inv));
  assert.equal(inv.stats.triangles, out.stats.triangles);
  assert.ok(Math.abs(meshSignedVolume(inv) + meshSignedVolume(out)) <= 1e-9 * meshSignedVolume(out));
  assertTrianglesFaceTheirNormals(inv);
});

for (const kind of ['sphere', 'cone'] as const) {
  test(`${kind} zone with planar caps: watertight across the seam, outward normals, volume converging`, () => {
    const { brep, volume, area } = revolvedBand(kind);
    let prev = Infinity;
    for (const chord of [0.01, 0.001]) {
      const m = unwrap(tessellate(k, brep, { chord }));
      assert.equal(m.stats.failedFaces.length, 0);
      assert.ok(isWatertight(m) && isConsistentlyOriented(m));
      assertTrianglesFaceTheirNormals(m);
      const err = Math.abs(meshSignedVolume(m) - volume);
      assert.ok(err <= area * chord, `${kind} chord ${chord}: volume error ${err}`);
      assert.ok(err < prev);
      prev = err;
    }
  });
}

test('scale: tiny and huge cylinders stay watertight with the same relative volume', () => {
  const ratio = (r: number, h: number, chordFactor: number): number => {
    const m = unwrap(tessellate(k, cylinder(r, h), { chord: chordFactor * r }));
    assert.equal(m.stats.failedFaces.length, 0);
    assert.ok(isWatertight(m) && isConsistentlyOriented(m));
    return meshSignedVolume(m) / (Math.PI * r * r * h);
  };
  const base = ratio(2, 3, 0.005);
  for (const s of [1e-3, 1e9]) assert.ok(Math.abs(ratio(2 * s, 3 * s, 0.005) - base) < 1e-9, `scale ${s}`);
});

test('a dense strip is zipped across by the ear choice, not fanned from a corner', () => {
  const n = 2000;
  const P: Point2[] = [];
  for (let i = 0; i <= n; i++) P.push(vec2(i, 0));
  for (let i = n; i >= 0; i--) P.push(vec2(i, 1));
  const ring = P.map((_, i) => i);
  const ts = unwrap(earClip(P, ring));
  assert.equal(ts.length, P.length - 2);
  assert.equal(sumTri2(P, ts), shoelace2(P, ring));
  for (const [a, b, c] of ts) {
    const xs = [P[a]!.x, P[b]!.x, P[c]!.x];
    assert.ok(Math.max(...xs) - Math.min(...xs) <= 2, 'a triangle spans more than two samples');
  }
});

test('maxEdgeLength splits lines into at most MAX_LINE_SEGMENTS segments, reported as capped', () => {
  const box = unwrap(makeBox(k, vec3(0, 0, 0), 1, 1, 1));
  const capped = unwrap(sampleEdge(box, edgeId(0), rules(0.01, 20, 1e-3)));
  assert.equal(capped.capped, true);
  assert.equal(capped.points.length, MAX_LINE_SEGMENTS + 1);
  const fine = unwrap(sampleEdge(box, edgeId(0), rules(0.01, 20, 1 / 200)));
  assert.equal(fine.capped, false);
  assert.equal(fine.points.length, 201);
});
