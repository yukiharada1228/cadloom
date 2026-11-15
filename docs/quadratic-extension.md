# Correlated quadratic images

`AlgebraicReal.quadraticImage(N, K, c = 1, D = 1)` represents `(N(t) + c*sqrt(K(t)))/D(t)` for the receiver's actual source root `t`. `N`, `K` and `D` are rational polynomials; `c` is an exact rational input. The method rejects a zero denominator and a negative represented radicand. A zero coefficient or radicand takes the existing rational-image path. Rational source values use direct rational evaluation and the principal square root.

The primitive is connected to cylinder SSI lifts whose base has a genuine rational-univariate chart. The earlier long-running integration snapshots do not include this path. A completed oblique Boolean or runtime improvement is not inferred from the numerical degree bound alone.

## Elimination and degree

Let `P(t)=0` be the source certificate. Remove factors shared with `D`; the represented root survives because `D(t)` was checked nonzero. Reduce the input polynomials modulo the retained source polynomial. For image coordinate `X`, eliminate `t` from

```
P(t) = 0
D(t)^2 X^2 - 2 D(t) N(t) X + N(t)^2 - c^2 K(t) = 0.
```

The three coefficient polynomials may also be reduced modulo `P`. The fraction-free resultant in `t`, followed by its square-free part, vanishes at the actual image. Its degree in `X` is at most `2*degree(P)`, since every conjugate source contributes a quadratic. Denominator-zero conjugates were removed, so the leading coefficient does not vanish identically. This avoids treating the coordinate image and the radical image as independent algebraic sources.

## Selecting the represented real branch

The principal square root of the represented `K(t)` has its own exact interval certificate. Rational polynomial interval evaluation encloses `N(t)` and `D(t)`. Once the latter interval excludes zero, combining numerator/radical bounds and all four endpoint quotients encloses the actual image, regardless of dependence between the source and radical.

Pad that enclosure by its width plus the source and radical interval widths. Nonroot endpoints and a Sturm open-root count of one certify the represented branch. Both source and radical intervals are refined on unresolved iterations; continuity at a nonzero denominator makes the enclosure and padding converge to the actual value. Root separation of the nonzero square-free resultant gives eventual unique isolation. A unique zero root is returned as canonical rational zero. No numeric tolerance selects a branch.

## Signs without building the image

`source.signQuadratic(A, B, K)` returns the exact sign of `A(t)+B(t)*sqrt(K(t))`. Negative represented radicands are rejected. A zero radical or coefficient reduces to `A`; zero `A` reduces to `B`; equal nonzero coefficient signs determine the result immediately.

For opposite signs, `A-B*sqrt(K)` has the sign of `A`. Therefore

```
sign(A+B*sqrt(K)) = sign(A^2-B^2*K) * sign(A).
```

All terms on the right are polynomial signs at the original source root. A zero norm yields canonical sign zero. Rational denominators, when needed by callers, require multiplication by their separately checked sign.

## Validation and scope

Tests independently eliminate `t^2=2` and `(X-t)^2=3+t`, obtaining `X^4-10X^2-8X-1`, and compare both represented sheets with independently isolated roots. Signed constant denominators, degree bounds and unique-root/sign-change certificates are checked. Additional tests cover poles, negative radicands, canonical zero, rational sources and denominator-zero conjugate removal.

A quartic source tests the degree-eight bound for both radical signs and denominator orientations; rational comparisons are checked by the separate norm-sign algorithm. Integer cases exercise coefficient signs and cancellation. These are executable checks and a mathematical construction argument, not new Lean refinement theorems or a full TypeScript proof.

## Shared quadratic 3D point charts

An internal point factory constructs `p_i=(N_i(t)+c_i*sqrt(K(t)))/D(t)` for all three coordinates and retains this actual identity in a private weak registry. Coefficient vectors and numerator arrays are snapshotted; copied public fields cannot grant a chart. Translation uses `N_i -> N_i+v_i*D` and exact affine shifts of already certified coordinate values.

For a linear form `n·p+offset`, combine its rational numerators and radical coefficients before constructing a scalar image. Its sign uses the norm predicate and the separately checked denominator sign. For `constant + sum(w_j*(n_j·p+offset_j)^2)`, combine

```
A = constant*D^2 + sum(w_j*(L_j^2+c_j^2*K))
B = 2*sum(w_j*c_j*L_j).
```

