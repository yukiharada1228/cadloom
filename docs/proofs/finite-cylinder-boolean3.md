# Constructive Booleans of two finite cylinders

`prepareFiniteCylinder3` constructs an owned filled cylinder from a positive-radius rational axis and a strictly increasing exact rational parameter interval. Its outward wall and two oriented disk caps form an embedded closed boundary by construction. Axis rescaling, reversal and origin shifts are interpreted through parameter bounds; no unit normalization or floating-point tolerance is used.

`booleanFiniteCylinders3` partitions all three faces of each operand against the other filled finite cylinder. Wall domains use the SSI/native strip partition plus both cap planes. Planar caps use the complete native conic/segment arrangement with the other cap planes. These previous constructions supply embedded source face cells with strict open-cell material locations and complete intersection events. Artificial face subdivisions remain.

## Selection and orientation

For a noncoincident open face cell:

| Operation | First operand | Second operand |
|---|---|---|
| union | outside, original orientation | outside, original orientation |
| intersection | inside, original orientation | inside, original orientation |
| difference | outside, original orientation | inside, reversed orientation |
| xor | outside original / inside reversed | outside original / inside reversed |

For a coincident two-dimensional boundary patch, compare physical outward sides. Coincident cylinder walls of filled primitives have the same outward radial side, regardless of axis parameter direction. A cap patch identifies the other active cap plane from its zero plane sign, then compares its physical normal with that cap's outward axis normal.

Same-oriented common patches contribute one first-operand copy to union/intersection and none to difference/xor. Opposed cap patches are removed for union/intersection/xor; difference keeps only the first-operand copy. The opposed union/xor patch separates two filled sides and is an internal interface. The opposed intersection has no three-dimensional material there. The difference retains its minuend's exposed contact boundary. These rules concern open patches; lower-dimensional endpoints are retained through the closures of selected face domains.

Every selected face stores its primitive operand/face ID, immediate partition cell ID and orientation factor. The public immutable operand partitions resolve this correspondence to the exact domain object. Reversal changes the complete loop order, every edge traversal and the physical sense together. It does not modify the domain point set.

## Boundary assembly and certification scope

Mixed sewing nodes all supplied endpoints and merges whole-support-certified native/SSI edge pieces, including swapped SSI parameterizations and native ellipse/SSI equivalents. The source partitions already supply the required surface intersection events. Every resulting edge must have at least two uses and zero signed use balance; an unbalanced edge is an error. Manifold outputs additionally satisfy closed oriented incidence. Contact results may have balanced four-use edges or disconnected vertex links; these are retained, with `manifold=false` and explicit topology diagnostics.

The geometric argument is constructive: each candidate domain is embedded in an input primitive face, its interior material location is constant, and complete pairwise face intersections form its boundary events. The selection table chooses exactly the patches separating true and false regularized Boolean material. No additional arbitrary face intersections are inferred merely from a closed topology table. Cavity faces are reversed, while disconnected components and contact closures remain explicit.

Internal snapshots preserve the identity of factory-created deeply immutable coordinate records, so construction-specific weak registries survive subdivision. External coordinate objects are still copied and stripped of extra properties; public cached fields never confer construction ownership. Rational translations preserve registered rational-function and biparametric fields through their exact affine maps without transferring a point to a different supporting family.

Factory SSI points also retain their exact base-circle point and axial height. For a parallel target axis `d_target=k*d_source` with plane shift `s=dot(o_target-o_source,d_source)/|d_source|²`, the inverse coordinates are `base_target=base_source+s*d_source` and `height_target=(height_source-s)/k`. This is an exact coordinate identity, not a claim that the target cylinder contains the point. It avoids recomputing large canceled coordinate expressions during subdivision.

Linear side predicates use registered source polynomials or exact comparison of two algebraic terms instead of constructing their sum field. Three-term generic signs first try certified rational interval separation; unresolved cases fall back to complete algebraic comparison, including exact zero. A generated SSI point can reuse its certified supporting cylinder for another branch membership test, but the target angular range and selected height-branch sign are still checked.

For a factory SSI point, native ellipse membership can also reuse a known cylinder equation after checking the ellipse plane and the complete rational identity of that cylinder restricted to the ellipse chart. The restriction must be a positive scalar multiple of the ellipse equation; merely sharing a plane or a finite set of points is insufficient. Biparametric ellipse predicates expand the full quadratic in both recorded parameters. Circle/ellipse open-arc witnesses use linear side predicates directly. Segment noding first tries certified rational interval cross products, retaining full exact collinearity as fallback.

For a cross-parameterized SSI point, angular membership checks the certified cylinder supports and height-branch sign before testing the normal projection's angular range with exact linear comparisons. If a radial projection must be constructed, a rational common-normal basis gives one coordinate from the original base point; the circle equation supplies the other magnitude and an exact linear predicate selects its sign. Equal-coordinate endpoint deduplication prefers actual immutable SSI support or correlated-field provenance. This changes representations, not geometric values.

The output is an owned boundary/material result for this two-primitive family. It is not a certificate for arbitrary imported BRep data. It does not yet persist through common Body records, accept previous Boolean results as further curved operands, consolidate maximal faces, assign persistent region IDs or compute exact mass properties.

## Exact point location

Primitive location evaluates its radial quadratic and two axial linear inequalities. For a Boolean, any point in a selected closed face domain is boundary. With no selected faces, the regularized result is empty and every query is outside.

Away from selected boundary domains, intersection uses strict membership in both primitives; difference uses strict first-inside / second-outside. These exclude isolated contacts that do not bound retained volume. Union uses closed membership in either primitive: a discarded opposed cap interface becomes interior, while exposed contact points are still captured by selected face closures. Xor uses strict exclusive material membership, plus a discarded opposed coincident cap interface that is interior to the regularized joined material. A same-oriented coincident patch does not add xor material. At the rim of an exposed interface, selected neighboring face closures still identify boundary points.

This locator relies on the complete constructive selected face domains, not on arbitrary supplied callbacks or a mesh. It accepts exact algebraic queries as well as rational points.

## Validation

Independent primitive radial/axial inequalities, Boolean truth on strict grid points, selected-domain boundary witnesses and targeted canceled-interface queries check material behavior. Topology tests check signed edge balance, full edge support, loop continuity, source cell identity, ordered edge-use provenance, physical reversal, closed incidence when manifold and reported contact singularities otherwise. Fixtures include same/reversed parameterizations, identical operands, opposed joined caps, internal cavities, disjoint and tangent cylinders, genuine unequal-radius quartic SSI, nonorthogonal nonunit axes, algebraic boundary points and axial overlaps/gaps below Number precision.

These are documented mathematical reductions and executable tests, not new Lean theorems or machine verification of the TypeScript runtime. The existing selected arithmetic/geometry Lean audit remains separate.
