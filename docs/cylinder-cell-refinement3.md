# Reusable multi-cutter cylinder face refinement

`partitionCylinderFaceCellsByCylinder3` and `refineCylinderFaceCells3` overlay a new cylinder/plane arrangement on an owned cylinder face partition. Inputs may be the original cylinder partition, its legacy plane refinement, or a result of this new refiner. Continue both plane and cylinder operations through `refineCylinderFaceCells3`; the legacy plane-only function retains its own original backend ownership checks.

Results retain the original primary cutter and `cells[].side`, ordered cylinder/plane sign vectors, immediate input cell IDs, the complete ordered cut sequence, native/SSI closed boundaries and mixed sewing. They partition the entire source band/angular face and preserve both strict sides. Material selection, solid shell assembly and prior curved Body operands are separate operations.

## Complete overlay events

The incoming cutter is first partitioned against the same original cylinder band. Global angular cuts include all old/incoming angular endpoints, critical/clipping/contact projections, old SSI intersections with the new cylinder/plane, incoming SSI intersections with old plane/constant height bounds, and plane-height graph crossings. Two plane graphs meet where their rational axis-parallel difference vanishes on the base circle. Native axial generator intersections introduce no new angle: those generator angles are already cuts.

Between consecutive events, old bounds and incoming root graphs have a fixed order, with constant graph count. Exact interior evaluation can therefore select and order only incoming roots strictly between the old bounds. Duplicate incoming roots and coincident bounds do not create zero-area open cells. This representative evaluation relies on complete event discovery; it is not used as a whole-curve containment certificate. The source lower/upper graphs remain intact, so every output cell is a subset of its mapped input cell, and all their closed cells cover that input. Tangencies and critical coincidences are retained at shared endpoints even if open signs do not change.

Every new cell has a strict rational-height witness and a checked nonzero cutter sign, except a cutter coincident with the entire base cylinder, whose sign is zero throughout. Earlier signs are inherited using immediate cell provenance. Both kinds of refinements remain reusable in arbitrary alternating sequences.

## Exact endpoint and predicate handling

Known event points are reused only after exact base projection and supporting-surface checks. If the required SSI branch is the opposite root of a verified same-fiber point, the new point is obtained by the rational affine reflection p' = p - (2/a)*d*(m·(p-secondOrigin)). Here m=|e|²*d-(e·d)*e and a=|d×e|². It preserves the first cylinder's base and exchanges the second cylinder's quadratic height roots. RUR/affine/biparametric coordinate relations are preserved, and generic reflection combines rational coefficients before evaluating them. A point is privately registered as a supporting SSI point only after these actual checks and the exact construction; public properties cannot establish ownership.

RUR discriminants are evaluated as rational functions of their original parameter rather than independently multiplying conjugates. Actual factory SSI support identities, exact linear sign/projection comparison, and certified rational-interval cylinder sign filters avoid unnecessary field extensions. Unresolved intervals retain the complete algebraic fallback, including exact zero and arbitrarily small nonzero values. These are computational improvements, not tolerance-based decisions.

## Persistence

`encodeRefinedCylinderCellDomain3` stores the original band/cutter, ordered native plane/cylinder cuts, an exact strict interior selector and orientation. `decodeMixedFaceDomain3` replays the whole sequence and requires exactly one open cell to contain that selector. Batch decoding reuses identical definitions while selecting and binding each face separately. `restoreMixedBRepFaces3` matches complete oriented boundaries to common BodyRecord uses. A refined open wall is not a certified solid region merely because its individual face domains restore.

The new domain kind does not yet provide multi-cutter planar cap arrangements, material Boolean assembly, arbitrary BRep certification or chained curved Body operations. NURBS cutters are rejected. Recorded cuts and returned metadata are immutable. The construction/event completeness and reflection arguments are documented mathematics and executable regression tests, not new machine-checked TypeScript refinement proofs.

Tests cover three-cylinder quartic bounds, interleaved plane/cylinder operations, repeated cutters and inherited signs, parallel/tangent/coincident support cases, ordered common-record face replay, ownership/witness rejection, genuinely oblique targets, shifted signed nonunit frames, reversed face orientation, source singular fibers and tangent triple contacts. Predicate tests independently strip SSI provenance and verify reflection coordinates/supports, exact zero projections, and signs at 10^-40 offsets.
