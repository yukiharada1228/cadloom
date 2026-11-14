# Exact curve-germ rotation and boundary walks

`buildCurveHalfEdges2` first nodes the mixed line/circle inputs with `splitCurves2`,
then builds two half-edges per atomic edge, CCW cyclic outgoing order, twin/next/
previous links and left-side boundary orbits. Isolated vertices remain in the graph
with no outgoing half-edges. These orbits are **not grouped faces**.

## Tangents and signed curvature

For an oriented straight edge the outgoing tangent is its nonzero rational direction
(or its negative on the twin), and signed curvature is zero. For a circular arc at
p=(x,y), center c=(cx,cy), use

    T = k * (-(y-cy), x-cx),

where k=+1 for CCW traversal and -1 for CW. Reversing the half-edge reverses k.
This is nonzero because supporting circle radiusSquared is positive for every arc
edge; point circles/arcs were normalized to vertices. Its length is the radius,
not one. Public `germ` metadata stores this exact tangent, curvatureSign=k and the
rational squared radius; signed curvature denotes k/sqrt(radiusSquared). No square
root approximation or tangent normalization is needed to compare directions.

First compare the usual two polar halves and the sign of the tangent cross product.
Different nonopposite rays have the standard CCW polar order. Within one polar half,
a zero cross product identifies the same positive tangent ray, so a higher-order
germ comparison is required; arbitrary edge-ID ties would give incorrect sectors
at tangencies.

## Cancelling tangent cross products before evaluation

For two circle centers a,b sharing origin p, their CCW tangent cross product is

    (ay-by)*x + (bx-ax)*y + ax*by-ay*bx.

`circle_tangent_cross_linear` proves this identity over commutative rings. Multiply
its sign by the two traversal signs. For a rational line direction v and a circle
tangent, the cross product is k*v·(p-c). Line/line cross products are rational.
Thus all direction comparisons are at most affine in the vertex coordinates,
instead of multiplying independently represented algebraic coordinates. A recorded
shared parameter uses one polynomial sign predicate; general coordinates use exact
field operations. Actual public tangent vectors are checked independently by dot,
norm and cross computations in tests.

## Why signed curvature resolves coincident tangent rays

Take coordinates along the shared unit tangent and its left normal. A left-bending
circle of radius r has center (0,r). At its intersection (s,z) with a small circle
of radius rho about the vertex,

    s²+(z-r)²=r²,   s²+z²=rho²
    => z=rho²/(2*r).

`circle_germ_normal_offset` proves this algebraic implication over characteristic-zero
fields with r!=0. A right-bending circle follows by reflecting z; a line has z=0.
For the outgoing branch s>0 and sufficiently small rho, ordering these intersection
points around the small circle is exactly ordering signed curvature k/r. This is
an exact relation, not a truncated floating-point Taylor calculation.

Compare curvature signs first: negative, zero, positive. For two positive
curvatures, smaller squared radius gives larger curvature; for two negative
curvatures the order reverses. All such comparisons are rational. If tangents and
signed curvature both agree, two circles through the same point have the same
center/radius and germ; two lines have the same ray. Such coincident initial
pieces must have merged during noding. A residual tie is an invariant error, not
an arbitrary sorting fallback. Lines and positive-radius circles cannot have equal
signed curvature.

Different limiting tangent angles have a fixed positive angular separation; a
sufficiently small common rho preserves their order. Equal angles use the curvature
rule above. At the positive-x seam the linear list starts before the whole limiting
ray group: negative-curvature germs may lie just below the axis for finite rho.
This only rotates the cyclic list, preserving all neighbor relations. `outgoing`
promises a CCW **cyclic** germ order, not a particular finite-rho axis-cut position.

Because these primitives are only lines and circles, equal tangent plus curvature
means equal germs; higher-order spline tangencies would require additional jets
and are outside this comparator's supported family.

## Half-edge permutation and orbits

Each edge has canonical start/end vertex IDs. The first half-edge follows its
stored geometry; its twin reverses it. At the target of an incoming half-edge,
choose the outgoing germ immediately clockwise from the incoming twin. This
continues the boundary with the same sector on the left, including zero-angle
sectors separated by curvature. Assign the inverse `previous` relation and enumerate
all successor orbits.

Twin reversal is a bijection and every vertex rotation is a cyclic permutation,
so the successor is a permutation. Runtime checks reject duplicate predecessors
or an orbit joining an already assigned different orbit. Every half-edge belongs
to exactly one closed walk. Bridges may appear in both directions in the same walk;
vertices may repeat at pinches. A walk stores its half-edge IDs, not a chord-based
area: the shoelace sum of arc endpoints is not the curved area.

For C edge-bearing connected components, V active vertices and E edges, a planar
rotation gives E-V+2*C boundary orbits. Tests compute graph connectivity independently
and check this identity. It is a validation invariant, not the sorting algorithm.
Disconnected/nested orbits can bound the same face, and isolated points have no
edge orbit, so the output does not assign face IDs or filled material membership.

## Evidence and scope

- All 6,561 3x3-grid segment pairs reproduce the existing straight-edge outgoing
  rotations, twin/next/previous/boundary fields and boundary permutations.
- Irrational circle/chord crossings, transverse circles, disconnected/nested circles,
  isolated points, line contacts at interiors/endpoints, internal/external circle
  contacts and three-circle contact bouquets.
- Five coincident tangent rays of negative/zero/positive curvature have known exact
  source order, including rational rotation and reflection. Almost equal internally
  tangent radii at a 10^-30 offset retain their strict order.
- Contact tests verify actual left sectors, not only Euler counts: external-circle
  interiors follow CCW walks; the external walk follows both circles CW. Internal
  tangency yields outer-CW and inner-CCW single-circle walks, with the pinched annulus
  following outer-CCW/inner-CW. Tangent line bridges belong to the outside walk.
- 50 seeded mixed graphs check planar Euler, complete orbits, inverse links,
  immutable data and rotation/permutation invariance under input reordering.
  Near-contact overlap and a genuine gap remain distinct.

The two new Lean identities support tangent cancellation and the curvature argument.
They do **not** machine-verify cyclic sorting, noding, the algebraic root library,
permutation construction or TypeScript runtime behavior. Complete program verification
is not claimed. General algebraic predicates can still be expensive; the tangent
cancellation avoids unnecessary degree growth in this stage.

Face grouping, exact face witnesses, filled curved Booleans, splines and curved
3D BRep remain later kernel stages. No GUI or tolerance-based healing is added.
