# Common constructed Body API

`createBoxBody3`, `createCylinderBody3` and `extrudeBody3` return the same immutable,
factory-owned `Body3`. It carries a common exact `BodyRecord3`, decoded geometry,
rebuilt native incidence, a normalized material construction and strict interior
samples. The public interface exposes neither the old operation-specific source
object nor caller-supplied validity flags.

This advances M1 of the [SolidCore reimplementation plan](solidcore-reimplementation.md).
It is a constructive import path for supported operations, not a general validator
of arbitrary imported solids or completion of all M1 requirements.

## Supported constructions

- `createBoxBody3(origin,width,depth,height)`: an axis-aligned analytic box with
  strictly positive rational dimensions and a rational origin. Positivity is exact;
  no upstream floating-point small-dimension threshold is copied.
- `createCylinderBody3(cylinder,lower,upper)`: the existing finite convex cylinder
  construction. Radius squared is positive and the rational axis is nonzero.
  Bounds are parameters on that supplied axis, not distances: a non-unit axis
  scales physical height. Existing constructor validation requires increasing
  bounds.
- `extrudeBody3(profile,height,options)`: the existing vertical product of a
  regularized XY line/circular-arc region with a height interval. It retains
  analytic walls, holes, disconnected material and exact algebraic trims. Zero
  height and nonmanifold pinches are rejected. Empty material remains empty.

The extrusion construction document stores canonical line/arc profiles with
material on the left and increasing lower/upper heights. It records normalized
material, not original sketch input, the original height sign or feature history.
Replay uses nonzero fill on this canonical boundary. General swept directions,
NURBS extrusion profiles, additional analytic primitives and closed internal
cavities are not supplied by these three entry points.

## Record-to-boundary checks

`restoreNativeBRepBoundary3(record)` restores native face-boundary incidence:

1. Read the strict exact data and construct individual geometry definitions.
2. Compare each curve's actual ordered endpoints with its declared vertices.
3. Apply the face-use directions from declared shells. Reverse loop traversal
   and face sense together when a shell uses a face backwards.
4. Rebuild the shared kernel's native BRep incidence. Whole curves must lie on
   their supporting surfaces, not merely their endpoints.
5. Check stored vertex identities against exact endpoint welding. Distinct
   serialized vertices which would be silently welded together are rejected.
6. Compare declared shell face partitions with the actual edge-connected shells.

The result includes a vertex-ID map because the native engine sorts geometric
vertices. Record face and edge order remain the input order. The converter
supports native face shells; NURBS edge/surface conversion, wires and isolated
vertex shells require other backends. Optional pcurve geometry is checked by the
geometry decoder, but its complete spatial correspondence is not established.
Open or inconsistent boundary diagnostics can still be returned: this converter
does not certify face domains, geometric loop orientation, global embedding,
region nesting or material. There is no `locate` or solid certificate on it.

## Constructive adoption and common queries

The Body adoption path requires original factory provenance for an extrusion or
clipped cylinder. A new extrusion registry provides the same ownership check
already used by clipped cylinders. A spread copy with forged methods or incidence
flags cannot supply a validity argument. These adoption endpoints are internal;
public entry points create their own kernel sources.

A Body's native tables are exported, decoded and rebuilt through the preceding
checks. Closed oriented incidence, face-table alignment, one strict sample per
constructed material component and sample membership are checked again. The
construction's product/convex embedding arguments establish the material roles;
closed incidence alone is not used for that inference.

For these constructors each material component has one shell, including
through-hole handles. The infinite region references every shell, and each
bounded material region references its own shell. No enclosed void is invented
for a through-hole. Common Body records therefore have consistent region roles
for empty, connected and disconnected material.

`locateBody3(body,point)` uses the protected exact classifier from that validated
construction. `locateBodyFace3(body,index,point)` uses the corresponding bounded
face-domain classifier, with the same global face index as `body.record.faces`
and `body.topology.faces`. A point in the interior of a cap is inside that face
but on the solid boundary. Query and serialization entry points check Body
ownership; structural copies are not accepted as owned Bodies.

Supported face definitions are now serialized and rebound independently as
described in [face-domain records](face-domain-record3.md). Common face queries
use those reconstructed definitions. The native records and rebuilt geometry
are a common operation interface,
while construction provenance and face-domain queries remain protected. This is
more than labeling old objects: it adds exact record/geometry agreement and
shared connectivity checks at the conversion boundary. General new operations
must maintain the same representation and provide their own validity arguments.

## Save/load with reconstruction

`bodyDocument3` and `serializeBody3` produce a versioned `BodyDocument3` containing
both an exact Body record and a supported construction description.
`readBodyDocument3` / `parseBodyDocument3` perform only structural reading.
`restoreBody3` then:

1. Revalidates the document and all stored data with representation-size limits.
2. Replays the supported construction using actual kernel operations.
3. Compares the stored ordered Body record with the reconstructed record.
4. Returns the newly reconstructed owned Body only on agreement.

Comparison uses exact scalar and point values rather than JSON byte equality.
Unreduced rational strings and equivalent affine/coordinate point encodings are
accepted. Topology order, role flags, support parameters and all other fields
must agree. This is not BRep graph isomorphism or arbitrary geometric-set
equivalence. An altered recipe plus an old record, changed void roles, flipped
face uses or changed vertices is rejected. A coherently edited document which
really reconstructs another supported valid body is not a security violation;
no authenticity or signature claim is made.

An arbitrary raw `BodyRecord3` still does not gain solid status. Optional face
parameter bounds or pcurves not generated by the recipe cannot silently change
the result. Loading uses the recipe's newly reconstructed and boundary-bound face domains, not serialized callbacks
or cached flags. Legacy documents missing domain definitions regenerate them;
provided definitions must still agree.
Reconstruction may be costly, especially for algebraic curved geometry. Input
budgets constrain representation size, not total geometric computation time.

## Evidence and remaining work

Tests compare boxes with independent rational interval predicates and cylinders
with independent radial/axial inequalities, including huge offsets, tiny dimensions,
algebraic boundary points and non-unit axes. Further cases cover through-holes,
empty/disconnected material, nested circular islands, skew cylinders,
algebraically trimmed profiles, negative extrusion, face indices, mutation
isolation, ownership counterfeits and changed save documents. Native boundary
conversion rejects mismatching endpoints, wrong supports and fictitious connected
shell declarations.

This is constructively validated geometry with scoped mathematical arguments and
tests; it is not a new Lean proof or whole-TypeScript verification. Arbitrary
record-to-solid certification, general face-domain import, complete pcurves,
closed-void containment and broader operations remain outstanding. SolidCore's
native file format and API are not claimed compatible.
