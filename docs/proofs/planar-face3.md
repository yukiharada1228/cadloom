# Embedded planar face domains and boundary orientation

`preparePlanarFace3(frame,region,sense)` and
`prepareCircularFace3(outer,holes,sense)` construct immutable nonempty connected
compact planar face domains with disjoint manifold boundary loops. Both return
`PreparedPlanarFace3`: supporting plane, sense, non-unit oriented normal, exact
boundary curves, a one-face BRep incidence model, an interior witness and an exact
inside/boundary/outside query. The factories validate their own supported domain
representations; they do not certify arbitrary pre-existing BRep face tables or
cylindrical faces.

A valid isolated face normally has boundary-edge diagnostics in its incidence
model: it is an open surface, not a closed shell. Individual face embedding and
orientation do not imply that several faces form a valid embedded material solid.

## Chart domains: strict input boundaries

An injective rational plane chart maps local points to o+x*u+y*v. Input is the
existing line/circular-arc `CurveRegion2` representation. Local circles can map
to spatial ellipses. The chart's u×v supplies the base supporting-plane normal;
sense +1/-1 specifies the intended orientation relative to it.

Build the exact local curved arrangement and propagate nonzero windings, then
require all of the following:

1. Exactly one selected open face, so the material interior is nonempty and
   connected rather than disjoint components or components separated by internal
   input edges.
2. Every material winding equals sense with unit multiplicity; every other face
   has winding zero. Incorrect orientation, duplicate coverings and wrong hole
   orientation are rejected.
3. Every noded edge has exactly one source use and separates selected/unselected
   faces. Internal, canceled, retraced or coincident input geometry is rejected.
4. Every input primitive contributes a positive-extent edge. A point primitive
   merged into an existing boundary vertex must not escape this check.
5. Every arrangement vertex has two outgoing half-edges. Isolated points,
   crossings and touching boundary cycles are rejected.

With complete noding, these conditions make each boundary graph component an
embedded cycle, retaining legitimate two-edge circles. All source geometry is
accounted for, and the one selected bounded complement face has a connected
interior and compact closure. The input is validated rather than silently healed
or replaced by its regularization. A caller may explicitly regularize with the
Boolean API first if normalization is desired.

The Boolean result emits canonical material-on-left local boundaries. For sense
-1, reverse both cycle order and each primitive traversal when lifting them to
3D. The differential of the affine chart preserves the oriented normal u×v;
therefore the resulting physical boundary orientation agrees with
sense*(u×v), including reflected/skew charts. The stored local Boolean result
remains canonically oriented; it is not itself reversed.

A local rational interior sample maps to a rational spatial point, represented
through the algebraic-coordinate API. For queries, exact chart inversion rejects
off-plane points, then the regularized local locator classifies the domain.

## Arbitrary-normal circular domains

Rational affine-circle charts do not represent every spatial circle. The circular
factory directly accepts a positive-radius `Circle3` outer disk and zero or more
positive-radius circular holes. Every hole must share the outer plane, be strictly
inside it, and have a closed disk strictly disjoint from all other hole disks.
Hole normal sign/scale does not affect the region; outputs use the outer normal.
This route includes disks/annuli perpendicular to the direction (1,1,1).

Let O be the outer squared radius, H a hole squared radius, and L the squared
center distance. Strict containment is equivalent to

    A=O-L-H > 0,  A² > 4*L*H.

For two holes with squared radii H1,H2 and squared separation L, strict disk
separation is equivalent to

    A=L-H1-H2 > 0,  A² > 4*H1*H2.

Both follow from the same nonnegative-length equivalence, checked in Lean as
`Cadloom.strict_sum_squares_iff`:

    b+c<a  iff  A=a²-b²-c²>0 and A²>4*b²*c².

The sign condition is necessary before squaring. This distinguishes containment
from disjointness and avoids admitting the extraneous squared branches. Tangency,
nested/overlapping/duplicate holes, point holes, off-plane holes and zero-area
outer disks are rejected without constructing numerical square roots.

The finite collection of strictly interior, mutually separated holes leaves a
connected region and a positive-width collar at every outer boundary point.
Outer full-circle traversal follows sense, and hole traversal follows the
opposite orientation, with all normals reconciled to the outer normal. Thus
physical boundary orientation agrees with the declared plane normal and sense.

Location first checks the supporting plane and outer squared distance, then the
hole squared distances. Circle boundaries are included; hole interiors and
all off-plane points are outside. Correlated affine algebraic points use a
rational quadratic sign predicate; independently algebraic coordinates use exact
field arithmetic.

For an open-face witness, choose a full-circle seam S and dyadic points
C+(1-2^-k)(S-C), k>=1. These lie strictly inside the outer circle and converge to
S. Since every hole has positive separation from the outer boundary, a finite
k lies outside all holes. The implementation checks exact location while doubling
the denominator; no tolerance or fixed iteration cap is used. A 10^-30 annulus
exercises this refinement path.

## Evidence and scope

Tests compare skew embedded chart domains with an independent polygon locator and
compare chart/circular representations with raw integer squared-distance truth
tables. A reflected chart's actual lifted boundary area vector is compared with
the declared oriented normal. Tests cover concavity, holes, both senses,
irrational seams, arbitrary normals, independent algebraic queries, off-plane
10^-30 offsets, strict source coverage, bad/touching/canceled/disconnected
boundaries, caller snapshots and a thin annulus. Circular inclusion/separation
also agrees with independent integer-radius triangle inequalities. Normalized
curved Boolean unions/intersections/differences produce accepted faces with
algebraic trim vertices; disconnected xor outputs are rejected.

The new Lean theorem verifies the strict squared-length equivalence. Domain
noding, graph conditions, lifting, source provenance, location, witness search and
TypeScript runtime behavior are not machine-verified as a complete program.
General conic domains beyond the chart representation, automatic geometric
validation of arbitrary existing BRep tables, general cylindrical face trims, shell
intersection/embedding/nesting and curved solid Booleans remain subsequent work.

Cylinder bands/angular patches and their orientation/location are implemented in
[cylinder-face3.md](cylinder-face3.md).

Algebraic chart rectangles and certificate-preserving translations are described
in [extruded-brep3.md](extruded-brep3.md). These preserve constructed face domains
without pretending to validate arbitrary existing BRep face tables.
