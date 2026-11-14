# Exact boundary sewing

`sewBRepFaces3` takes explicit oriented boundary loops on plane/cylinder
supports, nodes their curves at every supplied endpoint, merges identical
pieces, and builds shared-edge BRep incidence. It preserves analytic geometry:
circular and affine-circle arcs become the equivalent exact elliptic-arc model,
and bounded straight curves become exact algebraic segments.

## Subdivision and matching

Snapshot each source curve through its defining geometry first; cached mapped
start/end fields of affine planar arcs are recomputed rather than trusted.
Pre-split elliptic arcs at their intrinsic quadrant points, so periodic curves
have explicit nonpoint cells. Collect all resulting endpoints and semantically
weld algebraic coordinates. For every source primitive, insert every collected
point that lies on it, in its exact traversal order. Segment overlap boundaries
and coincident elliptic-arc overlap boundaries are endpoints of at least one
input primitive. Their union therefore induces the same atomic pieces on both
copies, even if their original subdivisions, seams, directions or ellipse
charts differ. An endpoint lying in another curve's interior is also inserted,
resolving supplied-endpoint T-junctions without a tolerance.

Equal straight pieces have the same unordered endpoint pair. Elliptic pieces
also require coincident supporting ellipses and compatible bounded arc sets;
endpoint direction determines the signed use. Each global piece is stored
once. Original loops concatenate these uses in source traversal order.
`sourceUses[face][loop][curve]` records all resulting uses of each original
curve, including inserted quadrant subdivisions. `faceLoops` contains the
corresponding flattened loops.

The existing BRep builder checks whole-curve support, exact loop closure,
coedge twins, orientation consistency and vertex links. With `requireClosed`,
reject boundary edges, inconsistent or nonmanifold incidence. Empty input is
an empty valid complex. All returned incidence and provenance arrays are
immutable.

## Scope

This is a boundary-sewing operation, not a complete intersection/noding or
embedding validator. An intersection of two curve interiors is not discovered
if its point is absent from every supplied endpoint. Such crossings must be
computed and split before sewing. Closed incidence alone does not certify
arbitrary face domains, physical normal orientation, self-intersection,
material location or a solid. The constructive cylinder clipping API supplies
its own geometric domain argument and complete constraint intersections before
using this sewing layer.

Tests sew a cube with mismatched edge subdivisions, verify source provenance,
merge coincident circular/elliptic parameterizations of periodic boundaries,
and check missing caps and inconsistent directions. Full TypeScript execution
is not machine-verified.
