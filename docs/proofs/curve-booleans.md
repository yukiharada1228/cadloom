# Regularized Boolean regions bounded by lines and circular arcs

`booleanCurveRegions2(a,b,operation,fillRule)` accepts sets of explicitly connected,
closed oriented walks. Each primitive is a rational segment, a rational supporting
line with algebraic trims, or a rational circle with algebraic arc endpoints. A
single full circle is a valid walk. Full-circle seams are preserved for closure
validation, before noding canonicalizes the geometric circle. Closure is checked by semantic algebraic
coordinate equality after snapshotting/validating the primitives. Empty regions
are valid; empty walks and disconnected/open walks are rejected. Self-intersection,
repeated curves, reversed traversals and zero-length primitives are allowed.

## Winding and selection

Noding preserves each source primitive's traversal as `edge.uses`. For a canonical
edge, sum the signed uses independently for the two operands. Across that edge,
winding(left) - winding(right) equals this sum. A reversed traversal contributes
-1, and coincident traversals contribute separately; deduplicating source geometry
must not discard multiplicity. All sums use BigInt integers.

Each closed input walk has zero boundary as an oriented 1-chain: at each vertex,
incoming and outgoing multiplicities balance. Consequently winding extends
consistently over the open planar faces and is zero in the unbounded face. The
face adjacency graph is connected (a generic path between open faces crosses
finitely many edge interiors). Starting at face 0, dual traversal propagates both
winding integers. Every alternative path is checked for agreement; missing faces
are rejected. A bridge's two sides are the same face and must have zero net delta.

For each operand, nonzero fill means winding != 0; even-odd fill means winding is
odd, including negative odd winding. The requested truth table selects open faces.
The result is the closure of the union of selected open faces. Thus isolated point
and edge intersections vanish, while a tangential union can still have a boundary
contact point.

## Boundary reconstruction and queries

Keep precisely those half-edges whose left face is selected and whose right face
is not. An internal curve (both sides selected) and a canceled curve (neither side
selected) disappear. At the target of a kept half-edge, search clockwise from its
twin in the germ rotation for the next kept outgoing half-edge. The intervening
selected sectors merge across discarded internal edges. Closed input winding
ensures the selected/unselected transitions alternate around the vertex; pairing
the transitions yields a permutation. The implementation checks this bijection,
then extracts all cycles with material on the left. Tangencies use the existing
curvature-aware rotation rather than a chord approximation. Cycles may touch or
repeat a vertex; they need not be simple Jordan rings.

Return original exact supporting lines/circles with the correct oriented trims.
Reversing a line swaps its algebraic parameters; reversing an arc swaps endpoints
and direction. Cycles explicitly close and are reusable operands without floating
point conversion or approximation. Adjacent fragments are not simplified or
merged, preserving the noded arrangement's subdivision.

Location first finds the exact graph cell. An open face is inside iff selected.
For an edge or vertex, examine all incident faces: all selected means inside,
none selected means outside, and a mixture means boundary. This gives the
regularized result semantics even at canceled curves, internal shared edges,
zero-area walks and tangent contacts. Input snapshots and all returned structures
are immutable; query closures retain no caller-owned mutable collections.

## Evidence and limitations

- All four operations on intersecting, nested, disjoint, tangent and coincident
  circles are checked against independent raw integer squared-distance truth tables.
- Duplicate/reversed circles check multiplicity, negative winding, both fill rules,
  holes and canceled/internal boundary location.
- Complementary semicircles test overlapping line trims and removal of an internal
  diameter; tangent-only intersections and retraced arcs/lines test regularization.
- Algebraic arc endpoints and line trims survive result composition, including
  lens subtraction/reunion, cap clipping and an internally tangent pinched annulus.
- Seeded self-intersecting straight walks are compared against the existing polygon
  Boolean implementation plus its independent boundary/winding point locator.
- Twenty mixed circle/rectangle configurations check both winding integers at every
  open-face witness against independent containment sums, under both fill rules.
- A 10^-30 annulus, a tiny lens and a tiny external gap remain distinct.
- Boundary cycle closure, immutable records, boundary-edge coverage and face-witness
  locations are checked throughout.

These are geometric construction arguments and executable differential tests, not
Lean verification of winding propagation, boundary extraction or TypeScript runtime
execution. The underlying noding and face grouping retain their documented scope.
The API does not provide curved area: even rational circles generally introduce pi
and arc angles, so an algebraic number alone is not an exact area representation.
Splines, noncircular conics and curved 3D BRep remain later kernel work. General
algebraic operations and all-pairs curve noding can become expensive; no bounded
resource or production-scale performance guarantee is claimed.
