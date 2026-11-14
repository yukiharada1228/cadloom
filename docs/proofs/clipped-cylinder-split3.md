# Closed convex cylinder-solid plane splitting

`splitClippedCylinderByPlane3` accepts a factory-owned `clipCylinderBRep3`
solid and a rational plane h=0. It constructs the regularized children
S∩{h≤0} and S∩{h≥0}. Empty, one-sided disjoint, supporting contact and
genuine volume splits are distinguished. Lower-dimensional remnants are
removed from the children, while supporting contact is reported separately.

## Material and boundary

The parent is convex, compact and full-dimensional unless empty. Adding one
halfspace preserves the constructor's domain and boundary-completeness
argument. Every parent point belongs to at least one closed child; in a
genuine split the child interiors are disjoint. Their common set is the
convex planar section S∩{h=0}, a disk with positive relative area.

Each child has exactly one new cap on this plane. The negative child's
physical outward normal agrees with h; the positive child's is opposite.
The cap interior witness is checked against the parent and both children.
The two oriented cap boundaries are independently sewn into a common edge
table. Each original child coedge records its common-table subdivisions in
traversal order. This permits different child edge subdivisions while
preserving an exact correspondence. Existing child faces retain their
unique parent-face provenance; only the new cap has a null origin.

For a one-sided result the retained child is the original parent object,
so a redundant or supporting cut preserves the parent's topology indices.

## Supporting contacts

A supporting plane may touch an existing vertex, a segment, a planar face,
or the interior of an elliptic boundary edge. Segment and planar-face
contacts include vertices. A supporting cylindrical generator meets the
finite body's boundary at an edge or vertex. Thus vertices plus elliptic
edge extrema suffice for this convex cylinder/halfspace family.

On an ellipse p=C+Ux+Vy with x²/A+y²/B=1, write h(p)=c+ax+by and
T=Aa²+Bb². The weighted Cauchy identity

```
T(Bx²+Ay²) − AB(ax+by)² = (Bbx−Aay)²
```

gives the extrema ±√T of ax+by. A zero extremum requires c²=T;
when T>0 its coordinates are x=−cAa/T, y=−cBb/T. These are rational
and are checked for membership in the actual edge. Constant-zero edges
already have zero-valued vertices. No floating-point tolerance is used.
The identity is checked in Lean as `ellipse_support_identity`; the
enumeration and TypeScript execution are supported by arguments and tests.

## Rejoining

`rejoinClippedCylinderSplit3` removes the paired internal caps and independently
sews all external child patches. It retains child-to-parent face provenance
and checks closed oriented incidence, one shell and Euler characteristic 2.
The material is the original parent, by the child halfspace partition.
This operation is an inverse of the owned split, not arbitrary solid union.
It returns a sewn boundary and parent reference, rather than certifying a
new arbitrary BRep from topology alone.

## Validation and limits

Tests inspect opposite common-edge incidence, child-coedge subdivision
endpoints, physical cap normals, material partition on independent rational
grids, repeated child cuts, face provenance and closed rejoined shells.
They include rational oblique planes and axes, sign-scaled plane equations,
thin positive-volume children, a polyhedron entirely inside the cylinder,
nonvertex supporting contacts and ownership/freeze checks.

Regression tests also cover a sole tangent contact at an ellipse seam in
finite plane/cylinder-face and bounded planar/cylinder-face intersections.
Those routines must return the isolated point, never the whole ellipse.

This is limited to convex filled-cylinder/rational-halfspace solids.
It does not implement general curved Booleans, cylinder/cylinder section
curves, nonconvex shell nesting or full TypeScript/runtime verification.
Both halfspace children are constructed before classifying a nonseparating
cut. A supporting plane on an already obliquely trimmed body took about
118 seconds in the current regression run; performance is not yet suitable
for interactive use in all supported cases.
