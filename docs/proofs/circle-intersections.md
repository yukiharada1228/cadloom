# Exact rational-circle intersections with algebraic points

This adds a circular-geometry layer to the kernel. It is separate from the current
straight-edge polygon arrangements and planar-faced solid Booleans.

## Inputs, point correlation and degeneracies

`Circle2` has a rational center and nonnegative rational **squared radius**. The
`circle2(center,radiusSquared)` argument is not a radius. This representation includes
circles through rational points whose radius itself is irrational. Squared radius
zero is a point circle. Negative values are rejected. `circleThroughPoints2` rejects
collinear or repeated input triples and otherwise computes the unique rational
circumcenter and squared radius.

`line2(origin,direction)` represents the infinite line o+t*d and rejects zero
direction. `intersectLineCircle2` returns zero, one or two frozen hits in increasing
parameter order. A tangent root appears once with quadratic multiplicity two.
`intersectSegmentCircle2` uses the closed parameter interval [0,1], including exact
endpoint hits. A collapsed segment on the circle returns its point once, parameter
zero and multiplicity null: its parameter equation is identically zero and no
finite quadratic multiplicity is claimed.

An `AlgebraicPoint2` stores the rational origin/direction and shared `AlgebraicReal`
parameter as well as separate exact x/y algebraic values. All values are immutable.
The shared parameter is essential for correlated predicates: testing a circle
substitutes both coordinate expressions into one polynomial, not independently
rounded coordinates. `classifyAlgebraicPointToCircle2` returns the sign of squared
distance minus squared radius. `orientAlgebraicPoint2(a,b,p)` handles two rational
points and one such algebraic point. `compareAlgebraicPoints2` compares coordinates
lexicographically, including across different parameterizations.

Structural point objects must respect the factory's representation invariant,
just as structural rational geometry objects must respect their advertised types.

## Rational affine images of root certificates

For root t of square-free p, the coordinate X=s*t+o has defining polynomial
`p((X-o)/s)` when s!=0. Horner composition constructs that polynomial over Q and
monic normalization leaves its roots unchanged. Invertible substitution preserves
square-freeness. Mapping the isolating interval, reversing endpoint order when s<0,
therefore gives exactly one root with nonroot endpoints. For s=0 or a known rational
t, return the exact rational point directly. This is `AlgebraicReal.affine`.
The affine helper itself needs no general arithmetic between independently
defined algebraic numbers; such arithmetic is now available in the separate
[field layer](algebraic-field.md).

## Line/circle reduction and completeness

For circle center c and squared radius r, substitute o+t*d into its equation:

    |o+t*d-c|²-r = A*t²+B*t+C
    A = dx²+dy²
    B = 2*((ox-cx)*dx+(oy-cy)*dy)
    C = (ox-cx)²+(oy-cy)²-r.

The Lean theorem `line_circle_polynomial` proves this identity over any commutative
ring, so it also applies to real/algebraic parameter values. A nonzero rational
direction has A>0, so the polynomial is genuinely quadratic. Real-root isolation
finds every distinct intersection parameter. The line parameterization is injective,
so distinct roots give distinct geometric points. The discriminant determines
quadratic multiplicity; a zero discriminant gives one double root. Restricting the
exact roots to [0,1] gives the complete closed-segment intersection.

The orientation expression with rational a,b expands to a linear polynomial in t,
so its sign is evaluated by the existing exact root predicate. A different circle
produces another quadratic polynomial in the same t, permitting exact inside/on/
outside testing even when neither x nor y is rational.

## Two circles and the radical axis

For centers a,b and squared radii ra,rb, subtract the circle equations:

    F_a(x,y)-F_b(x,y)
      = 2*((bx-ax)*x+(by-ay)*y)
        -(bx²+by²-ax²-ay²+ra-rb).

`circle_equation_difference` and `radical_axis_circle_iff` prove the identity and
that, on this radical axis, the two circle equations have the same zero set. These
Lean lemmas hold over commutative rings. For distinct rational centers the axis
has a rational origin and nonzero rational perpendicular direction. Intersecting
it with the first circle thus gives all and only common points. Results are sorted
lexicographically, making finite point order independent of operand exchange.

Equal centers with unequal squared radii have no common point. Equal positive
squared radii produce `coincident`, representing an entire common circle rather
than a finite list. Two identical point circles produce a one-point result.
Point circles with distinct centers are covered by the same radical-axis reduction.

## Circumcircle construction

Let u=b-a, v=c-a, and D=ux*vy-uy*vx. For D!=0, define

    hx = ((ux²+uy²)*vy-uy*(vx²+vy²))/(2*D)
    hy = (ux*(vx²+vy²)-(ux²+uy²)*vx)/(2*D).

The Lean theorem `circumcenter_linear_equations` proves
`2*u·h=|u|²` and `2*v·h=|v|²` over Q. Expanding squared distances shows a+h is
equidistant from a,b,c. D!=0 gives uniqueness; the squared radius is |h|².

## Independent checks and proof limits

- 3,645 segment/circle cases checked against an independent raw BigInt quadratic
  oracle using endpoint signs, the quadratic vertex and discriminant; 3,240
  nondegenerate infinite lines checked by integer discriminants.
- 1,296 circle pairs checked against the raw integer quantity
  `4*distanceSquared*ra-(distanceSquared+ra-rb)^2`, with concentric/zero-radius
  cases handled independently. Membership of both circles, canonical point order
  and operand-exchange samples are also tested.
- All 456 noncollinear ordered triples on a 3x3 integer grid checked by clearing
  coordinate denominators and comparing raw BigInt squared distances. Reversed
  triples produce the same circle.
- Irrational coordinates, tangent multiplicities, exact endpoint contacts, collapsed
  segments, input errors, huge translations, tiny circumradii, rational rotations/
  signed scales, reversed line direction and 10^-80 near-tangency offsets.
- Root affine images are checked against independently specified defining
  polynomials, inverse maps and zero/negative scale cases.

The four new Lean theorems verify the central equation reductions. They do **not**
machine-verify root isolation, affine polynomial composition, interval mapping,
TypeScript control flow, factories or the complete intersection routines. The
previous real-root limitations remain in [real-roots.md](real-roots.md). Runtime
and normal tests have no external CAS or native/Wasm dependency.

This API does not yet provide circular arcs, curved arrangements/Booleans,
arbitrary algebraic circle centers, curved 3D
BRep, rational splines/NURBS or tolerance-based CAD imports. It returns exact
algebraic intersection data without claiming a complete circular CAD kernel.
