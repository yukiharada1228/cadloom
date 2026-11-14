# Oriented NURBS parameter domains

`prepareNurbsParameterDomain2(outer, holes, sense)` constructs a compact connected
Jordan domain in the (u,v) plane. Each ring is an ordered nonempty array of
NURBS curves whose x,y coordinates represent u,v and whose z coordinates are
zero. The outer ring has winding `sense`, and each hole winding `-sense`.
Inputs are validated, not silently repaired or reoriented. The result is a
parameter domain, not a certificate for its image on a surface.

## Boundary validation

The existing exact curve analysis establishes continuity and simplicity of
each curve. It allows the single start/end closure of a ring represented by
one closed curve. Corners and cusps do not invalidate a Jordan boundary, so
interior G1 is not required here. Constant spans or other repeated images
are rejected by simplicity. Ring chains must close exactly.

All pairs of different curves are intersected with the existing complete
spatial NURBS intersection solver (all inputs have z=0). Only the designated
adjacent endpoints are allowed within one ring. Positive-length parameter
relations mean overlap and are rejected; isolated relation vertices are also
checked. Two-curve rings may share both designated endpoints. Closed curves
cannot appear as one of multiple edges of a ring.

Different rings must be disjoint, including isolated touches. The Jordan curve
theorem then makes the inside/outside status of one ring constant along the
other ring. A point of each hole boundary must be strictly inside the outer
ring and outside every other hole. Together with disjointness this excludes
outside holes and nested holes. Removing finitely many disjoint unnested
closed Jordan interiors from one Jordan domain leaves connected material.

## Exact horizontal-ray winding

For a query (a,b), compute all real preimages of y(t)=b on every closed span.
If b has rational certificate P of degree m, substitute N_y/W and clear W^m.
For a nonconstant coordinate the resulting rational polynomial is nonzero.
Isolate its roots and filter them against the actual selected algebraic b,
not all its conjugates. Restrict parameters to the closed span.

A constant y coordinate is handled directly. If it equals b, solve x(t)=a
in the same manner to detect boundary membership and otherwise ignore the
horizontal span. For other spans, a root with x(t)=a is a boundary point;
roots to the left of the query do not contribute to the rightward ray.

At each remaining root, determine the signs of y-b immediately before and
after the root. All actual roots are known, so one exact rational witness in
each neighboring interval establishes its sign. Count +1 when left≤0 and
right>0, and -1 when left>0 and right≤0, taking the missing germ at a span
endpoint as zero. Thus a shared endpoint is counted with a half-open
positive-side convention. Even-order tangencies contribute zero; horizontal
chains and joins have the same convention. Boundary detection runs before
returning any winding-based classification.

A simple closed ring has winding 0 outside and +1 or -1 inside. Interior
witnesses therefore determine orientation without integrating rational curves
(which could require transcendental antiderivatives). For the whole domain,
first classify against the outer ring, then remove hole interiors while
retaining hole boundaries.

## Constructive strict interior witness

Choose a rational parameter in a nonconstant first span, avoiding its finitely
many zero derivative parameters. Its position and nonzero tangent are rational.
Test the two normal offsets with rational scale 1,1/2,1/4,... until one is
strictly inside the ring. A regular boundary germ has an interior side, so the
search terminates. To obtain a material witness, additionally require that the
point is outside all hole interiors. Disjoint compact holes have positive
distance from the selected outer-boundary point, so this search also terminates.
There is no fixed tolerance or iteration cap. Very small domains may need many
exact halvings.

## Evidence and limits

Tests cover curved and polygonal boundaries, single-curve cornered loops,
algebraic boundary/interior queries, tangent rays, horizontal chains, endpoint
zero speed, knot-refinement invariance, reversed orientation, hole nesting and
contacts. Independent rectilinear and parabolic inequalities check location;
a domain of width 10^-30 near 10^30 checks scale-independent strict witnesses.

The constructor snapshots its curves and freezes its result. These are exact
algorithms with documented arguments and executable tests; their TypeScript
execution has not been formally verified. It does not identify surface seams,
validate a surface Jacobian or global injectivity, lift the boundaries, construct
a trimmed BRep face, or establish a solid. Those obligations must be composed
with this parameter-domain validation explicitly.
