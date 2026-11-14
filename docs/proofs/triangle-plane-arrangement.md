# Triangle subdivision by a plane arrangement

`partitionTriangleByPlanes3` returns convex, positive-area polygons partitioning an
oriented nondegenerate source triangle. Each cell retains source winding, a sign for
each input plane on its relative interior, and the arithmetic mean of its vertices
as a strict relative-interior witness. Polygon boundaries may contain collinear
vertices; output is not triangulated. Inputs are snapshotted, and output is frozen.

## Inductive invariant

Initially there is one convex triangle. Assume a cell is convex with positive area.
An affine plane functional attains its extreme values at vertices. If its vertex
values have no strict sign change, the whole cell lies in one closed halfspace or
in the plane. Its relative interior has the reported strict sign unless the whole
cell is coplanar, in which case the sign is zero. A tangent edge or vertex therefore
does not produce an extra zero-area cell.

If both strict signs occur, clipping against the two closed halfspaces gives two
convex positive-area polygons. Along an edge from a to b, the plane value is
(1-t)u+tv; its unique root is t=u/(u-v). Strict opposite signs imply 0<t<1.
Appending each retained vertex and every strictly crossing edge's root in cyclic
order preserves orientation. Zero vertices are retained once per polygon, and
strict crossings never duplicate a retained endpoint. The two clipped polygons
cover the source cell and intersect only along their shared cut. Earlier plane
signs remain valid on each new relative interior, because it is an open subset
of the old relative interior.

This proves by induction coverage, disjoint relative interiors, convexity, positive
area, winding and sign correctness. In particular cells with distinct sign vectors
cannot overlap in positive area. At most one convex cell has a given sign vector.

## Witness

For a convex positive-area polygon, the average of all vertices belongs to its
strict relative interior. Otherwise a supporting line through that average would
have all vertex functionals nonnegative with average zero; all would have to be
zero, contradicting positive area. The same argument proves strict signs for every
noncoplanar input plane. Coplanar planes have zero value everywhere. Thus the witness
can be used to classify a whole fragment against planes without numerical tolerances.

## Scope

The implementation uses exact rational arithmetic. Tests check 120 plane arrangements,
full vertex-set agreement with an independent halfplane/Cramer intersection oracle
for every sign combination of a four-line arrangement, positive oriented area-vector
conservation, convexity, source containment, witness signs, reversed winding,
duplicate/tangent/coplanar planes and tiny oblique cuts. These are tests and a
mathematical argument, not a machine verification of this TypeScript algorithm.
Existing Lean plane interpolation/root lemmas support its arithmetic derivation.

For P planes a triangle has O(P²) cells, and the incremental implementation may scan
O(P³) total polygon edges in the worst case (ignoring rational bit complexity).
It does not identify coincident cells from different source triangles, conformingly
sew boundaries, classify material sides, or construct a solid Boolean. Supporting
planes alone do not resolve overlapping coplanar faces: their edge lines must also
be introduced in a later common surface arrangement. No claim of a complete Boolean
implementation is made by this API.
