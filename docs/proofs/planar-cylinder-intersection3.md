# Bounded planar/cylindrical face intersections

`intersectPlanarCylinderFaces3` returns the closed-set intersection of a
factory-owned planar face and a finite cylindrical band/angular patch.
Supported planar domains are the existing circular disks with holes,
algebraically bounded chart rectangles, and validated line/circular-arc chart
regions. A chart circle may be a spatial ellipse. Output curves are elliptic
arcs or algebraic segments; points are isolated contacts only. Adjacent pieces
may share endpoints and need not form a minimal arc decomposition.

The planar factory ownership check is reused through zero translation; this
also covers translated factory faces. Structural copies with arbitrary locate
callbacks are rejected. The cylinder domain is reconstructed from its geometry
by the existing finite-section API. Neither caller-supplied topology nor an
untrusted membership callback certifies an input domain.

## Exact ellipse/ellipse intersections

`intersectEllipses3` handles arbitrary rational-center, rational-frame ellipses
with positive rational coordinate squared radii. Different supporting planes
reduce to a rational line and two line/ellipse predicates. Coincident supports
are distinguished from coincident point sets by comparing their normalized
quadratic forms.

For two distinct coplanar ellipses, use the first ellipse's chart:
`y²=R(x)=B-(B/A)*x²`. The second becomes a rational quadratic
`a*x²+b*x*y+c*y²+d*x+e*y+f=0`. Substitute the first equation to obtain
`L(x)*y+M(x)=0`, where L=b*x+e and M=a*x²+c*R+d*x+f.
Every common point projects to a real root of `M²-L²*R`, degree at most four.
For positive nonsingular distinct ellipses this polynomial is not identically
zero: if L=0 it would require M=0 and equal conics; otherwise it would make
the quadratic R, with two distinct simple roots, a rational-function square.

For each isolated real x root:

- R(x)<0 gives no real point;
- L(x)≠0 uniquely recovers y=-M/L, whose square is R by elimination;
- L(x)=0 requires M(x)=0, then gives ±sqrt(R), or one point when R=0.

The last branch is essential: two intersections can have the same x coordinate.
Extraneous squared branches are removed by these exact predicates, not by a
floating tolerance. Results are semantically deduplicated and lexicographically
sorted. `ellipse_elimination_identity` machine-checks the underlying polynomial
identity; it does not verify root isolation or the entire intersection routine.

## Single-parameter rational images

`AlgebraicReal.rationalFunction(N,D)` represents N(alpha)/D(alpha) without
introducing independent conjugates for each occurrence of alpha. First reject
D(alpha)=0 using the exact sign predicate and reduce N,D modulo the source
polynomial. Remove source factors shared with D, which cannot contain alpha.
The resultant of the remaining source polynomial and `D(T)*X-N(T)` is a
nonzero image polynomial of degree at most the source degree. Exact interval
Horner evaluation, division once the denominator interval excludes zero, and
candidate refinement select the unique image root. Continuity near alpha and
separation of finitely many distinct image roots ensure termination.

Reducible defining polynomials are allowed: denominator-zero conjugates must
be removed even though the represented root has a nonzero denominator. A zero
numerator at alpha is returned exactly as zero. World coordinates of recovered
ellipse points are each evaluated as one rational function of x. Self-addition
uses an affine image and self-multiplication uses the polynomial image T²;
this prevents unnecessary Cartesian products of identical conjugates.

These numeric algorithms remain independently tested, not machine-verified.
General field expressions can still cause algebraic-degree and bit-size growth;
there is no uniform latency or memory bound for arbitrary input sizes.

## Cutting against the planar boundary

Start with the complete intersection of the planar support and the finite
cylinder face. Enumerate every intersection with the planar domain boundary:

- rational line trims use line/ellipse roots restricted to their closed trims;
- arbitrary algebraic segments use the ellipse-plane value and a quadratic
  over real algebraic coefficients in the coplanar case;
- circular, affine-circle and elliptic arcs use ellipse/ellipse intersection
  filtered by the bounded boundary arc;
- coincident elliptic supports contribute arc endpoints, sufficient to
  partition overlap changes;
- generator segments use exact segment/conic or coplanar segment/segment
  intersection, including collinear overlap endpoints.

For segment/segment intersection a nonzero 2-coordinate determinant gives the
unique candidate, which is checked on both closed segments. If all minors
vanish, shared endpoints determine collinear overlap. Isolated corner contacts
are retained even when no positive-length segment lies in the planar face.

Deduplicated cuts partition each curve into open cells. Planar membership can
change only at its boundary, whose intersection set has been enumerated.
An exact interior witness classifies each cell; closure yields the retained
positive-length pieces. Finally retain candidate contacts inside the planar
face that are not covered by any output curve. Since input section points
already belong to the cylinder domain, no contact outside that domain is
introduced. This also handles boundary coincidence and tangent-only contacts.

## Evidence and remaining work

Tests compare against rational Pythagorean circle samples and independent
rectangle, circular-annulus, affine-circle and product-domain inequalities.
They cover four real quartic branches independently bracketed by rational sign
changes, swapped ellipse arguments, chart rescaling, reducible source
polynomials, denominator-zero conjugates, algebraic trims, polygon corner
contacts, circular tangency, coincident boundaries and multiplicity-two
cylinder generators. The result is immutable.

This constructs intersection curves and contacts, not the split face domains
or a sewn output shell. Arbitrarily trimmed cylinders, cylinder/cylinder
intersection, general conics beyond ellipses, arbitrary existing BRep
validation and curved solid Boolean operations remain unimplemented. The
selected Lean identity and tests do not establish full TypeScript execution
verification.
