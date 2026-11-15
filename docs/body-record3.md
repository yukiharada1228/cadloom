# Body record v1: exact data and structural validation

This is the first common-data milestone in the [SolidCore reimplementation
plan](solidcore-reimplementation.md), not completion of the common modelling
Body API. It records existing bounded geometry and explicit topology without
runtime methods, ownership registries, cached diagnostic flags or float-valued
geometric coordinates.

The record/convert responsibility split and declared region/shell roles are
informed by the pinned [SolidCore record](https://github.com/tangency-labs/solidcraft/blob/cd20a1fe14062cc1642e1c04fb9805f86d9e2eef/solidcore/crates/solidcore-record/src/brep.rs).
This is an independently implemented cadloom format, not that file format or an
API-compatible translation. No upstream implementation code is included.

`src/record/` contains only record definitions and structural readers; it has no
geometry or numeric-kernel imports. `src/convert/` owns encoding, restoration and
calls to the existing geometric factories. The package entry point re-exports
both without moving geometric computation into the record layer.

## Data model

The top level fixes `version:1`, millimetres and right-handed Z-up coordinates.
Indices address tables in their stored order; round trips do not implicitly
weld coincident points or reorder faces.

| Table | Meaning |
|---|---|
| curves | Bounded lines, algebraic endpoint segments, circular/elliptic/planar circular arcs, positive-rational-weight NURBS curves |
| surfaces | Rational planes, cylinders and positive-rational-weight tensor NURBS surfaces |
| vertices | Exact coordinate triples or registered rational affine parameterizations |
| edges | Curve index and oriented start/end vertex indices |
| loops | Ordered edge uses with directions; optional local pcurve indices |
| faces | Surface index, sense, loop indices, optional exact parameter bounds and supported analytic domain definitions |
| shells | Face uses with direction and optional embedded wires, a wire graph, or an isolated vertex |
| regions | Shell indices and a declared void flag; index 0 is infinite and never void |

For bounded regions the first shell declares the outer boundary and later
shells declare cavities. A physical shell can be shared by two regions, for
example infinite/material or material/void. These roles do not prove containment.
Open sheets, wires and points can be represented without inventing bounded
material. Their declared region membership is data, not a containment proof. A pcurve,
when present, is a bounded local (u,v,0) curve traversed in its edge use's direction;
its parameter correspondence to the spatial curve must be checked separately.
Absent pcurves do not imply a valid face-domain reconstruction.

Unlike formats with unbounded shared supports, this version's curve table
stores bounded curves. General per-edge restrictions of a shared unbounded
support, procedural definitions, certified approximations, additional analytic
surface kinds and complete imported face domains remain future schema work.
Unknown kinds and versions are rejected, not silently approximated.

## Exact numbers and correlations

A rational is a signed integer or integer-fraction string, never a JSON Number.
Encoders use normalized fractions. Readers also accept unreduced fractions;
decoders normalize them with the existing rational implementation. Decimal and
exponent strings, zero denominators and non-finite spellings are rejected by
the structural grammar. Only nonnegative safe integer indices/degrees and the
orientation signs use JSON Number.

An algebraic real is either a rational or a rational polynomial (coefficients
in increasing power order) plus rational lower/upper bounds. Structural reading
checks the syntax; `decodeExactReal3` additionally requires a nonconstant
polynomial, ordered OPEN bounds, no root at an endpoint and exactly one distinct
real root inside. Sturm counting and exact root isolation restore the selected
real branch, including a negative branch or a nonminimal certificate. No
irreducibility assumption or floating-point root selection is used.

A point whose affine correlation is registered in the kernel stores its rational
origin, rational direction and one parameter. This preserves correlations through
JSON. Unregistered public properties are ignored by encoders; ordinary coordinate
records remain exact but may require more costly algebraic arithmetic. Geometry
reconstruction can normalize the form of a certificate, so equality of the restored
value does not imply byte-for-byte equality after re-encoding decoded geometry.

## Three distinct boundaries

1. `readBodyRecord3` / `parseBodyRecord3` make an immutable, strict data snapshot.
   They check fields, scalar grammar, array shapes, spline counts/grid dimensions,
   ID ranges, closed edge-use chains, loop/face ownership, region references and
   duplicate references. Orphan topological edges/vertices are rejected; unused
   geometry definitions may remain in the geometry library tables.
2. `decodeBodyGeometry3` constructs each stored geometry definition through the
   existing kernel factories, verifies unique algebraic roots and checks pcurves
   lie in the local plane. This rejects, for example, zero plane normals or
   invalid NURBS knots/weights. It restores only vertices and the curve/surface
   tables; face parameter bounds are retained as data for the later face-domain
   importer. It still does not create a trusted modelling Body.
3. An arbitrary owned Body import must check curve endpoints against vertices,
   complete pcurve correspondence, face domains, face/shell connectivity,
   orientation, embedding, region nesting and solid validity before granting any
   geometric certificate. Neither of the preceding APIs claims these checks.

`bodyRecordFromTopology3` exports existing native boundary tables. Callers must
provide region declarations explicitly: closed incidence is not used to guess
material or void semantics. The original face domain objects and their runtime certificates are not
serialized by this low-level boundary exporter. Common Body creation separately
adds [portable face definitions](face-domain-record3.md) and validates their
boundary binding. The exporter alone is not a material Body save/load operation.

## Input budgets

The reader limits visited record items and total numeric-string characters
(defaults 1,000,000 and 16,000,000). The text parser also checks a derived text
length budget before JSON parsing. Invalid limit values, sparse arrays and
inherited required fields are rejected. Readers copy own fields and freeze
nested arrays/objects, retaining no mutable input arrays.

These are representation-size limits, not execution-time guarantees for root
isolation or other geometry construction. Algebraic decoding can be expensive;
callers handling untrusted jobs still need their usual computation/resource
policy. Stored flags and supplied methods never certify geometry.

## Evidence and next step

Tests cover exact round trips beyond Number precision, opposite root branches,
invalid root certificates, affine provenance, native curve families, weighted
NURBS, a box, an obliquely clipped cylinder with elliptic arcs, explicit shared
shell/void roles, wires, points, bad references/orientations, mutation isolation,
malformed data, budgets and the distinction between structural and geometric
validity. Deliberately coincident shells can pass structural checks, illustrating
why those checks do not prove a solid.

The [common constructed Body API](constructed-body3.md) now consumes this
representation for Box/Cylinder/vertical Extrude, adding native boundary checks
and construction replay. Arbitrary record-to-solid import still needs the
remaining geometry/topology invariants. This record milestone alone does not
satisfy M1. The algorithms are executable
checks, not whole-TypeScript machine verification or new Lean proofs.
