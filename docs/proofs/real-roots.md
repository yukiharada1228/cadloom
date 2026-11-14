# Rational polynomials and exact real-root certificates

This layer provides root certificates for nonrational geometry. It does not add
curved faces. [Field arithmetic](algebraic-field.md) builds on these certificates.

## API and representation

`Polynomial` stores frozen Rational coefficients in ascending power order, with
trailing zeros removed. Zero has degree -1 and an empty array. Arithmetic, Horner
evaluation, derivative, Euclidean quotient/remainder, monic gcd and square-free
reduction use only Rational/BigInt operations. JS numbers are used for array indices
and finite degree/count values, not geometric coefficients or root coordinates.

`isolateRealRoots(p)` returns each distinct real root in increasing order. Repeated
roots appear once, without multiplicity metadata. Zero is rejected because it has
infinitely many roots; a nonzero constant returns no roots. Each `AlgebraicReal`
contains a monic square-free polynomial and either:

- equal rational bounds, at which the polynomial is exactly zero; or
- a strict rational interval with nonroot endpoints containing exactly one real root.

The defining polynomial need not be irreducible or minimal. Different polynomials
can represent the same real number. `compare` gives exact value order/equality,
not structural equality. `refine` returns a new certificate or the same exact
rational point, preserving immutable inputs. `AlgebraicReal.fromRational` creates
an exact rational point directly. The `rational` getter is null for interval
certificates; null **does not prove irrationality**. Rational affine images are available through `affine(scale,offset)`, using exact
polynomial substitution and mapped isolating intervals. General rational-root detection,
root multiplicities and curve topology remain outside this root-isolation API.
Algebraic addition/multiplication/inversion are provided by the separate
[field arithmetic layer](algebraic-field.md).

`signOf(q)` determines the exact sign of q evaluated at a root, including zero.
This supports predicates for future algebraic curve coordinates without converting
to floating point. `countRealRoots(p,a,b)` always counts distinct roots strictly
inside (a,b), excluding both endpoints.

## Polynomial arithmetic and square-free reduction

Long division cancels the current leading coefficient with a shifted multiple of
the divisor. At each step `original = quotient*divisor + remainder`; the remainder
degree strictly decreases. Euclid iteration terminates by the same degree descent
and preserves the common divisors, giving the monic gcd. In characteristic zero,
`p/gcd(p,p')` has the same distinct roots, all simple. A final monic normalization
does not change roots. These are mathematical invariants plus tests; the concrete
array algorithms are not proved in Lean.

## Sturm counts, including endpoints

For the monic square-free part f, construct f, f', then the negative remainders of
the preceding two polynomials until division has zero remainder. Degrees decrease,
and the last element is a nonzero constant since gcd(f,f')=1. No negative rescaling
of individual sequence elements is performed.

Let V(t) count sign changes after removing zero entries at t. At an intermediate
sequence zero, its neighbors have opposite signs by the negative-remainder relation;
V does not change as t crosses that zero. At a simple root of f, f' is nonzero, so
the first pair has opposite signs just to the left and equal signs just to the
right. V decreases by one. Omitting the zero first entry gives the right-hand
value at the root. Hence `V(a)-V(b)` counts roots in (a,b]. Subtracting one when
f(b)=0 gives the API's strictly open interval convention, including when a is a root.

References: [FLINT's real-root algorithms](https://flintlib.org/doc/algorithms/polynomials/real-roots-integers.html)
describe Sturm variation counting and rational isolation;
[Maple's Sturm reference](https://www.maplesoft.com/support/help/maple/view.aspx?path=sturm)
explicitly documents the (a,b] convention. Neither library is called at runtime.

## Complete isolation and termination

For monic f of degree n, let M be the largest absolute nonleading coefficient and
B=1+ceil(M). Every real root lies strictly between -B and B: for |x|>=B and M>0,

    |sum_{i<n} a_i*x^i| <= M*(|x|^n-1)/(|x|-1) <= |x|^n-1 < |x|^n.

For M=0 only zero can be a root. B is constructed by BigInt integer ceiling;
there is no approximate root bound.

Bisect intervals using Sturm counts. If a midpoint is a root, record its exact
rational point once; both child counts exclude it. Discard count-zero children.
Since a nonzero polynomial has finitely many distinct separated real roots, a
sufficiently fine dyadic subdivision separates them; the process terminates.
A count-one interval may have other roots at its excluded endpoints. Bisect it
further, preserving the single interior root, until these endpoints are nonroots,
or the interior root itself is found as a midpoint. Distinct-root separation also
ensures termination of this cleanup. Output intervals have disjoint interiors and
none contains another recorded endpoint root.

A square-free polynomial with a unique root in an interval and nonroot endpoints
has opposite signs at those endpoints. Refinement evaluates the midpoint and
retains the sign-changing half, or returns that exact root. The width at least
halves on every nonpoint refinement.

## Exact predicates and equality across definitions

First reduce q modulo the root's defining polynomial; evaluation at the root is
unchanged by the division identity. If gcd(f,q) has a root in the isolating interval,
it is the represented root, so q(root)=0. Conversely a common real root must be a
root of the gcd by the Euclidean/Bezout identity. This detects equality exactly,
rather than refining forever around zero.

Otherwise q(root) is nonzero. Rational interval Horner evaluation contains every
value of q on the root interval. As its width tends to zero these bounds converge
to q(root); eventually both bounds have the same strict sign. Return that sign.
This explains termination without a precision tolerance or arbitrary iteration cap.

For comparison, disjoint intervals immediately determine order. A rational point
inside another root interval is equal exactly when it zeros that defining
polynomial. For two intervals, count roots of the defining-polynomial gcd in their
intersection: a common root there must be both represented roots. If there is none,
the values are distinct; refine the wider nonpoint interval until they separate.
Root separation ensures termination even for extremely close algebraic numbers.

## Validation and limits of the evidence

- 200 seeded rational polynomial arithmetic/division/gcd cases, with independent
  power-sum evaluations and exact reconstruction of dividend from quotient/remainder.
- Endpoint grids, repeated roots, no-real-root factors, negative scaling, nonminimal
  definitions, irrational positive/negative branches and roots separated by 10^-35.
- 480 signs at quadratic irrational roots checked using a raw BigInt A+B*sqrt(d)
  oracle based on integer squares, independently of polynomial gcd/Sturm/interval code.
- 30 seeded factored-polynomial fixtures with known rational root sets and 240 open
  interval counts from those known factors.
- 32 checked-in independent SymPy 1.14.0 fixtures: total roots, 256 open-interval
  counts and branch agreement with its rational isolators. The generator verifies
  SymPy's closed-endpoint convention before converting to this API's open counts.
  Regenerate with the command in `tests/oracles/generate-real-root-fixtures.py`.
  SymPy is only an optional fixture-generation oracle; tests and runtime require
  no Python, SymPy, WebAssembly or native geometry library.

These checks and construction arguments **are not machine verification of Sturm's
theorem, polynomial algorithms, AlgebraicReal predicates or TypeScript execution**.
The existing Lean suite checks its previously declared arithmetic/geometry scope;
source hashes record a reviewed baseline rather than proving semantic equivalence.
Naive rational remainders can grow substantially, high degrees or very close roots
can require expensive refinement, and no industrial complexity/performance claim
is made. This layer describes finite real algebraic roots, not arbitrary exact
transcendental values. This numerical layer does not itself construct curve
intersections; the [circle API](circle-intersections.md) builds on it.
