# Explicit shared-edge BRep incidence

`buildBRepTopology3(edges,faces)` combines exact bounded curve geometry with
vertices, shared edges, oriented coedges, boundary loops, supporting faces and
edge-connected shells. Inputs explicitly identify shared edges by integer index.
This is an incidence inspector, not a certified face-domain or solid constructor.

Every face specifies a plane/cylinder support, sense (+1/-1), and nonempty boundary
loops of `{edge,direction}` uses. Loop traversals are explicit; changing sense does
not automatically reverse them. Sense records the intended normal relative to the
support. Agreement between boundary traversal, face domain and intended normal
still needs geometric face validation.

## Construction invariants

Curve data and supports are validated and snapshotted. Point edges are rejected;
positive full-circle/ellipse edges are allowed despite equal seam endpoints.
Edge/face IDs retain input array order; loop/coedge IDs follow input traversal.
All endpoint records are sorted by exact algebraic lexicographic order, and
semantic equality creates shared vertices. No root-polynomial string or numerical
tolerance is used. Edge identity is not inferred from endpoints: upper/lower arcs
can have the same two endpoints but different interiors. Coincident curves with
different input IDs remain different edges; the caller must supply correct sharing
and prior noding. Intersections with edge interiors are not discovered here.

Each boundary use creates one coedge. Its direction determines origin/target
relative to the edge's intrinsic traversal. `next`/`previous` are inverse cyclic
links in the supplied loop, including one-edge periodic loops. The target vertex
must equal the next origin, including final closure. Each entire referenced curve
must lie on its face's support; endpoint agreement alone is insufficient. Source
indices, direction and sense tags are checked before publication.

An edge with two opposite uses gets twin coedges. The test uses the direction
flags, not endpoint comparisons, because a full circle has the same origin and
target in both directions. Two opposite uses on the same face are permitted,
as required by periodic seams. Single uses are boundary edges; zero uses are
unused-edge diagnostics; more than two uses are nonmanifold-edge diagnostics.
Two same-direction uses produce an orientation diagnostic.

## Vertex links must retain edge-end identity and multiplicity

An edge e has two distinct *ports*: 2e at its start, 2e+1 at its end. Both can
belong to the same welded geometric vertex. Each coedge's origin corner connects
the preceding incoming port to the outgoing port of that coedge. These corners
form an undirected multigraph at each vertex.

Do not replace ports by neighboring vertex IDs and do not deduplicate link arcs.
A one-edge circular disk has two distinct ports and one link arc (an interval).
Two faces sharing that circle give two parallel link arcs (a cycle). A retraced
edge tip can give one port with a self-loop, counted twice in its degree. These
are necessary local incidences rather than numerical tangencies.

Every use of an edge contributes one corner at each edge-end port, so each port
has degree equal to its edge's number of uses. A valid abstract surface vertex
link is connected and is either a cycle (all degrees two) or a path (two degree-one
ends, all other degrees two). Disconnected cycles detect shells or surface fans
that touch only at a welded vertex. Branching or isolated ports are invalid.
The implementation preserves self-loop/parallel-edge multiplicity and checks both
connectivity and degrees.

These link criteria describe local manifold incidence conditional on faces being
valid connected surface domains. They do not prove the geometric domains are
embedded disks/annuli or that their boundary curves form valid trimming regions.

## Shells, boundaries and reported scope

Face adjacency follows shared edge IDs, joining every face in an excess-edge fan
so the defective component remains inspectable. Shells are edge-connected face
components. Each shell reports local closure, paired-use orientation and vertex
links; global links are checked separately. Two otherwise valid shells can thus
have valid local reports while their shared geometric vertex fails globally.

`closedOrientedIncidence` requires every edge to have two opposite uses and every
vertex to have a connected cycle link. Closed edge counts imply port degrees two;
therefore the general link manifold test suffices here. Empty input is accepted
as a vacuously valid empty complex with no shells, not as a nonempty solid.
Unused edges remain in the output and cause diagnostics.

Boundary edges' unique coedges form boundary cycles when each boundary vertex has
one incoming and one outgoing boundary use. Otherwise `boundaryLoops` is null.
The result is only a boundary-edge graph decomposition; it does not override
other incidence or geometric diagnostics. No face Euler characteristic, genus,
volume or outward-solid orientation is inferred from loop counts: faces may have
holes or periodic seams.

Even coincident opposite disks or a zero-area retraced face can pass abstract
incidence. This is intentional evidence that the result is **not** a solid
certificate. Face-domain validation, boundary/normal agreement, intersections,
embedding, shell nesting and material-side orientation remain necessary. Geometry
must not be considered valid merely because this flag is true.

## Evidence

- A tetrahedron and 60 seeded subsets/reversals/excess-face arrangements are compared
  against the independent triangular surface topology builder and its simplicial
  links.
- Capped cylinders use both annular side loops and an explicit periodic same-face
  seam, including full-circle edge direction errors and an open missing cap.
- Parallel link arcs, retraced-tip self-loops, distinct arcs sharing endpoints and
  two shells touching at one vertex exercise non-simplicial corner cases.
- Algebraic arc/line endpoints weld across independently represented/refined roots.
- Tests check inverse/cyclic coedge links, complete use coverage, reciprocal twins,
  the independent edge-use/port-degree identity, boundary cycles, shell coverage,
  input permutation/reversal and immutable snapshots.
- Bad indices/tags, point edges, open loops and endpoint-only support agreement are
  rejected; unshared duplicate geometry and unused edges remain inspectable.

The graph construction arguments and independent tests are not machine
verification of TypeScript arrays, Maps, sorting, mutation or runtime execution.
The existing scoped Lean geometry identities remain checked, but no new claim of
complete BRep formal verification is made. Semantic algebraic welding can be
expensive; there is no production-scale performance guarantee.
