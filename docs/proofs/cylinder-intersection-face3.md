# Bounded cylinder-face SSI restriction

`clipCylinderIntersectionToFaces3` intersects an owned bounded cylinder SSI graph (possibly already a subset) with two finite cylinder bands/angular patches. It reconstructs both face domains from their exact geometric data and checks that their supports match the graph's supporting pair, in either order. Shifted axis origins and reversed/nonunit axis directions are accepted when geometrically equivalent. An empty graph still retains its owned supporting identity.

## Complete event partition

Each face is the closed product of a circular angular arc and a strictly increasing rational axial interval. First restrict the graph by both faces' four rational height halfspaces, using the existing complete plane-section algorithm.

For each nonperiodic angular domain, membership can change only on either of its boundary generators `p=q+d*t`. The angular endpoints q may have arbitrary real algebraic coordinates. Substitution into the other cylinder gives `a*t²+2*b*t+c=0`, where `a=|e×d|²` is strictly positive for a bounded nonparallel SSI graph, `b=(e×(q-o))·(e×d)`, and `c=|e×(q-o)|²-r²|e|²`. Exact algebraic discriminant signs distinguish zero, one and two real intersections. The algorithm does not replace an algebraic generator with an approximate rational plane.

Every relevant generator intersection splits each containing owned arc. With all height and angular boundary events removed from its open interior, a remaining regular branch has constant membership in both closed product domains. Its strict interior witness therefore selects the complete piece. Angular boundary generators cannot contain an open SSI branch because their quadratic leading coefficient is positive. Height-plane overlaps are retained by the previous clipping stage.

All boundary events and existing isolated points are tested separately. Accepted points not used as retained arc endpoints remain isolated contacts. In addition to domain membership, a contact must belong to the input subset; computing candidates on the full supporting pair must not reintroduce previously clipped geometry. Graph reconstruction preserves source supporting-normal singularities and branch ownership. It does not choose arbitrary pairings at singular nodes.

## Coordinate correspondence

The internal `cylinderCoordinates3` uses `height = d·(p-o)/|d|²` and `base = p-d*height`. These are the axis parameter and reference-circle projection, not a unit-distance or angle approximation. The projection preserves registered one-parameter, biparametric and rational-function coordinate representations. Existing cylinder-face membership and normal evaluation use this common correspondence. This is a circle-times-height coordinate model, not an unwrapped planar pcurve atlas or a bounded SSI-trimmed-face certificate.

## Validation and limits

An independent nonorthogonal-axis fixture uses the analytic locus `z=x±sqrt(2)*x`. Independent rational samples of the unit perpendicular-cylinder locus `(x,y,z)` with `x²+y²=1` and `z=±x` check exact membership against explicit height and angular inequalities. Fixtures cover algebraic endpoints, major arcs and seams, both face orders, callback substitution, translated/tilted rigid frames, shifted/reversed axes, previously clipped and empty subsets, isolated generator contacts, zero discriminants and no-real-generator intersections.

The API requires an owned bounded nonparallel cylinder supporting graph. Parallel common generators and coincident-support face overlaps are separate intersection families. This layer restricts a curve set; it does not build or split bounded faces, produce oriented pcurves, sew solid material, certify general embeddings or persist SSI curves in common Body records. General curved Booleans remain incomplete. Validation consists of documented mathematical reductions and executable tests, not additional Lean proofs or complete TypeScript execution verification.
