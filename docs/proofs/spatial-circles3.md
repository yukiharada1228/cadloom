# Spatial circles and oriented circular arcs

`Circle3` is the intersection of normal·(p-center)=0 and |p-center|²=R.
Center and nonzero normal are rational, and R is a nonnegative rational squared
Euclidean radius. No rational orthonormal frame is required. In particular, the
normal (1,1,1) and unit radius are represented directly, despite the impossibility
of a rational orthogonal equal-length chart for that circle's plane. R=0 is a
point circle. Normal sign/scale does not change the point set; its sign does
specify the orientation of nonpoint arcs.

`circleThroughPoints3` constructs the unique circumcircle in the plane of three
noncollinear rational points. For u=b-a, v=c-a, its center offset h=alpha*u+beta*v
solves u·h=|u|²/2 and v·h=|v|²/2 by the same rational Gram inversion used below.
This yields a rational center and squared radius; input ordering orients the normal.
Collinear or repeated points are rejected.

Point membership checks both equations. Factory-recorded affine algebraic points
use their exact rational parameter polynomials. Independent coordinates use exact
algebraic field operations. Extra public correlation fields are not trusted.
Circle equality compares center, radius and parallel normals; for point circles,
the normal is immaterial. Point-circle intersections are finite points even when
the supporting point sets coincide.

## Angular order and arcs

Choose a deterministic nonzero rational u perpendicular to normal n by crossing n
with a coordinate axis, and set v=n×u. These vectors are orthogonal, and
n·(u×v)=|n|²|u|²>0. Their lengths may differ and are never numerically normalized.
For certified circle points, projections X=u·(p-center), Y=v·(p-center) identify
the positive/negative half circle. On the closed upper half, X decreases strictly
with CCW angular traversal; on the lower half it increases. Thus half-plane signs
and X comparisons give exact cyclic order without cross products between
independently algebraic points, trigonometry or angle approximation. The cut is
at the positive u ray, not necessarily the world x ray.

A full-circle seam is center+u*sqrt(R/(u·u)), constructed as a correlated algebraic
point. For n=(1,1,1), R=1, it is (0,sqrt(1/2),-sqrt(1/2)). Arbitrary validated
seams are retained by `circularArc3`. Equal endpoints otherwise mean a point arc.
CCW/CW refers to the chosen normal, using the right-hand orientation.

Arc membership, traversal order and subdivision use exact cyclic intervals.
Same-circle arc intersection divides the circle at all endpoints, classifies the
open cells, and reconstructs selected runs plus separate isolated endpoint
contacts. If the second circle normal is opposite, its traversal direction is
flipped into the first circle's orientation before cell selection. Overlap arcs
retain the first input's normal and direction. This handles wraparound, full
circles, point arcs, complementary arcs and multiple overlap components.

## Finite intersections

A spatial line is first intersected with the circle plane. A parallel off-plane
line misses. A transverse line has one rational plane candidate, accepted only if
it satisfies the sphere equation; its hit multiplicity is null because no
coplanar quadratic is being classified. A coplanar line substitutes into the
sphere equation:

    |q+t*d|²-R = (d·d)t² + 2(q·d)t + |q|²-R.

Real roots give all intersections, sorted by input parameter. Their reported
multiplicity is that of this quadratic (1 or 2), not a general space-curve
intersection multiplicity. Segments filter the exact closed unit interval;
collapsed points on the circle have parameter 0 and null multiplicity.

Two nonparallel planes n1·p=k, n2·p=l intersect in a rational line. Let
A=n1·n1, B=n2·n2, C=n1·n2. Their Gram determinant A*B-C² is positive. The origin
alpha*n1+beta*n2, with alpha=(k*B-l*C)/det and beta=(l*A-k*C)/det, satisfies both
plane equations, and direction n1×n2 lies in both. Circle/plane intersection then
reduces to line/circle intersection. Parallel planes give an entire positive
circle or no intersection; point circles are handled separately.

Noncoplanar circles intersect only on their two planes' intersection line: all
line/circle candidates from the first are checked against the second. Coplanar
nonconcentric circles reduce to their rational radical plane, obtained by
subtracting sphere equations. Concentric circles are equal or disjoint according
to radius. Finite circle/plane and circle/circle results are lexicographically
sorted. Arc intersections filter these complete finite candidates through both
closed arc predicates.

## BRep curve integration

`Curve3` includes `{kind:'circular-arc',arc}` in addition to rational line trims and
rational-chart planar arcs. Endpoint snapshots, reversal, point membership and
closed surface walks accept this representation. A nonpoint spatial circular arc
lies on a plane iff its entire supporting circle plane agrees with that plane.
It lies on a circular cylinder iff its normal is parallel to the cylinder axis,
its center lies on the axis, and the squared radii agree. Point arcs are instead
classified at their single point.

For necessity on a cylinder, restrict its quadratic equation to the circle plane.
As in the planar-arc construction, vanishing on a nontrivial open arc implies a
scalar multiple of the circle equation. In an orthonormal basis of that plane,
the quadratic part of squared perpendicular distance to cylinder axis d is
I-aaᵀ/(d·d), where a contains d's two in-plane components. It can be scalar only
if a=0: a nonzero rank-one matrix cannot be a nonzero scalar 2x2 identity. Thus
d is perpendicular to the circle plane. The linear coefficients then force the
circle center onto the axis, and the constant coefficient forces equal radii.
Sufficiency follows by direct substitution. This argument uses an orthonormal
basis mathematically; the implementation does not construct it or approximate it.

## Evidence and limits

- Three-point circumcircles are checked under all input permutations for a known
  oblique fixture and on 80 seeded triangles.
- 180 seeded coplanar line/circle cases agree with the independent 2D geometry
  implementation under a rational 3D isometry.
- Coplanar circle/circle cases agree with the separate 2D radical-axis solver.
- 220 circle/plane cases use independent raw integer extremal-distance counts:
  with D=n·n, T=D(m·m)-(n·m)² and delta=m·center+offset, the sign of R*T-delta²*D
  determines zero/one/two hits for nonparallel planes.
- Spatial arc membership, traversal and splitting are checked against cyclic
  indices on a six-point rational hexagon plus six exact algebraic midpoints.
  220 arc pairs include opposite normals, full circles and isolated contacts.
- 120 whole-circle cylinder cases are compared against five independent rational
  sample equations. Endpoint-only false positives are explicitly rejected.
- Tests cover irrational seams, (1,1,1) axes, transverse/coplanar lines, tangency,
  point circles, input reversal, immutable snapshots, forged correlation fields,
  arbitrary seams, near-plane offsets and near-tangent overlap/contact/gaps of 10^-30.

Lean adds the spatial sphere-substitution identity, two-plane Gram coefficient
identity and basis-orientation identity. These do not machine-verify the root
library, arc cell enumeration, all control-flow branches or TypeScript execution.

This is exact circle/arc geometry and its integration with surface walks, not
completed BRep face or shell certification. General conic intersections, algebraic
circle centers/normals, nonplanar curves and curved BRep Booleans remain later work.
Explicit shared-edge incidence is implemented in [brep-topology3.md](brep-topology3.md).
General algebraic operations can be expensive; no
production-scale performance guarantee is claimed.
