# Portable analytic face domains and boundary binding

`BodyFaceRecord3.domain` optionally stores a complete supported bounded analytic
face definition. Newly constructed Bodies always populate it. The data-only
record layer remains independent of geometric factories; `src/convert/face-domain3`
reconstructs the domain through those factories, and `restoreNativeBRepFaces3`
then binds it to the record's actual edge uses.

This removes a dependence on private original face-domain objects for common
Body face queries. It does not prove that all faces together form an embedded
shell or correctly nested material/void regions.

## Definitions

Supported definition families:

- `chart`: an injective rational plane frame and explicit line/circle boundary
  rings. Input ring winding must agree with `sense`; holes have opposite winding.
  Encoders reverse the canonical material-left rings for a negative face sense.
- `rectangle`: a rational plane frame and four exact algebraic coordinate bounds.
- `circular`: an arbitrary-rational-normal disk and strictly disjoint circular holes.
- `elliptic`: a rational conjugate-axis ellipse disk, including nonprincipal axes.
- `cylinder-product`: a rational cylinder, increasing rational axis-parameter
  bounds, an exact angular circle arc, and physical sense. A full band is periodic
  in the angular coordinate; its two circle boundaries are retained.
- `trimmed-planar` and `trimmed-cylinder`: a supported base, rational plane
  halfspaces and an exact strict interior witness selecting one component.

Trim reconstruction recomputes the entire region and selects the unique component
whose interior contains the stored point. It does not trust cached component
indices, loops or location callbacks. A boundary point, an outside point or a
point off the support fails selection. Ambiguous component boundary loops are
rejected. Supported trim combinations are those implemented by the existing
halfspace constructors; adding a definition tag does not implement a new solver.

Definitions are structural data first. Numeric syntax, array shape and allowed
fields are checked by `readFaceDomainRecord3`; each constructor then establishes
its own geometric conditions. Unknown kinds are not approximated. General NURBS
face domains, procedural definitions and extra analytic supports remain future
backends. The record's NURBS surface table does not imply a NURBS face importer.

## Binding an independently reconstructed domain

`restoreNativeBRepFaces3(record)` first uses the existing native boundary converter
for exact endpoint agreement, whole-edge support, welding and shell partitions.
For each face it requires a definition and reconstructs a valid bounded domain.

1. Compare its analytic support with the record's support by exact coincidence.
2. Compare physical orientation at a domain interior sample. Raw support labels
   may differ by sign or scale: the support normal multiplied by face sense must
   be cooriented. This deliberately accepts a negative plane-normal rescaling
   accompanied by the opposite record face sense.
3. Extract the complete oriented serialized loop geometry from edge uses.
4. Canonicalize and node domain and serialized boundaries at their combined
   endpoints, using the existing analytic sewing engine. Lines become exact
   endpoint segments; circular/planar arcs become ellipses; periodic ellipses are
   split at chart quadrants and every supplied endpoint.
5. Sew the domain boundary against the REVERSED serialized boundary, requiring
   closed oriented manifold incidence. In addition, every resulting edge must
   pair exactly one domain-side use with exactly one serialized-side use.

The last condition is necessary. Closed incidence alone can pair an extra
backtracking loop with itself entirely on the serialized face, incorrectly
accepting boundary garbage. Requiring a use from each side excludes such
self-pairing as well as missing, duplicated or extra boundary intervals.

Canonical segment equality uses exact endpoints. Canonical ellipse pieces also
require exact ellipse coincidence and mutual interior-witness membership; equal
endpoints alone do not identify the correct arc. Common endpoint noding handles
partial overlaps and different subdivisions. Interior/interior crossings need
not be discovered to establish equality: an unmatched piece is rejected, and a
matched piece is the same whole analytic arc/segment on both sides. This is
whole-curve comparison, not sampling an otherwise unchecked interval.

Together with the reconstructed domain's own validity, the checks establish
that the declared face support, orientation and complete spatial boundary describe
that bounded face. Shell face-use directions are a separate orientation layer:
the returned face is oriented as its definition, while native boundary topology
also applies each shell use. Raw sense numbers need not be identical on differently
oriented but coincident support labels; physical orientation is what agrees.

## Metadata and limits

A face carrying independent `parameterBounds` or explicit pcurves is currently
refused by this binding backend. Those fields need parameter-correspondence
checks; it would be incorrect to ignore them while certifying a face. Supported
domain definitions carry their own validated ranges, angular sets and boundaries.
NURBS and wire/vertex-shell conversion still require other backends.

A successful result contains native boundary incidence and decoded bounded faces.
It is not an owned material Body. Different face interiors can still intersect;
closed shells can still self-intersect or overlap; region roles can still be
geometrically wrong. Global intersection, containment and material validation
remain separate obligations.

## Common Body integration and compatibility

Common Body creation now stores these definitions and rebuilds/binds all faces.
`Body3.faces` exposes the reconstructed domains. `locateBodyFace3` uses those
reconstructed domains rather than the original constructor's private face queries.
Global material location remains protected by the supported constructive Body
provenance.

Earlier version-1 construction documents omitted face definitions. Construction
replay still validates every field they stored and regenerates the missing domains.
A provided domain is never ignored; changed definitions fail exact ordered-record
comparison. This is backward reading support; older readers are not promised to
accept the newly added optional definition fields. This compatibility rule does not make a raw domain-less record a
valid bounded face: `restoreNativeBRepFaces3` rejects it without a definition.

## Evidence

Tests cover affine charts with holes and both senses, algebraic rectangle bounds,
nonprincipal ellipses, arbitrary-normal circular annuli, full/partial cylinder
products, disconnected trim components selected by witnesses, and common Body
queries. Negative cases include missing domains/holes, shifted bounds, wrong
orientation, complementary arcs with identical endpoints, extra self-pairing
loops, unsupported independent parameter metadata and invalid geometry. Legacy
construction documents regenerate domains; supplied incorrect domains fail. A
consistent geometric edge subdivision binds to the same whole domain boundary.

These are documented mathematical arguments and exact executable checks, not new
Lean proofs or whole-TypeScript execution verification.
