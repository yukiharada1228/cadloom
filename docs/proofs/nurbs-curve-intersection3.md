# Exact spatial NURBS curve intersections

`intersectNurbsCurves3` represents the complete equality correspondence
between two positive-rational nonperiodic NURBS curves, using closed span
images on both sides. It returns parameter-pair events and bounded implicit
parameter-relation graphs, retaining source span-pair provenance.

## Three spatial equations

For homogeneous span data A=(Ax,Ay,Az,Aw) in u and B in v, form

```
F_i(u,v) = A_i(u) B_w(v) − A_w(u) B_i(v), i=x,y,z.
```

On the two valid closed spans both weights are positive. Consequently all
three equations vanish exactly when the spatial positions agree. Solving
only two projected coordinates is insufficient for general spatial curves.
Solutions outside the two active span intervals are discarded; denominator
zeros outside these intervals cannot introduce valid events or relations.

## More than two equations

`solveBivariateEquations` maintains a shared zero locus Z(C) and a finite
set P outside it. Initially C=0 and P is empty, representing all of R².
When adding E=0, filter existing finite points by E and solve C=E=0 using
the two-equation solver. Its shared factor becomes the next C and its
isolated residual points are added to P.

Inductively the new zero set is

```
(Z(C) ∩ Z(E)) ∪ {p∈P : E(p)=0}.
```

This also handles zero equations, nonzero constants, and equations whose
pairwise gcds are nonconstant while their total gcd is one. In particular,
filtering only the first pair's finite roots would miss points on its
shared factor. The common zero locus becomes smaller at every step, so
previous finite points outside the old shared locus stay outside the new
one. The final representation is the common factor plus distinct isolated
residual points, independent of constraint order as a geometric set.

## Bounded relations and events

For each span pair, trace the shared factor inside its closed parameter
rectangle with `traceAlgebraicCurve2`. This resolves its real zero locus,
including isolated vertices, nonlinear branches and vertical components.
The zero common factor gives a whole parameter rectangle. Since the two
curves depend on separate parameters, equality for every pair in that
rectangle means both spatial span images are the same constant point.

Isolated residual points and isolated relation vertices are collected in
`points`. They are isolated within at least one closed span pair, not
necessarily isolated in the union of all span-pair relations or in space.
For example, splitting two identical curves can introduce corner-only
span-pair events that lie on another pair's continued overlap. Relation
graphs retain isolated vertices too; the result is intentionally not a
minimal disjoint partition of the correspondence.

Merge point events only when u, v AND the spatial position agree. At a
discontinuous knot, the same parameter pair may have different matched
spatial positions, which must remain separate. Different parameter pairs
at a self-intersection also remain distinct even when their spatial point
is the same. Known-span evaluation preserves the appropriate one-sided
endpoint; the global default right-side evaluator would be incorrect there.

Relation evaluators check the owned result, span rectangle and exact shared
factor equation, then evaluate the selected first span. Divisibility by
the common factor guarantees agreement with the second span. Edge queries
retain the graph's u-coordinate convention, or v for vertical relations.

## Validation and scope

Tests use independent spatial evaluations on both source spans to check
every returned event and relation sample. Fixtures cover projected/skew
line cases, nonplanar cubic intersections, unclamped active domains,
irrational parabola intersections, tangency, continuous knots,
reversed rational circles, nonlinear/noninjective parameterizations, partial
overlaps, closed-domain endpoint contacts, constant curves and discontinuous
endpoint branches. A cubic self-intersection supplies off-diagonal finite
pairs alongside its diagonal relation. Multi-equation fixtures expose the
pairwise-common-factor trap and verify zero/constant/order behavior.

A parameter relation can map to a spatial arc, one point, or a multiply
covered set. Its graph dimension and connected components are not asserted
to be spatial intersection topology. Distinct span-pair charts are not
globally welded; contact order, regularity, orientation, BRep integration
and applying these relations to arbitrary spatial section sewing remain
future work. High-degree exact elimination may be expensive. The new
algorithm is supported by construction arguments and independent tests,
not machine-verified TypeScript execution.
