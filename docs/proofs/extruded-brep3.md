# Constructively embedded analytic extrusion BReps

`extrudeCurveRegionBRep3(region,height,options)` constructs the outward boundary
of a vertical product solid, retaining exact plane/cylinder face geometry and
line/arc/algebraic-segment edge geometry. It does not triangulate circular walls
or infer geometric validity merely from closed incidence. The input is a bounded
line/circular-arc `CurveRegion2`; height is a nonzero rational and baseZ is rational.
Signed height is converted to strictly ordered zMin/zMax.

Disconnected components and holes/nested islands are supported. An empty filled
region produces an empty valid complex with no faces or interior samples. General
BRep sewing, arbitrary sweep directions, arbitrary existing solid certification
and 3D Boolean operations are not implemented by this constructor.

## Profile regularization and component partition

First apply the requested even-odd (default) or nonzero fill rule. Re-node only
the resulting true boundary cycles, so canceled/internal source geometry cannot
be mistaken for a domain boundary or split one material component into several
faces. Require two outgoing half-edges at every remaining boundary vertex.
Touching/pinched components, crossing cycles and hole/outer tangencies therefore
fail, rather than producing nonmanifold vertical contacts.

Every canonical boundary edge is singly used with material on its left. Its
left face, adjusted for source traversal, identifies the material component.
Every primitive and every cycle must have one such component. Group outer/hole
cycles by that face ID, checking complete coverage, then validate each group with
`preparePlanarFace3`. This gives disjoint, nonempty, connected, embedded compact
profile domains. Empty input has no groups. Input ring orientation need not be
positive: regularization supplies canonical material-on-left cycles.

## Algebraic rectangles and trusted face translation

Straight walls need rectangles whose horizontal trim parameters can be irrational.
`prepareRectangleFace3` accepts an injective rational plane chart and strictly
increasing algebraic u/v bounds. A Cartesian product of two closed intervals is
an embedded connected planar disk; its four exact straight segments orient with
sense*(u×v). Location uses the exact partial chart inverse and interval tests.
When one coordinate is rational, corner mapping retains the other coordinate's
factory-recorded affine parameter. Independent algebraic bounds remain supported.

`translateCurve3` translates each bounded curve representation by a rational
vector without changing traversal or full-circle seams. `translatePlanarFace3`
translates an already factory-validated planar domain, optionally reversing its
sense and complete boundary orientation. Its new locator pulls queries back by
the inverse translation; the supporting-plane offset changes by -normal·shift.
Local domain metadata is translated consistently, while its local Boolean
construction history remains unchanged.

A private WeakSet permits this certificate-preserving operation only on the
module's factory-created immutable face objects. A structural copy or forged
locator is rejected; arbitrary unvalidated BRep tables cannot enter this path.
The translated result is itself registered, so translations compose. This is a
runtime construction registry, not a machine proof of JavaScript semantics.

## Exact shared boundaries and outward orientation

For each noded profile primitive, create one bottom and one top edge by translating
its validated 3D lift. Create one vertical algebraic generator per profile boundary
vertex, shared by its two adjacent wall faces. Retain arrangement subdivisions,
including circle extrema: a full circular wall can consist of several exact
coaxial patches, not polygonal chords.

Lower caps use bottom edges in reversed traversal; upper caps use top edges in
forward traversal. Each wall uses bottom-forward, end-generator-up, top-reverse,
start-generator-down. Therefore each horizontal rim edge has one cap and one wall
use with opposite directions, and each generator has opposite uses from its two
adjacent walls. No endpoint-based guess of edge identity is needed.

For a straight profile primitive a+t*v, the wall chart is
(a.x,a.y,0)+u*(v.x,v.y,0)+z*(0,0,1). Its positive normal is (v.y,-v.x,0). Sense is
the sign of the directed primitive's end minus start parameter, so the normal
points right of its material-on-left boundary. Algebraic trim bounds specify the
entire rectangle, not only its endpoints. Both cap line edges and wall segments
are the same closed straight interval by affine parameterization.

For a circular primitive, the wall is the corresponding angular cylinder patch.
The circle's center/radius, arc endpoints and traversal are taken from the same
profile primitive. The XY cap chart is isometric and positively oriented, so its
planar-arc representation and the wall's spatial circle representation describe
the entire same rim, not merely equal endpoints. CCW profile arcs have outward
radial normals; CW arcs (including hole walls) have inward radial normals. The
existing circular-tangent/axial cross-product identity supports this orientation.

Factory-created cap/domain boundaries and global face indices are retained in
`faces`. Their incidence tables use local IDs, while `topology` contains the
shared global IDs. The BRep builder checks actual supporting-surface membership,
closure, reciprocal twins and port links. The result must have no incidence
issues and one edge-connected shell per connected profile component.

## Constructive geometric validity

Let D be a validated closed profile domain and I=[zMin,zMax]. The map
(x,y,t) -> (x,y,t) embeds D×I in 3-space. Its boundary is

    D×{zMin} ∪ D×{zMax} ∪ boundary(D)×I.

The cap domains are disjoint because zMin<zMax. Distinct open profile edges do
not intersect, so their open product walls do not intersect. Adjacent walls meet
only on their prescribed common generator, and caps meet walls only on their
common rims. Different profile components have disjoint compact closures and
therefore give disjoint product solids. The verified individual face domains and
constructed shared edges describe exactly this boundary.

This product argument establishes embedding for this construction; it is not a
general-purpose surface-intersection/embedding algorithm. Profile regularity is
essential: pinched or point-touching inputs are explicitly rejected. Nonsmooth
edges do not have a unique global normal, but each incident face has its own
correct material-outward normal.

Location first checks height, then the regularized planar region. Outside either
factor is outside; a profile boundary or a height endpoint is boundary; otherwise
the point is inside. Exact algebraic queries preserve recorded affine correlation
when projecting to XY. One interior sample per component combines a strict
profile witness and the rational height midpoint.

No curved-volume approximation is returned. Circular profiles can introduce pi
and arc-angle terms, so an algebraic number alone is not an exact general volume
representation. Raw V-E+F is not a genus formula here: cap faces can have holes.

## Evidence and limitations

Tests inspect every shared edge's endpoints and an exact interior point against
both incident face domains, reciprocal uses and body location. They cover boxes,
annuli, clipped disks with algebraic straight trims, disconnected components,
nested islands and 10^-30 material/heights. Straight cases agree with independently
triangulated and certified prism solid locators. Independent squared-distance
truth tables check clipped-circle products. Face-normal perturbations distinguish
material interior/exterior, including cavity walls.

Fill normalization, discarded internal input circles, empty/canceled products,
clockwise source rings, pinches, immutable snapshots, rectangle bounds and chained
face translations are checked. All geometry remains analytic and exact.

These construction proofs and independent tests are not machine verification of
component grouping, face-table binding, registry use or TypeScript execution.
Existing scoped Lean arithmetic/normal identities remain checked; no additional
whole-program theorem is claimed. General conics/sweeps, arbitrary BRep validation,
shell intersections and curved 3D Booleans remain subsequent kernel work.
