# Exact plane/cylinder sections and elliptic arcs

## Representation

`Ellipse3` represents `p=C+U*x+V*y`, where C,U,V are rational, U,V
independent, and `x²/A+y²/B=1` with positive rational A,B. U,V are
conjugate chart axes; they need not be orthogonal, principal or normalized.
The chart normal U×V defines CCW. A rational positive-definite planar
quadratic form can be diagonalized by rational completing of squares into
this representation, without irrational eigenvectors. An explicit general
quadratic-to-ellipse conversion API is not yet supplied.

Dual vectors computed from the invertible 2×2 Gram matrix recover chart
coordinates. Off-plane points are rejected before inversion. Correlated
algebraic points retain their factory-owned shared parameter; independent
coordinates use exact algebraic field arithmetic. Coincidence compares the
center, support plane and ambient normalized dual quadratic form, not chart
identity. Ellipse/line intersection substitutes the line into
`B*x²+A*y²-A*B=0`; the exact real-root isolator supplies all roots and
quadratic multiplicity. A transverse line contributes only its support-plane
intersection. Segments restrict parameters to [0,1], including collapsed
segments. Ellipse/plane intersection first intersects their support planes.

## Complete supporting-plane/cylinder intersection

Write cylinder axis `o+t*d`, radius squared R>0, plane `n·p+k=0`,
D=d·d>0, N=n·n>0, h=n·o+k, and s=n·d.

If s≠0, C=o-d*h/s lies on both axis and plane. Choose nonzero rational
u perpendicular to d, v=d×u. Projection along d into the plane gives
U=u-d*(n·u)/s and V=v-d*(n·v)/s. Every point in the plane has a unique
expression C+U*x+V*y: this projection is an isomorphism from d-perpendicular
space when s≠0. Axis projection removes the d terms and leaves u*x+v*y.
Since u·v=0, the cylinder equation is exactly
`(u·u)*x²+(v·v)*y²=R`. Thus A=R/(u·u), B=R/(v·v), both positive.
V may be negated to align the ellipse normal with the input plane normal.
This changes orientation but not the point set.

If s=0, q=o-n*h/N is the closest point in the plane to o, and w=n×d.
All plane points have the unique form q+w*t+d*z. Their squared distance
to the cylinder axis is `h²/N+N*D*t²`, because q-o and w are perpendicular
to each other and to d. Put Δ=R*N-h². Consequently:

- Δ<0: empty intersection;
- Δ=0: one generator q+d*z, quadratic multiplicity two;
- Δ>0: two generators `q ± w*sqrt(Δ/(N²*D)) + d*z`.

The origins of the two generators are algebraic; their direction remains
rational. `AlgebraicLine3` stores precisely these data. Results sort by exact
origin coordinates. No tolerance decides tangency, parallelism or coincidence.
Changing an axis origin along its axis or rescaling either normal/direction
does not alter the returned point set.

## Arcs and integration

For points on a positive diagonal ellipse, the upper half has x decreasing
in CCW order and the lower half x increasing. Signs of y and exact x
comparison give total cyclic order without angles or square-root normalization.
Arc inclusion, traversal order and subdivision use this order. Equal endpoints
represent a point unless `fullEllipse` is explicit; full ellipses retain a seam.
Cuts are deduplicated by semantic algebraic-coordinate equality.

`Curve3` supports elliptic arcs for snapshots, translation, reversal,
membership, loops and whole-support tests. The BRep incidence builder treats
full ellipses as periodic edges with distinct start/end ports at one vertex.
Plane-frame primitives moved into `plane-frame3.ts` to keep the dependency
graph acyclic; existing exports through `curve3.ts` remain available.

Whole cylinder support is a polynomial identity, not endpoint sampling.
For q=d×(C-o), u=d×U, v=d×V, require
`u·v=q·u=q·v=0` and
`A*(u·u)=B*(v·v)=R*D-q·q`.
The restricted cylinder polynomial is then a multiple of the ellipse equation.
Conversely a quadratic vanishing on a positive-length ellipse arc vanishes
on its entire nonsingular ellipse and must be that multiple. Point arcs use
point membership instead. This includes ellipses shared by noncoaxial cylinders.

## Evidence and limits

Lean checks `line_ellipse_polynomial` and `cylinder_section_gram`, the latter
`|d×U|²|d×V|²-((d×U)·(d×V))²=|d|²*(d·(U×V))²`.
The existing `plane_gram_intersection` checks the two-plane linear solve.
These are scoped algebraic identities, not proofs of the full algorithms.
Tests compare against raw integer quadratic/discriminant oracles, independent
affine images of circles, cyclic-index arc models, surface membership,
rescaling invariance and arbitrarily close parallel/tangent fixtures.

This layer intersects supporting surfaces. It does not clip intersection
curves to bounded faces, intersect arbitrary ellipses/conics, construct general
elliptically trimmed face domains, or implement curved BRep Boolean operations.
The mathematical arguments above, source inventory hashes, tests and selected
Lean identities do not verify the complete TypeScript or ECMAScript execution.