The result is `(A+B*sqrt(K))/D^2`, whose denominator is strictly positive. This directly supports exact plane, circle, cylinder and ellipse membership without independently combining coordinate fields. Unknown point provenance retains complete existing coordinate predicates.

## Rational-univariate cylinder SSI lifts

For first direction `d`, second direction `e`, let `a=|d×e|²>0`, `E=e·e`, `m=E*d-(e·d)*e`, and a base chart `q_i=Q_i(t)/W(t)`. Let `L` and `B` be the numerator polynomials of `(d×e)·(q-o₂)` and `m·(q-o₂)`. Then

```
K = E*(a*r₂²*W²-L²)
c = branch*sign(W)/a
p_i = (Q_i-d_i*B/a + d_i*c*sqrt(K))/W
height = (-B/a+c*sqrt(K))/W.
```

The denominator sign is necessary because `sqrt(K/W²)=sqrt(K)/|W|`. The factory constructs the coordinates and height with the same source root. Genuine SSI support/base/sheet identities remain registered only after construction. Existing affine-base and unknown-provenance paths are retained.

Tests lift a quartic-source rational circle chart on an oblique cylinder with both sheets, both denominator signs and reversed/scaled axes. Every coordinate and linear height stays degree eight or lower. Separate implicit equations check the two cylinder supports, and the vertex linear form checks the selected sheet. The connected implementation passed a 45-test SSI/refinement/point group before adding direct circle-chart support. Full current-source and hard oblique Boolean validation remain required.


## Rational affine maps and source-field reduction

For `p_i=(N_i+c_i*sqrt(K))/D`, an affine map `o+M*p` has numerators `o_i*D+sum(M_ij*N_j)` and radical coefficients `sum(M_ij*c_j)`. The internal map factory constructs those coordinates in the same quadratic extension. Rank-deficient maps are allowed. If all radical coefficients vanish exactly, the result is constructed as a rational-univariate point with the original source root, not as unrelated coordinate images.

Cylinder radial projection, directional projection onto a rational plane and SSI same-fiber reflection now retain this chart. SSI reflection is `p -> p-2*d*(m·p-m·o₂)/a`; the existing support/fiber/sheet checks still precede it. The map constructs actual new values rather than registering caller-provided coordinates as transformed points. Tests cover nonunit oblique projection, rational affine maps, elimination of the radical, both reflected SSI sheets and recovery of a rational base chart without SSI ownership. Hard oblique integration remains a separate required gate.

## Comparing projections in a shared source

Factory-owned affine, rational-univariate and quadratic charts may compare a linear projection before constructing either scalar image. This path requires the same actual source parameter object, and identical radicand polynomials when both charts contain radicals. Different roots or incompatible radicands retain the complete existing comparison.

If the projections are `(A+c*sqrt(K))/D` and `(B+e*sqrt(K))/E`, their difference has numerator `(A*E-B*D)+(c*E-e*D)*sqrt(K)` and denominator `D*E`. Polynomial/norm signs at the shared source root and both nonzero denominator signs determine the exact order, including canonical zero. A chart without a radical contributes coefficient zero. No independent coordinate field is formed.

Lexicographic point comparison applies these exact scalar comparisons in the existing x/y/z order; unknown source relationships use the original coordinate comparison. Boolean equality retains its certified box-separation filter. Cylinder-cell noding now uses that Boolean equality rather than imposing lexicographic work just to test equality. Tests cover translation-based independent order oracles, negative and variable denominators, mixed chart kinds, norm cancellation, different radicals/conjugates, mutable unregistered points and lexicographic priority. The combined lexicographic/geometry group passed 51 tests.

## Current verification and remaining gate

The current source passed all 753 tests outside the unchanged two-test `oblique-cylinder-expression3.test.ts`, using an isolated compiled build with only import/fixture paths redirected. The existing 133-declaration scoped Lean audit passed; this is not a proof of the new TypeScript code. An archived `83d6bb1` document restored all 74 faces and three shells, unchanged region declarations and material queries, passing ordered semantic replay.

The preceding affine-preserving snapshot `0aa79aa` completed the hard case's boundary construction, manifold/incidence checks and more than 100 rational material samples against independent cylinder/cap inequalities. It then entered common Body adoption, which is still running. Inspection found that decoded SSI base points can lose their shared source representation and trigger large generic elimination during reconstruction. The latest common-source comparison implementation has not completed the entire hard integration test. Body reconstruction and final material-sample checks remain unproven; no complete oblique Boolean or SolidCraft reimplementation is claimed.
