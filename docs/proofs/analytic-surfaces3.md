# Rational analytic supporting surfaces in 3D

This layer supports planes and circular cylinders before bounded BRep faces are
introduced. It is not a BRep solid validator: there are no face trims, coedge loops,
shell sewing or curved solid intersection/embedding guarantees in this API.

`Cylinder3` stores a rational axis line `o + s*d` and a strictly positive squared
Euclidean radius R. Direction d is nonzero and is not normalized. Zero-radius
axes are not regular surfaces and are rejected. `Line3` and all surface data are
snapshotted into immutable rational objects.

## Equation, invariance and normals

For q = p-o and D = d·d, use

    F(p) = |d × q|² - R D.

Lagrange's identity gives |d × q|² = D |q|² - (d·q)². Since D > 0 over the
rationals, F has the sign of squared distance to the axis minus R. Moving o along
the axis leaves F unchanged. Replacing d by a nonzero rational scale multiplies
F by the positive square of that scale. Thus sign/zero tests do not require a
unit vector or a square root, including axes of irrational Euclidean length.

The outward non-unit normal on the cylinder is N = D q - d(d·q), half the gradient
of F. It is perpendicular to d. On the cylinder, |N|² = R D² > 0, so the returned
normal is nonzero. For a plane, the stored oriented normal is returned.
`normalToSurface3` rejects off-surface points. Supporting-surface coincidence
compares proportional plane equations or equal-radius cylinders with the same
axis point set; it deliberately ignores plane orientation and axis parameterization.
It does not compare bounded trims.

## Line and segment intersection

For p(t) = a+t*v, let u = d×(a-o), w = d×v. Substitution gives

    F(p(t)) = (w·w)t² + 2(u·w)t + u·u - R D.

The polynomial has rational coefficients. A positive leading coefficient gives
zero, one double or two simple real roots according to the discriminant. If the
leading coefficient vanishes, w=0 in rational Euclidean space, so the linear
coefficient also vanishes: the line is a cylinder generator if the constant is
zero, otherwise it misses the surface. Plane substitution is linear, with a
zero polynomial identifying a contained line. `intersectLineSurface3` explicitly
separates contained lines, finite points and empty intersections. Finite hits are
ordered by input parameter, not spatial coordinate. Root multiplicity refers to
the substituted polynomial, not to a general surface intersection multiplicity.

Segments restrict exactly to 0 <= t <= 1, preserving endpoints. A contained
noncollapsed segment is returned as contained. A collapsed segment on the surface
is one point with parameter 0 and null multiplicity; off the surface it is empty.

## Algebraic coordinates and evidence

`AlgebraicPoint3` constructs correlated coordinates a+t*v from rational a,v and
an exact real algebraic t. A private WeakMap records factory-created correlation.
Predicates use the rational substitution polynomial only for registered objects;
extra user-supplied origin/direction/parameter fields are not trusted. Independent
algebraic coordinates fall back to exact field arithmetic. Constructors and query
snapshots retain no caller-owned mutable vector objects.

Lean `SurfaceGeometry.lean` checks the projection identity, axis shift and scale
identities, line-substitution coefficients, normal-axis orthogonality and the
normal's squared norm on the surface. The last equality implies nonvanishing
from R>0 and D>0 by ordinary ordered-field arithmetic. These identities do not
machine-verify root isolation, TypeScript control flow or the correlation registry.

Independent tests use raw integer projection formulas (not the implementation's
cross products) for 250 seeded oblique line/cylinder cases. The discriminant and
parallel cases determine the complete expected hit count, and every reported root
satisfies the independent polynomial. Rational point signs are compared to the
same independently derived quadratic. 150 segment/plane cases are compared with
the existing rational intersection implementation. Tests also cover contained
lines, tangencies, reversed parameters, irrational hits, segment endpoints,
independent algebraic coordinate fields, forged correlation properties, normal
orientation, axis/plane equivalence, immutable snapshots and 10^-30 offsets from
tangency.

No whole-program formal verification or production-scale performance is claimed.
General algebraic field operations may have substantial degree growth. Bounded
curves on these supports, face domains, coedges, manifold shell validation and
curved BRep Booleans remain subsequent kernel work; a supporting surface alone
must not be treated as a certified solid face.
