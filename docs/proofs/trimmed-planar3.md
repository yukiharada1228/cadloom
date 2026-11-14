# Reusable planar halfspace trims and ellipse disk faces

`prepareEllipseFace3` constructs an embedded closed ellipse disk with the
existing rational conjugate-axis ellipse model. Its physical orientation is
selected by sense, its boundary is an exact periodic elliptic arc, and its
center is an interior sample. Factory-owned translation preserves this domain.
This adds the planar cross-section primitive needed for oblique cylinder caps.

`prepareTrimmedPlanar3` intersects a factory-owned planar domain with finitely
many rational halfspaces and regularizes the resulting 2D material. Supported
bases include existing chart regions with line/circular-arc boundaries,
circular disks with holes, rectangles with algebraic bounds, and ellipse disks.
`splitTrimmedPlanarByPlane3` returns reusable child regions and shared-edge
incidence. No polygonal or floating-point approximation is used.

## Coordinates, constraints and degeneracy

Choose an injective rational plane chart p=o+x*U+y*V. A cutting plane restricts
to a*x+b*y+c. Normalize each nonconstant oriented inequality to a*x+b*y+c<0,
using a positive rational scale, and deduplicate by exact coefficients. The
world-space representative uses rational dual chart vectors, so it has the
same restriction even in a skew chart. Constant inequalities are redundant
when c≤0, including a halfspace whose boundary contains the entire support
plane. A positive constant rejects the whole region; public halfspace metadata
preserves a rejecting constant for reconstruction and subsequent cuts.

For a split whose cutting plane contains the whole planar support, return
`kind: 'coplanar'` with the input region, rather than silently duplicating its
interior into two children. Parallel disjoint cuts give one empty child.
Opposite nonconstant inequalities leave only lower-dimensional material and
therefore an empty regularized 2D domain. Tangent points or lines with no
adjacent 2D material are also removed.

## Canonical curves and exact slices

Convert bounded straight edges to algebraic endpoint segments and circular or
affine-circle arcs to the existing elliptic-arc model. Original physical
traversal is preserved. A rational affine-circle map remains exact; spatial
circles with arbitrary rational normal use independent rational basis vectors
and their separate squared coordinate radii.

In the selected chart every ellipse has a positive-definite rational quadratic
`K*y²+L(x)*y+C(x)=0`, with K>0, L linear and C quadratic. At a real algebraic x,
use the exact sign and rational-function image of `L²-4*K*C` to find zero,
one or two real y roots. Filter them by bounded cyclic arc order in the
ellipse's own chart. Horizontal slices exchange the two coordinates. Segment
slices solve linear interpolation, with constant-coordinate cases handled
directly to avoid expanding dependent algebraic fractions.

A conservative rational box comes from endpoint root certificates and complete
ellipse coordinate extrema. An ellipse linear coordinate p*x+q*y has squared
support radius A*p²+B*q²; its extrema have correlated algebraic representations.
The box is expanded strictly beyond these bounds. Using full supporting-ellipse
extrema even outside a bounded arc only adds harmless extra subdivisions.

## Vertical cells and connected interiors

Critical x values include all boundary endpoints, vertical ellipse extrema,
line/boundary intersections, cutting-line pair intersections and vertical
cutting lines. Between consecutive distinct critical values, boundary y-order,
line y-order and material topology cannot change. Pick a rational x strictly
between their isolating certificates. Sort the exact boundary and line hits
along its vertical fiber. Test one point between adjacent hits against the
linear constraints. Away from base critical coordinates, crossing the validated
base boundary toggles inside/outside parity; at a base critical coordinate use
the original factory domain's strict membership predicate.

Each selected open vertical interval extends to a connected cell across that
open x slab. For every critical x, enumerate its strict feasible vertical
intervals too. Their interior points determine connections to the neighboring
slab cells. A probe cannot simply be an arbitrary nearby-looking interior
point: along its horizontal ray enumerate every base-boundary and cutting-line
intersection and choose a rational x before the nearest such event, also
within the adjacent slab. The whole probe path then stays in strict material,
so it cannot jump across a hole or into another component. The selected fiber
interval order is constant in an open slab; matching its ordinal identifies
the neighboring cell. Union these exact adjacencies.

