# Plane intersection with finite cylinder domains

`intersectPlaneCylinderFace3` intersects an infinite rational plane with the
closed finite product domain returned by `prepareCylinderFace3`: an angular
circle arc times a rational axis-parameter interval. It reconstructs that
domain from its geometric data, ignoring supplied `locate`, boundary and
cached topology fields. It returns closed positive-length `Curve3` pieces
and isolated points; the pieces may share subdivision endpoints.

## Completeness

The supporting-surface intersection is already classified by
`intersectPlaneCylinder3`.

For a generator, the angular position is constant. Its direction is exactly
the input cylinder axis direction, so subtracting its origin's axial parameter
from each face bound gives the two segment endpoints. A midpoint membership
query decides whether the entire closed generator segment belongs to the
angular set, including angular endpoints. Multiplicity two is retained for
a tangent plane. A positive-height product domain cannot leave only one
point of a generator.

For an ellipse, enumerate all plane intersections with both cap arcs and
both angular generator segments (where present). Circle/plane intersection
is exact and filtered by the cap arc. A generator segment uses the affine
plane value at its endpoints: opposite signs give its unique interior root;
zero endpoints are included. An ellipse section plane is not axis-parallel,
so it cannot contain a generator. If a cap circle is coplanar, it is the
entire ellipse; angular generators still supply its trimming endpoints.
A full band needs no angular cuts in this case.

Deduplicate contacts by semantic coordinate equality. Together with the
ellipse representation seam and four chart-axis extrema they partition the ellipse into open cells. The extrema are artificial cuts: they ensure a sole boundary contact at the periodic seam cannot also be selected as the witness for a whole ellipse.
Membership can change only at the product-domain boundary, all of whose
intersection points were enumerated. One strict interior witness therefore
decides each cell. Closed cells are retained when their witness is in the
closed face. Original boundary contacts not covered by a retained curve
are returned as isolated points. This retains cap tangencies even when no
positive-length curve survives. Artificial seams and redundant cuts are
allowed; the result is a complete closed set, not a minimal arc decomposition.

## Exact interior witnesses

`interiorPointOnEllipticArc3` splits the arc at the four chart-axis extrema
that lie on it, then takes a nonpoint cell in a closed coordinate quadrant.
In that quadrant put X=|x|, Y=|y|. The phase Y/(X+Y) is strictly monotone
along the quadrant ellipse. Dyadic bisection finds a rational q strictly
between the endpoint phases by testing the sign of `(1-q)*Y-q*X`.
Distinct endpoint phases and density of dyadics ensure termination, without
a fixed iteration limit. A positive multiple of the rational chart ray
`(sign(x)*(1-q),sign(y)*q)` lies on the ellipse, with multiplier
`sqrt(A*B/(B*(1-q)^2+A*q^2))`.
It is represented by one correlated algebraic parameter rather than
normalizing a sum of algebraic endpoints, which can cause large resultant
expressions. The standalone witness helper may use a full ellipse seam; this intersection algorithm subdivides at the extrema before calling it. Point
arcs have no open interior and are rejected.

## Validation and scope

Tests independently parameterize a unit circle with rational Pythagorean
coordinates, apply axial/oblique rational charts, and compare the returned
set against explicit angular/height inequalities. They cover cap coincidence,
tangent isolated contacts, tangent generators and multiplicity, angular
boundary overlap, major arcs, irrational endpoints, arbitrarily narrow arcs,
and reconstruction that ignores untrusted domain callbacks.

Existing scoped Lean algebraic identities support the underlying surface
and intersection equations. This new enumeration, witness search and closed
set assembly are tested and justified above, not machine-verified TypeScript.
No extra Lean runtime model is added.

This API does not split and sew the remaining portions of a face, intersect
two arbitrary bounded faces, construct general trimmed cylindrical domains,
certify a new solid, or implement curved BRep Boolean operations. Its plane
is infinite; clipping against the finite domain of a second planar face is
still required for bounded face/face intersection.
