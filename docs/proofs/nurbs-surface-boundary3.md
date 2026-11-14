# Exact NURBS surface boundary correspondence

`liftNurbsSurfaceBoundary3(surface, parameterCurve, sides)` composes a rational
parameter curve (x=u, y=v, z=0) with a rational tensor-product surface. It returns
immutable rational polynomial pieces with exact, possibly algebraic interval
endpoints. This supplies the curve-on-surface correspondence needed by future
trimmed faces. It does not itself construct a face or certify its embedding.

## Complete patch partition

On each positive-weight parameter-curve span write u=U/A and v=V/A.
For every surface knot k isolate all roots of U-kA and V-kA in that span.
Identically zero equations mean the curve lies on that knot; they do not
produce infinitely many cuts. Together with span endpoints these roots
partition the parameter interval into open cells. The sign of each knot
equation is constant in each cell, so a rational interior witness identifies
the patch for the whole cell. This is not heuristic spatial sampling.

No surface-domain excursion can be hidden between cells: outer domain bounds
are included among the knot equations. Positive weights guarantee no poles.
Reject if any cell is outside the active domain. Continuity of each parameter
span ensures its closed cell also stays within the closed selected rectangle.

A curve lying along a seam uses the requested left or right patch (right by
default, inward at outer endpoints). An isolated knot contact keeps the closed
limits of its neighboring cells, even if both use the same patch. At a
full-multiplicity discontinuous seam these closed limits can differ. They are
not asserted to equal one globally selected point value at that event; the
result explicitly describes one-sided span images. Parameter-curve jumps are
also preserved. Continuity must be checked before such pieces form an edge.

## Homogeneous composition

For the chosen surface patch let its homogeneous coordinates be X,Y,Z,W in
Q[u,v]. Let dU and dV be the maximum coordinate degrees in u and v, and D=dU+dV.
Replace every term c_ij u^i v^j in each coordinate by

```
c_ij U^i V^j A^(D-i-j).
```

This is A^D times the substituted coordinate. The common factor cancels in
X/W, Y/W and Z/W. The resulting denominator is strictly positive on the closed
cell because A>0 and the original patch's homogeneous weight is positive.
Composition can increase degree, even for a bilinear surface and a straight
parameter curve. No chord or same-degree approximation is introduced.

`evaluateNurbsSurfaceBoundaryPiece3` evaluates from these univariate rational
functions at one exact algebraic parameter, preserving its coordinate
correlations. It uses the explicitly indexed closed one-sided piece.

## Whole-parameter correspondence

`nurbsSurfaceBoundaryMatchesCurve3` requires the same global parameter domain.
For every positive-length overlap with a candidate NURBS span, check the three
homogeneous cross products are identically zero. Equality on these intervals
extends to their closed one-sided endpoints because denominators are positive.
Both partitions cover the entire domain, so the positive overlaps cover each
piece interior and its endpoint limits. A candidate discontinuous at a
rational knot must satisfy the identity separately on both sides.

This certifies equality at the same parameter, not equality of image sets or
an arbitrary reparameterization. A t² traversal and a t traversal of the same
segment deliberately do not match. No isolated alternate seam point values
are silently included. The output retains patch and parameter-span provenance.

## Scope and evidence

Tests use the independent bilinear identity S(u,v)=(u,v,uv), degree-raising
composition, irrational knot preimages, rational weights, exact point checks
against the existing surface evaluator, tangent contacts, domain excursions,
discontinuous surface seams and parameter curves, and false correspondences
with identical endpoints or identical image sets. A seeded family of 64 weighted
parameter curves is checked against the independent formula (u,v,uv) after
surface knot refinement.

These are documented mathematical arguments and executable tests, not a new
Lean proof or full TypeScript execution verification. Boundary simplicity,
loop orientation, holes, surface singularities, global surface injectivity,
face location and solid validity remain separate obligations. In particular,
this constructor accepts constant and self-intersecting parameter curves and
does not label them valid topological edges.
