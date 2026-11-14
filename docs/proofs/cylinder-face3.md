# Embedded cylinder bands and angular patches

`prepareCylinderFace3(cylinder,lower,upper,options)` constructs a finite embedded
circular-cylinder face. Axial bounds are strictly increasing exact rationals in
the input line parameter: p=o+t*d+radial, lower<=t<=upper. They are not distances
along an approximately unit axis. An optional oriented `CircularArc3` on the
reference circle centered at o specifies the angular **set**. Its circle must
coincide with the radius-R circle normal to d. Either normal sign/scale and either
arc direction are accepted and reconciled into an equivalent CCW set about d.
Without an arc, the full circumference is selected. A point arc is rejected.

This is a band/arc-product domain, not a generic cylinder trim-loop validator.
Oblique-plane/conic trims, arbitrary holes and arbitrary existing BRep face
validation remain subsequent work. All constructed boundaries, including
irrational generator endpoints, retain exact geometry.

## Algebraic straight edge geometry

`AlgebraicSegment3` stores two arbitrary real algebraic endpoints. Its closed point
membership chooses a nonconstant coordinate, checks that coordinate's bounds,
and compares cross-multiplied component ratios. No division by an algebraic
segment length or floating point projection is needed. Equal endpoints represent
a point for the predicate; they are still rejected as BRep edges.

An affine plane contains an entire segment iff it contains both endpoints. On a
cylinder, endpoint membership alone is insufficient: the displacement must also
be parallel to its axis. The substituted quadratic's leading coefficient is the
squared norm of axis cross displacement, so a nontrivial interval can vanish
identically only for an axial generator. The implementation checks component
cross equalities and both endpoints, including point degeneracy.

Rational translation preserves factory-recorded affine correlation. Subtraction
of two registered points with the same algebraic parameter is performed on their
rational affine coefficients. Otherwise semantic coordinate equality is detected
before general field subtraction. These are representation optimizations with
unchanged geometric semantics; extra public origin/direction/parameter fields
are never trusted. `Curve3` includes the new `algebraic-segment` alternative.
General algebraic-segment intersection enumeration is not added by this layer.

## Angular interior witnesses without angle approximation

`interiorPointOnArc3` returns an exact open-arc point; point arcs have no such
witness. A full circle's seam is an interior point. For a proper arc, intersect
it with four closed quadrants of the rational oriented basis U,V used by the
circle. Some quadrant intersection has a positive open arc.

For points in that quadrant, X=U·(p-c)>=0 and Y=V·(p-c)>=0, and X+Y>0. The phase
Y/(X+Y) is strictly increasing from 0 to 1 along the quadrant even if U,V have
different lengths. For each rational candidate q, its comparison with a phase is
the sign of (1-q)Y-qX, a rational linear form in point coordinates. Bisect [0,1]
until q is strictly between the chosen overlap arc's endpoint phases. Since the
phase interval has positive width, dyadic bisection eventually succeeds with no
fixed tolerance or iteration cap. It does not construct the algebraic quotient.

The rational direction

    w=(1-q)*U/(U·U)+q*V/(V·V)

has the desired projection phase. The point c+w*sqrt(R/(w·w)) lies on the circle
in the open overlap, using only one rational quadratic root. An exact membership
check guards the construction. This avoids normalizing sums of independently
algebraic endpoint vectors, whose field degree can grow unnecessarily. A 10^-30
stereographic-angle fixture exercises the bisection path.

## Cylinder coordinates and location

Let D=d·d>0. The axial coordinate and reference-plane point are

    t=((p-o)·d)/D,  q=p-d*t.

For a point on the cylinder, q lies on the reference circle. Location first checks
the exact cylinder equation and closed axial interval. A full band has no seam
boundary: every interior-height circle point is interior. A partial patch also
checks q against the closed angular arc. Axial endpoints or angular endpoints
are boundary; points off the support or outside either interval are outside.
Algebraic query heights are supported despite rational domain bounds.

For registered p=a+s*v, both t and q are evaluated by rational affine coefficient
maps in the same s. For independent coordinates the reference projection is
(I-ddᵀ/D)p+d(d·o)/D, evaluated as rational linear forms. Neither path numerically
normalizes d or treats an unrecognized rational representation as irrational.

## Boundaries, embedding and orientation

The full angular product S¹×[lower,upper] is an embedded annulus with two full-circle
boundary loops. A proper positive arc product is an embedded disk with one loop:
bottom CCW arc, end generator upward, reversed top arc, start generator downward.
The reference circle and increasing axial parameter give product orientation.

For radial r perpendicular to d, the CCW tangent is a positive multiple of d×r.
Lean `Cadloom.cylinder_tangent_axis_cross` verifies

    (d×r)×d = D*r-d(d·r).

Thus the product normal is outward D*r. Sense -1 reverses every loop and each
curve traversal, and returns inward normals instead. Opposite axis direction
changes both tangent and axial orientation; the physical outward side stays the
same. `normalAt` returns sense*D*(q-o), is non-unit, and rejects points outside the
closed face.

The arc interval is injective away from the identified endpoints of a full
circumference, and axial coordinates are unique. Positive angular/axial extents
therefore give embedded connected nonempty domains with manifold boundaries.
BRep incidence construction checks the resulting exact curve closure, supporting
surface membership and port links. A sample combines an open-arc witness with
the rational midpoint of axial bounds; exact location must classify it inside.
A single face is an open surface, so boundary-edge diagnostics are expected.

## Evidence and scope

Tests cover arbitrary (1,1,1) axes, full annuli, proper arcs with irrational straight
generators, both senses, opposite angular normals, axis reversal/rescaling,
independent algebraic query coordinates/heights, immutable snapshots and invalid
domains. 120 spatial patches are compared with independent cyclic/height index
truth tables. Segment tests include independently algebraic endpoints, forged
correlation fields and endpoint-only cylinder false positives. A thin angular
interval is sampled without approximation. Normals are compared with the existing
analytic surface normal implementation.

The new Lean identity supports physical boundary orientation, not complete
TypeScript verification. Algebraic operations, bisection, BRep incidence and the
face constructor use documented arguments/tests. General cylinder trims, global
shell intersection/embedding/nesting and curved solid Booleans remain subsequent
kernel work; a valid individual face is not a complete solid certificate.