Completeness follows by vertical projection of any strict interior path: each
crossing of a critical line passes through one of its enumerated strict
vertical intervals. Conversely, the no-event probe paths and each open cell
supply interior paths for every graph adjacency. Graph components are therefore
the connected relative interiors. Multiple intervals in one fiber are allowed,
which is essential for holes and concave input domains. Boundary contact points
alone do not connect interiors.

## Boundary, component ownership and repeated cuts

Node original boundary arcs at vertical extrema and all cutting lines. For
each cutting line, construct a rational finite segment spanning the complete
base box, node it by the base boundary and other cutting planes, and retain
its open cells strictly inside the base. Orient the line with material on its
physical left.

An original or new boundary cell survives only if it violates no constraint.
If it lies in a constraint plane, its inward side must strictly decrease that
constraint. In chart coordinates, with physical chart orientation sign S and
tangent (tx,ty), that derivative has sign S*(b*tx-a*ty). This is an orientation
statement and does not require an orthonormal chart. Coincident original
boundaries stay on their one material side; redundant segment pieces merge.

Label each retained boundary cell by a point on its physical inward axis ray.
Again choose a point before the nearest boundary/line event, not merely the
first arbitrary point that happens to be inside. Its vertical-cell component
is the boundary cell's unique adjacent material component. Boundary loops are
traced only when incoming/outgoing continuation is unique; otherwise `loops`
is null while the exact domain remains reusable.

Strict interior queries use the vertical component labels. Boundary queries
use the retained edges assigned to each component. Thus touching closures can
share a point while their interiors stay distinct. A cut recomputes the full
arrangement from the owned base and all normalized constraints. Child domains
can be cut again. Merge opposite child uses into one common edge table and,
when all component loops are unambiguous, build one BRep incidence face per
component. Global touching-vertex singularities remain explicit diagnostics;
this is not a manifold shell or solid certificate.

## Avoiding unnecessary algebraic expansion

For an axis-aligned algebraic rectangle edge, solve its varying coordinate
from the cutting line directly. For two endpoints with a trusted common
rational line support, intersect that support with the plane rather than
interpolating two dependent world coordinates. A normalized segment parameter
between two quadratic conjugates is evaluated as one rational function of one
root.

When two distinct values are roots of the same quadratic a*x²+b*x+c, their sum
is -b/a and product c/a. Lean checks `quadratic_roots_vieta`; the numeric field
uses these identities and recognizes equal certificates before forming
independent resultants. Perfect rational square roots use BigInt integer
Newton iteration and are accepted as rational only after exact numerator and
denominator square checks. Other square roots retain the existing real-root
isolation and branch-selection path. Tests include large non-dyadic rational
squares and nearby nonsquares.

Linear halfspace predicates compare y against an affine algebraic line bound
instead of constructing a difference of dependent algebraic values. These
reductions preserve exact semantics while reducing many gratuitous conjugate
products. They do not supply a uniform time or memory bound. The skew-chart
ellipse fixture still takes tens of seconds locally; general algebraic field
expressions can grow substantially.

## Evidence and limitations

Independent rational quadratic/polygon inequalities test rectangle, disk,
elliptic disk, annular and concave-chart trims, holes, algebraic bounds, thin
rational caps, arbitrary rational plane normals, reversed sense, cut order and
normal rescaling. Tests check connected-component ownership, closed loops,
shared opposite uses, coplanar semantics, empty metadata reconstruction and
nonmanifold contact diagnostics. Numeric tests independently check Vieta values
and rational square certificates. Existing scoped plane/ellipse identities
and the new Vieta theorem support important algebra; the cell enumeration,
component extraction and complete TypeScript execution are not machine-verified.

This family trims existing owned planar bases by rational halfspaces. It does
not yet clip them by arbitrary new curved regions, construct faces from
arbitrary manually supplied ellipse loops, extract an individual planar
component as a separate owned input, sew cylinder walls to cap faces, or
implement curved solid Booleans. A child region as a whole is reusable and
contains component-level geometry and queries for later sewing work.
