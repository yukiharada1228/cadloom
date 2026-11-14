# Exact arithmetic on real algebraic root certificates

`AlgebraicReal` now provides `add`, `sub`, `mul`, `div`, `neg`, `reciprocal`, `sign`
and `equals`, in addition to rational affine maps, root isolation, comparison and
polynomial sign predicates. Operands may have different defining polynomials or
come from different algebraic extensions. Results retain the same immutable
root-certificate invariant: a monic square-free polynomial with one designated
real root, represented by a rational point or a unique-root rational interval.

No floating-point approximation, native library or external CAS is used at runtime.
The `rational` getter remains a representation test, not a rationality decision:
a rational arithmetic result can still be represented by an interval and a
nonminimal polynomial. Use `equals`, `compare` or `sign` for value decisions.

## Exact resultants

For polynomials p(T),q(T), the resultant is the determinant of the Sylvester matrix:
shifted descending coefficient rows of p followed by those of q. The internal
coefficient ring is Q[X], allowing elimination of T while retaining an output
variable X. `polynomialResultant(p,q)` exposes the scalar Q-coefficient case.
Zero inputs give zero; two nonzero constants use the empty-determinant value one.

The determinant uses fraction-free Bareiss elimination, with exact row pivoting.
Given pivot u and previous pivot v (initially one), a trailing entry is updated by

    (u * entry(i,j) - entry(i,k) * entry(k,j)) / v.

These updates are ratios of consecutive determinantal minors; the
Desnanot-Jacobi/Sylvester minor identity ensures division is exact over Q[X].
Row swaps update the determinant sign. If a pivot column has no nonzero entry,
the determinant is zero. Every division checks for a zero polynomial remainder;
an invariant violation throws instead of truncating a fraction. This is a standard
fraction-free determinant construction, not a machine-verified matrix program.

[FLINT's resultant algorithms](https://flintlib.org/doc/algorithms/polynomials/resultant-integers.html)
describe the Sylvester determinant and its use for elimination. The pinned
Mathlib source also defines resultants via Sylvester determinants, but this change
does not claim a proved bridge from that definition to the TypeScript algorithm.

## Addition and multiplication

Let a,b be the represented roots of monic p,q of degrees m,n. Construct

    R_sum(X) = Res_T(p(T), q(X-T))
    R_product(X) = Res_T(p(T), T^n*q(X/T)).

The second expression is a polynomial: its T^(n-i) coefficient is q_i*X^i.
There is no division by T, so zero roots are included correctly. Horner composition
in Q[X][T] constructs q(X-T) for addition. Both resultants are nonzero monic
polynomials of degree m*n before repeated-root removal.

To see why the actual result is a root, factor p and q over an algebraic closure.
For roots a_i,b_j, the monic resultant product formulas give

    R_sum(X) = product_(i,j) (X-a_i-b_j)
    R_product(X) = product_(i,j) (X-a_i*b_j).

For multiplication this identity follows directly from
`T^n*q(X/T) = product_j (X-T*b_j)` as a polynomial identity, including T=0.
Thus a+b or a*b is among the roots. Other conjugate pairs can yield additional real
roots, so a resultant alone does not specify which value is intended. Square-free
reduction preserves every distinct root while removing multiplicities.

## Certified branch selection and termination

Isolate all real roots of R. For addition, input certificates [a0,a1],[b0,b1] give
an enclosing rational interval [a0+b0,a1+b1]. For multiplication take the minimum
and maximum of the four endpoint products. This encloses the true result, even
when operands are equal or otherwise correlated; independence is not assumed.

Keep every candidate root certificate that overlaps this image interval. The
actual result's candidate can never be discarded, since both intervals contain
its value. If only one candidate remains, it must represent the result. Otherwise
refine all candidates and the wider input certificate, then repeat. The maximum
input width tends to zero, and interval addition/multiplication converge to the
true result. Candidate widths also shrink. Since R has finitely many distinct
real roots, every other candidate eventually becomes disjoint. This proves
termination of branch selection, with no approximate tolerance or fixed iteration
limit. If an input becomes a rational point, use the exact rational affine shortcut.
An empty candidate set or constant/zero resultant is an internal invariant error.

Negation is a rational affine map; subtraction uses negation and addition. A
same-object subtraction can return exact rational zero directly.

## Reciprocal and division

Determine whether the value is zero with the existing exact polynomial sign/gcd
predicate, not with a numerical bound or the `rational` getter. This detects zeros
represented by nonminimal polynomials and intervals as well as rational points.
Division by zero throws `RangeError`.

For a nonzero value refine until both bounds have the same strict sign. This
terminates because the represented value has positive distance from zero. Reverse
the defining polynomial coefficients, giving X^degree(p)*p(1/X), and remove leading
zeros by ordinary polynomial normalization. An original zero-root factor can lower
the reversed degree, but nonzero roots map bijectively to their reciprocals and
remain simple. The new isolating interval is [1/upper,1/lower]; inversion is strictly
decreasing on either side of zero. Rational points and linear defining polynomials
return an exact rational point. Division multiplies by this reciprocal.

## Independent algebraic coordinates

`algebraicCoordinates2(x,y)` constructs coordinates from separate algebraic values
or exact rational inputs. `orientAlgebraicPoints2(a,b,c)` evaluates the determinant
`(bx-ax)*(cy-ay)-(by-ay)*(cx-ax)` using field arithmetic and returns its exact sign.
`compareAlgebraicPoints2` now accepts this general coordinate interface. The earlier
`AlgebraicPoint2` shared-parameter representation remains a subtype, preserving its
faster circle/orientation predicates and existing callers. This does not yet widen
rational `Circle2` centers or straight-edge arrangement inputs to arbitrary algebraic
coordinates.

## Independent evidence and scope

- 60 integer-coefficient resultants compared with raw BigInt Leibniz determinants
  (up to 6x6), including constants and zero/common-factor cases.
- 20 Q[X]-coefficient Sylvester determinants compared with independent polynomial
  Leibniz expansion. Explicit cases force row swaps with nonconstant polynomial
  previous pivots. Quadratic sum/product formulas and zero-root factors have known
  symbolic results.
- 48 operations checked against independent A+B*sqrt(d) field coefficient formulas
  for d=2,3,5. Mixed sqrt(2)/sqrt(3) branches, the identity
  `(sqrt(2)+sqrt(3))*(sqrt(2)-sqrt(3))=-1`, exact rational cancellation and nonminimal
  zero division guards are also tested.
- Cubic roots and mixed quadratic/cubic operands checked by independently derived
  polynomial identities; inverses checked against separately specified root equations.
- Positive near cancellation at a 10^-20 polynomial offset; general three-point
  orientation, exact collinearity and fully irrational translated triangles.

These are mathematical construction arguments and independent tests. Bareiss,
resultant construction, branch selection, arithmetic and coordinate execution are
**not machine-verified TypeScript**. The existing 109-theorem Lean audit retains
its previous geometry/arithmetic scope; source hashes record a reviewed baseline.

Result polynomials are square-free but not factored to minimal polynomials.
Degrees can multiply with each operation and coefficient sizes can grow sharply;
sequences of generic algebraic predicates can become expensive. This first exact
field implementation prioritizes value semantics and degeneracies; primitive-element
representations, factorization, caching and scalable algebraic predicates remain
performance work. It is a real-algebraic field API, not arbitrary exact transcendental
arithmetic, circular arrangements, curved BRep or commercial CAD import support.
