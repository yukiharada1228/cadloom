# Exact faces of line/circular-arc arrangements

`buildCurveFaces2` groups boundary walks from `buildCurveHalfEdges2` into the
connected open cells of the complement. Face 0 is unbounded. Boundary and
half-edge indices retain the noded graph's indexing. A face can have several
boundary walks, including bridges; `boundaries` is not an outer/hole orientation
classification. Isolated vertices belong to a face but are not boundary walks.

## Construction argument

All edges are x-monotone after noding at circle extrema. Between consecutive
vertex x coordinates, a rational x exists and is found by refining disjoint
algebraic certificates. No vertex, crossing or vertical edge occurs on this
fiber. Its strictly ordered crossings bound open vertical bands. The band above
one crossing and below the next belongs to both corresponding left-side walks;
the bottom and top bands belong to the unbounded face. Union-find records only
these geometric equivalences. Canonical line edges increase x; canonical upper
circle arcs are clockwise and lower arcs counterclockwise, so half-edge 2e has
the face above it on its left.

Every boundary walk of a component with a nonvertical edge must appear in a
slab; the implementation checks this. A connected component made only of vertical
edges lies on one line and has one boundary walk. A ray upward from its highest
vertex attaches that walk to the containing face. Other vertical components can
be attached transitively. Isolated points are attached by the same ray method.
At a ray hit on a vertex, the clockwise predecessor of a synthetic downward
straight germ selects the face below, including tangencies resolved by curvature.
A downward overlapping straight edge cannot be a first hit from an open query:
its lower endpoint or its interior would already obstruct the ray.

These unions are sound because their witnesses remain in the open complement.
For V vertices, E edges and C graph components (including isolated points), the
number of open faces is E - V + C + 1. After all sound unions, the implementation
requires exactly that number of classes. Together with slab visibility and the
vertical-component attachment, this checks completeness; the count alone would
not establish that a particular union was sound.

Each bounded class receives a rational point in a witnessed open band. The
unbounded witness lies strictly left of every graph vertex. Location first checks
vertices, then closed vertical intervals and fiber crossings, and otherwise uses
the upward ray. Algebraic query coordinates are supported without conversion to
floating point. The returned incidence lists and location records are frozen.

## Principal square roots

For a positive algebraic alpha with defining polynomial p, p(X²) vanishes at
sqrt(alpha). Isolate its positive roots and refine their squared intervals against
alpha's interval. Squaring is strictly increasing on the nonnegative reals, so
exactly one candidate survives. Distinct roots have positive separation; continued
refinement eventually removes every other candidate. Zero is handled before this
construction, including zero represented by a nonminimal defining polynomial.
Negative inputs throw. Rational inputs use X²-alpha directly. No floating point,
iteration cutoff or irreducibility assumption is used.

## Evidence and limits

Tests compare two-circle face labels against independent squared-distance signs,
and straight arrangements against the existing area/winding face builder. They
cover nested/disjoint/intersecting/tangent circles, vertical trees and tangent-event
rays, isolated algebraic points, exact algebraic boundary queries, input order,
and a 10^-30 thin annulus. Every face witness is located back to its own face;
incidence, boundary coverage and dual connectivity are checked.

These are construction arguments and executable tests, not machine verification
of the face algorithm, algebraic square-root implementation, union-find or
TypeScript runtime. Curved filled-region Booleans, curved areas, splines and
curved 3D BRep remain subsequent kernel work. Algebraic field degree growth and
all-pairs noding can be expensive; no production-scale performance claim is made.
