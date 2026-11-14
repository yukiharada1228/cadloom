# Exact equal-parameter NURBS section sewing

`sewNurbsPlaneSection3` accepts a factory-created patch-wise plane section.
It assembles curve vertices/edges and contained patch cells, identifying
matching boundaries at the same global (u,v). It preserves source vertex,
edge and area provenance. This is a seam quotient of parameter charts,
not a certificate of global spatial embedding or a closed oriented BRep.

## Exact boundary contact sets

Two tensor-product knot rectangles can meet along a rational-coordinate
line, at a corner, or not at all. On a shared line, specialize each patch's
homogeneous polynomials to N_Ax,N_Ay,N_Az,W_A and their B counterparts,
all univariate in the remaining global parameter t. Weights are positive
on the closed supported intervals. Equal positions are therefore exactly
the common zeros of

```
E_i(t) = N_Ai(t) W_B(t) − N_Bi(t) W_A(t),  i=x,y,z.
```

Include the two plane-restriction polynomials in the common gcd. This
excludes boundary-map matches outside the section plane. If all five
polynomials are zero, the entire shared interval matches in the section.
Otherwise isolate all real roots of their univariate gcd and filter to
the closed overlap interval. A nonzero constant gcd gives no contacts.
This covers continuous seams and finite contacts at discontinuous seams,
including irrational parameters. No floating tolerance is used.

At corners only, graph vertices are compared directly at the same (u,v)
and exact spatial position. For two contained patches meeting only at a
corner, matching points are recorded as `areaCornerLinks`.

## Noding and edge identity

Collect all source graph vertices on each parameter boundary line, every
cell corner, and every finite seam-contact parameter. Split all curve
edges on that line at these parameters. Extra subdivisions from a
nonmatching neighboring chart do not change geometry and do not force a
weld. The factory supplies one tensor-product knot grid, so a newly added
interior line cut cannot introduce an unrecorded perpendicular knot corner.

Vertical graph edges are explicitly constant-u segments. A horizontal
boundary branch is recognized only when H(u,vBoundary) is identically
zero and its strict interior sample is on that boundary. Ordered simple
roots in the branch's regular slab then guarantee that the entire branch
is that horizontal component. This is not an inference from endpoints
or samples alone.

After subdivision, merge vertices only if both their global parameters
and their exact three spatial coordinates agree. Merge edges only when
their parameter interval and endpoint identities agree on the same seam
line AND the three E_i are identically zero. A nonzero polynomial cannot
vanish throughout a positive-length interval, so this checks equality on
the whole edge. Matching endpoints alone do not establish curve equality.
Source uses on each original edge partition its complete closed parameter
interval, without gaps or positive-length overlap. Evaluators enforce the
new subinterval, not merely the larger original edge's domain.

## Contained patches and components

Graph vertices attach to every contained patch with the same parameter
and spatial position. A whole boundary edge records an area use only
when its complete interval is covered and the rational maps agree
identically. Area-to-area interval/point contacts are retained in `seams`;
corner-only contacts use `areaCornerLinks`. Area-only contacts need not
create curve-graph vertices or edges. The result is an attachment
representation, not a fully stratified CW/simplicial complex.

Each contained parameter rectangle is connected and lies wholly in the
section. Unioning graph endpoints, vertex/area uses and area contacts
therefore gives the connected components of this equal-parameter seam
quotient. An area's boundary is not fabricated as an extra curve edge.
Original isolated source vertices remain, even when they weld to another
patch's branch or corner.

Different global parameters can map to the same spatial point or curve,
especially on a noninjective surface. Those overlaps are deliberately not
identified by this API; components are not asserted to be the connected
components of the complete spatial image. General spatial intersection,
embedding/regularity certification, orientation, arbitrary trim domains,
analytic germ pairing and BRep construction remain future work.

## Validation

Independent source-coverage checks verify that every original edge is
partitioned by returned subintervals and every source vertex is retained.
All merged source uses agree at endpoints and interior queries. Fixtures
cover four-patch corners, both seam directions, different incident roots,
different homogeneous representations, equal endpoints with unequal
interiors, irrational isolated seam contacts, very small gaps/bulges,
outside-plane matches, contained areas, corner-only area contacts and
distinct-parameter spatial overlaps. Subinterval/ownership checks are
also exercised. These arguments and tests do not constitute machine
verification of the TypeScript program.
