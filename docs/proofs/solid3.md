# Exact triangular solids

`prepareSolid3` accepts an oriented finite triangular boundary. It snapshots the input,
requires closed consistently oriented manifold incidence (including connected vertex
links), and rejects every improper pairwise face intersection. These checks certify
an embedded, compact, orientable, piecewise-linear boundary. Distinct components
cannot touch. Empty input represents the empty solid.

## Point location and termination

Plane values and oriented triangle edge tests are rational. A point on any closed
triangle is returned as `boundary` before ray casting. No distance tolerance is used.

For a nonboundary point p, consider directions d(n)=(1,n,n²), n=0,...,8F, where F is
the number of triangles. Each nonzero face normal yields a nonzero polynomial
normal·d(n) of degree at most two. Thus at most 2F candidates are parallel to some
face plane. Such candidates are rejected even when that plane would not be hit.

For a remaining direction, a positive intersection with the supporting line of
an edge (a,b) implies

    ((a-p) × (b-a)) · d(n) = 0.

If p is not in the face plane, this cross product is nonzero: otherwise p would be
on the edge line, which belongs to that plane. The polynomial therefore has at most
two roots. There are three edges per face, so at most 6F further candidate integers
are excluded. If p lies in the face plane, a nonparallel ray meets that plane only
at parameter zero; this face cannot cause a positive edge hit. At least one of the
8F+1 candidates is consequently admissible. BigInt iteration avoids integer rounding
in direction generation and in the retry bound.

An admissible ray meets only triangle interiors and does so transversely. Its number
of positive intersections is finite. For an embedded closed PL surface, crossing a
face changes the inside/outside state; sufficiently far along the ray lies in the
unbounded exterior. Odd parity therefore means inside. This argument uses the
separation theorem for embedded closed PL surfaces; we do not claim to machine-prove
that theorem here. Handles do not change the argument.

## Nesting and orientation

Each edge-connected closed manifold component is a shell. A vertex of one shell is
not on another shell after validation. Connectedness and disjoint boundaries make
its inside/outside classification relative to any other shell constant across that
shell. The number of containing shells is its nesting depth. Outer boundaries have
depth zero, cavities depth one, material islands depth two, and so on. Components
with handles are permitted; a shell in a through-hole is outside the surrounding
shell's bounded interior.

The signed divergence-theorem volume of each consistently oriented embedded shell
is nonzero, positive for outward and negative for inward orientation. Requiring
positive sign at even depths and negative at odd depths certifies the material
orientation. Summing signed shell volumes yields material volume, subtracting cavities
and adding nested islands. Point queries use parity across all shells; boundary is
returned before parity, including cavity walls.

## Evidence and limits

Tests compare against independent box and tetrahedron inequalities, including grid
points on faces, edges and vertices; huge translations and tiny rational oblique
maps; nested cavities and islands; separate components; genus-one extrusion; invalid
open, crossing, duplicate, touching and incorrectly oriented input; and snapshots.
The ray construction, topology implementation, separation argument and nesting
algorithm are documented mathematical arguments and tests, **not Lean-verified
TypeScript execution**. Existing scoped Lean arithmetic/plane proofs remain in force.
Validation uses O(F²) face-pair checks. A query may try O(F) rays, each scanning F
faces, so its worst-case arithmetic operation count is O(F²), excluding BigInt bit
complexity. This API intentionally rejects touching material boundaries rather than
repairing them. It does not yet implement 3D Boolean construction or curved faces.
