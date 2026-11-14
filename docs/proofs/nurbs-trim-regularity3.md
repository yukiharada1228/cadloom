# Singular loci restricted to NURBS trim domains

`analyzeNurbsTrimRegularity3(surface, domain)` intersects each closed one-sided
patch's complete singular parameter set with a validated closed Jordan domain.
Hole interiors are excluded; outer and hole boundaries are retained. This
certifies a rank condition, not a trimmed spatial face or its embedding.

## Trusted geometry and domain coverage

Rebuild the parameter domain from its curves and sense, ignoring supplied
location methods, samples or cached metadata. Snapshot the surface through the
support regularity analyzer. Lift every boundary curve with the existing exact
surface-boundary constructor; this validates its full active-domain containment
and partitions it at all surface-knot preimages.

The outer Jordan boundary lying in the closed surface parameter rectangle
implies its bounded interior also lies in that rectangle: a Jordan interior
lies in the convex hull of its boundary. Thus no material is silently clipped
away outside the surface's active domain. An excursion of a boundary is rejected.

## Finite points and curve graphs

Filter isolated support solutions and graph vertices with exact domain location.
To find every contact of a shared singular factor F with a trim boundary span,
substitute its rational u(t),v(t) into F and clear a positive power of its weight.
A nonzero resulting polynomial has finitely many roots; isolate all of them,
restrict to the closed span, evaluate the true parameter points, and restrict
to the source patch rectangle. Preserve tangencies and endpoint contacts.

If the substitution is identically zero, the entire boundary span lies on the
singular locus. Add its endpoint images as cut events. This is sufficient:
within a source graph edge, an injective boundary span can enter or leave only
through its own endpoints or through graph vertices (which already split the
graph). Singular crossings and vertical components are already separated by the
source graph. A closed coincident boundary may cover a whole component; its
source graph vertices still partition that component into intervals.

For every source graph edge, retain only events which evaluate to that exact
branch, not another branch at the same u. Split at their u values, or v values
for vertical edges. On each complementary open interval there is no boundary
crossing or overlap endpoint. Domain location is therefore constant. One exact
interior evaluation classifies the WHOLE interval as inside, boundary, or
outside. Keep the first two and their closed endpoints. This is classification
after a complete event partition, not unchecked geometric sampling.

Boundary contacts are also retained as points even if both neighboring
intervals are outside. A closed singular component wholly inside a hole is
removed by interval and vertex classification even with no boundary crossings.
Returned points include finite solutions, graph vertices, boundary events and
region witnesses; they are not claimed to be only isolated components.

`evaluateNurbsTrimSingularEdge3` checks factory ownership, source indices and the
retained closed interval before evaluating the implicit graph and its known
one-sided surface patch. It cannot evaluate across an excluded hole interval.

## Wholly singular patches

When the source singular set fills a rectangle, retain its exact nonempty
intersection with the domain as an implicit `region={domain,patch}`. This
intersection may be lower-dimensional at boundary-only contacts; no area or
component count is inferred.

Nonemptiness is decided using all patch corners, the domain's strict material
sample, and endpoints/interior witnesses of the completely knot-partitioned
boundary spans. If a boundary meets the rectangle, at least one such event or
cell witness does too, because all rectangle sides are surface knots. If no
domain boundary meets the rectangle, either the rectangle is wholly on one
side of each boundary (its corners decide membership), or the whole domain is
inside the rectangle (its material sample decides). These possibilities cover
nonempty closed intersections, including tangent contacts. Witnesses are
filtered by exact domain location and closed rectangle bounds.

## Meaning of regularity

`regular` means no rank-deficient parameter of ANY incident one-sided closed
patch remains in the domain. At a knot boundary this includes incident patches
even if material lies on only one side. This explicit convention preserves
one-sided information instead of silently selecting a global knot side.

The supporting surface can be singular outside the trim while the restricted
report is regular. Conversely, continuity of the spatial image, C1/G1 seam
matching, regularizability by a different chart, global injectivity, periodic
seam quotients and spatial face/solid validity are not certified. A report may
be rank-regular even when an unused or retained positional seam is discontinuous;
use the separate `analyzeNurbsTrimSeams3` report for trim-restricted seam checks
([construction](nurbs-trim-seams3.md)).

## Evidence

Tests cover hole-induced graph splitting, complete exclusion, boundary overlap,
isolated tangency, irrational cuts, finite and shared-factor isolated points,
a closed singular loop wholly removed by a hole, wholly singular rectangles,
boundary-only rectangle contacts, forged cached location methods and out-of-domain
boundaries. Retained edge evaluation checks actual spatial positions and rejects
parameters in excluded intervals. Vertical edges and different branches at
the same u are checked separately. These are exact algorithms with documented
arguments and tests, not a new machine proof of TypeScript execution.
