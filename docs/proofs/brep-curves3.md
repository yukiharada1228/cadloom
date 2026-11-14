# Bounded 3D curves and supporting-surface loops

This layer represents exact bounded edge geometry and connected closed walks on
analytic supporting surfaces. It does not yet certify face domains, orient/coidentify
coedges, sew shells, or validate an embedded BRep solid.

## Rational plane charts

A `PlaneFrame3` stores an origin o and independent rational directions u,v. The
map p(x,y)=o+x*u+y*v is injective: its Gram determinant

    det = (u·u)(v·v) - (u·v)² = |u×v|²

is strictly positive. The constructor rejects dependent directions without a
tolerance. Chart inversion first checks exact supporting-plane membership; it
returns null for off-plane points instead of silently projecting them. On-plane
coordinates use the rational dual vectors

    U = ((v·v)u-(u·v)v)/det,
    V = ((u·u)v-(u·v)u)/det.

Then U·u=1, U·v=0, V·u=0, V·v=1, so the inverse is
(U·(p-o),V·(p-o)). Mapping and inversion preserve factory-recorded affine algebraic
parameter correlation where available. Arbitrary independent algebraic coordinates
use exact field arithmetic. Extra public correlation fields are never trusted.

`PlanarArc3` is the affine image of a validated `CircularArc2` in such a chart.
Directions need not be orthogonal or equally scaled. Thus the spatial arc may be
elliptical. For example p=(x,y,y), x²+y²=1 simultaneously describes a section of
the cylinder X²+Y²=1 and the plane Z-Y=0. This is a representation of affine-circle
conics, not a general conic intersection solver. Rational affine-circle charts do
not represent every spatial circle: a perpendicular section of an axis with
direction (1,1,1), for example, needs a more general circle/conic representation
or algebraic chart vectors. This API does not reject that cylinder; its complete
bounded cross-section representation remains subsequent work. Local CCW/CW traversal refers to
the chart, not a globally chosen world normal. Full-circle seams are retained.

`LineInterval3` stores a rational parametric line and real algebraic start/end
parameters, including reversed and collapsed trims. `pointOnCurve3` checks both
line geometry and parameter bounds, or supporting-plane membership followed by
local arc membership. Reversal preserves the point set and swaps traversal.
Cached endpoints supplied on structural objects are recomputed from validated
line/frame/arc data.

## Whole-curve surface membership

Endpoint membership is insufficient: a cylinder diameter has endpoints on the
cylinder but its interior is not on it. Similarly a semicircle can meet another
plane at both endpoints without being contained in that plane.

For a noncollapsed line trim, substituting into a plane or cylinder yields a
polynomial of degree at most two. It vanishes on the entire parameter interval
iff it is the zero polynomial. On a cylinder this is equivalent to d×v=0 and
|d×(a-o)|²-R|d|²=0. A plane requires both its constant and linear coefficients zero.

For a nonpoint planar arc, the local circle has positive radius and contains an
open arc. Pulling a plane back into its chart yields a linear polynomial; it
vanishes on an open circle arc iff all its coefficients vanish. Pulling a cylinder
back yields

    P(x,y)=xx*x²+xy*x*y+yy*y²+X*x+Y*y+C.

It vanishes on a nontrivial arc of local circle
G=(x-cx)²+(y-cy)²-r² iff P=k*G. The implementation checks exactly

    xy=0, xx=yy=k,
    X=-2*k*cx, Y=-2*k*cy,
    C=k*(cx²+cy²-r²).

For necessity, translate the circle center and reduce the quadratic modulo
y²=r²-x². Its remainder is A(x)+B(x)y with deg A<=2, deg B<=1. If this vanishes
on an open arc, squaring gives A²=B²(r²-x²) on an interval, hence as a polynomial.
Since r>0, r²-x² has distinct simple real roots. A square has even root orders,
whereas B²(r²-x²) would have odd order at those roots unless B is zero. Thus B=0
and A=0, yielding the coefficient conditions. Sufficiency follows directly by
multiplication of the circle equation. This also covers the zero polynomial.
Point trims/arcs are classified at their single point instead of requiring the
entire supporting line or circle to lie on the surface.

`curveLoop3` snapshots a nonempty curve sequence, checks semantic algebraic equality
of each end with the next start (including final closure), and verifies each
whole curve against its supporting surface. The result is immutable. A valid
closed walk can still retrace, self-intersect or enclose no area, so it must not
be treated as a certified simple face boundary or shell.

## Evidence and limits

Tests compare 100 random skew-chart round trips against independent 2x2 coordinate
elimination, including dependent charts. They check independent algebraic fields,
correlated points, reversed trims, oblique-section ellipses, endpoint-only false
positives, point degeneracies, arbitrary seams, forged cached endpoints, immutable
snapshots and algebraic endpoint closure across independent representations.
Whole-circle cylinder containment is also checked against five distinct rational
circle points using direct squared-distance evaluation in 100 translated/scaled
charts. Five points suffice for a quadratic restriction (a nonzero restriction
has at most four zeros). Tiny offsets of 10^-30 remain distinguishable.

These construction arguments and differential tests are not machine verification
of chart inversion, whole-curve classification, loop validation or TypeScript
execution. Existing Lean supporting-surface identities remain in scope; no new
whole-program claim is made. General algebraic arithmetic can be expensive. BRep
edge identity/noding, coedges, face domains, shell topology and embedding validation,
and nonplanar space curves remain subsequent work.
