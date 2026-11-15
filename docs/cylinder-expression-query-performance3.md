# Exact filters for cylinder expression queries and refinement

## Strict primitive membership

Every selected expression face is a subset of a finite-cylinder operand boundary. If exact primitive classifiers place a query point strictly inside or outside every operand, no selected output face can contain it. Evaluating the snapshotted Boolean tree on those strict locations therefore gives regularized membership directly. Any operand-boundary result still takes the complete bounded-face and symbolic-infinitesimal path. No tolerance or approximate bounding volume decides membership.

## Repeated SSI fiber projection

To test a known point against a cylinder height fiber, orthogonal projection to the first cylinder's base plane is the rational affine map `P(p)=(I-ddᵀ/D)p+d(d·o)/D`, with `D=d·d>0`. Compute rational interval enclosures of each projected coordinate from the point's certified coordinate intervals. A coordinate enclosure disjoint from the target coordinate interval proves that the fibers differ. Every overlap falls through to the original exact projection, equality, support and bounded-arc checks; an interval overlap grants no geometric membership.

Projection results are memoized by the actual private SSI family and immutable snapshotted point. This caches only the value of the same affine map. Mutable caller records receive fresh immutable snapshots, so changing a caller coordinate cannot reuse a stale projection. Support ownership and branch certificates are not manufactured by the cache.

Targeted regressions include more than 1,000 strict rational query points against independent radial/axial inequalities, boundary and inactive-support queries, shifted/reversed nonunit oblique projections, immutable cache reuse and mutated caller input. Existing exact-point/fiber regressions retain zero, tiny-gap, branch and forged-provenance checks. A full oblique three-operand integration regression also checks independent quadratic material truth and common Body adoption; its complete execution remains a validation gate, rather than being replaced with the smaller fixtures.

## Local isolation of a rational algebraic image

`AlgebraicReal.rationalFunction` retains its denominator guard, source-polynomial reduction, denominator-zero conjugate removal and square-free resultant. Instead of globally isolating every resultant root, it evaluates rational enclosures of the numerator and denominator over the represented source interval. Once the denominator enclosure excludes zero, the four endpoint quotients enclose the actual image.

Expand that enclosure by its width plus the positive source-interval width. The image is then strictly inside the padded interval. Nonroot endpoints and a Sturm open-root count of exactly one establish the same unique, sign-changing square-free root certificate used by `refine()`. A zero count rejects a lost-image invariant; multiple roots or root endpoints trigger source refinement. A linear image polynomial returns its exact rational root.

The actual source root survives denominator-conjugate removal because its denominator was checked nonzero. Its image is a root of the resultant. Polynomial interval enclosures converge under source refinement, division is continuous at a nonzero denominator, and the padding tends to zero. Distinct roots of the nonzero square-free resultant have positive separation, so eventually the padded interval has nonroot endpoints and exactly the represented image root. No other conjugate must be isolated first.

The generic ellipse predicate also compares `a*x²-a*b` directly with `-b*y²` instead of constructing their sum in a new field. This preserves strict signs and equality without assuming shared coordinate provenance. Regressions include near-colliding rational-image conjugates at a 10^-40 separation, denominator poles/nonminimal certificates and unregistered degree-eight ellipse coordinates on and 10^-30 away from the boundary. These are documented arguments and executable checks, not new machine-verified refinement proofs.

## Equality and linear-order filters

Boolean point equality may reject on any strictly disjoint coordinate interval before checking lexicographic equality. Overlapping boxes still require complete exact coordinate comparison; equal interval endpoints alone do not reject. Linear-form comparison returns zero for a zero form and compares only the selected coordinate for a one-coordinate form, applying the coefficient sign and normalizing zero. General linear forms retain the certified interval filter and complete fallback without an unnecessary preliminary full-point equality test. Existing lexicographic ordering is unchanged.

## Plane cuts that cannot change the wall arrangement

For a wall band `p=o+q+d*h`, with `q·d=0`, `|q|²=r²` and `lower<=h<=upper`, let `a=n·d`, `s=n·o+offset`, and `R=r²*(|n|²-a²/|d|²)`. The plane value is enclosed by `[min(s+a*lower,s+a*upper)-sqrt(R), max(s+a*lower,s+a*upper)+sqrt(R)]`. Exact positive endpoint and squared-radius comparisons certify strict separation from zero. Tangent equality does not take this shortcut. An axial-normal plane at/outside an existing height endpoint also misses every open wall cell and introduces no new boundary curve beyond the existing full cap boundary.

A physically repeated plane introduces no new geometry; its sign column is the previous column multiplied by the exact normal-alignment sign. These cases retain the actual owned cells and sewn topology, append all normalized cuts and sign columns, and preserve immediate identity provenance. Existing geometric validation is reused, not deferred. No cutter definition is dropped from persistence. A tangent-generator regression verifies that touching planes still take complete event noding. A document generated from commit `83d6bb1` was independently rebuilt with the modified code: all 74 selected faces and three shells passed the existing ordered semantic replay check.

## Constructive line provenance

Internal axial factories retain the identity `p=q+t*d` for the coordinates they actually construct. Rational-plane projection is the affine map `p -> p-d*(n·p+offset)/(n·d)`; its chart is retained only when `n·d` is nonzero. Genuine affine and biparametric factory charts also yield line decompositions by fixing one parameter. Planar mapping retains its actual fixed-x decomposition. No structural field on caller points can create these private certificates.

Two points with certified parallel rational directions lie on the same line exactly when two independent perpendicular linear forms agree on their bases. The segment constructor additionally checks both endpoints and its cylinder anchor; subsegment restriction checks both new endpoints on the original segment before retaining the line certificate. Unknown construction provenance takes the original complete algebraic path. Sewing retains these checked restrictions rather than losing the line identity at each split.

For a point privately constructed on two nonparallel cylinders, membership on a generator of the second cylinder need not construct its entire projected point. With second axis `e` and first axis `d`, use `u=e×d` and `v=e×u`. Equality of the `u` component and the sign of the `v` component determine the radial point on the known cylinder circle. The SSI branch determines the latter sign because `v=-m`, where `m=|e|²*d-(e·d)*e` is the quadratic height's vertex normal. The anchor is separately checked on that cylinder. A tangent has sign zero; axis reversal/scaling preserves the identity. Tests cover off-cylinder anchors, wrong branches, tangency, shifted/scaled axes and forged metadata.

Fiber recovery first validates the projected base, bounded arc and both supporting surfaces. If the base is an owned endpoint or sample, the selected branch's stored point is already the unique root for that sheet, so it is returned directly. This also applies when the supplied point is on the opposite sheet; a double root is shared. The new regression checks actual object reuse, invalid support rejection and arc ownership. Other fibers still take complete affine reflection.

These changes do not add a new persisted point format, arbitrary-source provenance registration or new Lean claims. The oblique three-cylinder integration gate remains required before declaring this branch fully validated.

For an already certified rational line, a coordinate whose direction coefficient is nonzero is injective along the line. Segment membership therefore checks exact line membership first and then only that coordinate's closed endpoint interval. This includes reversed and degenerate segments. It avoids comparing all three high-degree coordinates for candidates which are not even on the line; it does not relax the closed bounds. Uncertified segments retain their original full test. A dedicated regression covers negative directions, both endpoint orders, same-line exterior points, off-line points and degenerate restrictions.

## Biparametric quadratic sign enclosure

Before constructing the full compositum for `c+a*s+b*t+A*s²+B*s*t+C*t²`, exact rational interval products and signed sums enclose that polynomial over the two certified parameter intervals. Dependencies between the parameters only widen the enclosure. A strictly positive lower bound or strictly negative upper bound certifies the sign; a singleton zero enclosure certifies zero. After at most eight refinements, any unresolved enclosure takes the unchanged complete algebraic calculation. Consequently the filter cannot discard exact boundary points or mistake near cancellation for equality. Tests use independent integer evaluation over 245 parameter/coefficient combinations, `s²+t²=5` with offsets of `10^-40`, both signs of a mixed term and correlated cancellation with `s=t`.

## Reuse of validated immutable curve snapshots

Private weak ownership sets record actual deeply immutable circular/elliptic arcs built by validated constructors or their checked reversal/subdivision operations. Internal snapshots reuse only these exact objects. Curve wrappers are reusable only after the snapshot routine has rebuilt and validated their contents. An external object, a frozen structural copy, or a mutated caller wrapper is never granted ownership merely because it resembles a previously checked object. Reusing such private immutable snapshots changes neither curve geometry nor endpoint/support validation; it avoids repeating those validations for every candidate point during sewing. Regression checks cover private snapshot identity, mutable caller replacement, invalid copied endpoints and frozen forged records.

## Height without radial projection

Cylinder height is `d·(p-o)/(d·d)`. A query needing only height does not need the radial base point `p-d*height`. The height-only helper preserves the existing exact SSI inverse identity when available, and otherwise evaluates that same rational linear form. Wall-bound ordering and generator ordering use this helper; point location, which actually needs the angular projection, retains full cylinder coordinates. Regressions cover signed nonunit frames, independent algebraic coordinates, a rational oblique frame and actual SSI points. This avoids constructing unused high-degree radial coordinate images without changing any height comparison.

## Exact comparison reuse

`AlgebraicReal` comparison returns zero immediately for the same immutable instance. For two genuine constructor instances, a completed exact comparison is memoized by their identities in weak maps, including the reversed result with canonical positive zero. Neither operand, its polynomial nor its rational interval can change. Unknown structural objects do not enter the cache. Lexicographic point order remains x/y/z order; it also returns immediately for identical points. Tests retain conjugate ordering, equivalent nonminimal certificates, repeated forward/reverse comparisons, refinement equality and strict rational bounds. The numeric group passed 24 tests after this change.

The earlier broad snapshot completed 726 tests with zero failures. It predates the latest quadratic, snapshot, height and comparison changes and excludes the separately running oblique integration case. A new broad snapshot is running for the current source; the older result does not certify the current branch.


## Prefer existing SSI support identities over generic coordinate formulas

Ellipse membership already recognizes an actual SSI point on a certified cylinder section using a rational coefficient identity and exact plane membership. Apply that existing sufficient identity before the generic rational/biparametric coordinate formula. Otherwise a point can lose the benefit of its known supporting surfaces merely because it also has a two-parameter chart. A failed section identity still falls through to complete coordinate classification; no caller metadata grants membership. The new regression constructs a genuine two-parameter SSI point, checks a secondary-cylinder ellipse section, rejects a parallel shifted plane and rejects an altered coordinate point. The change passed a 35-test circle/ellipse/curve/comparison group.

## Rational-chart translation without elimination

For a certified coordinate `N(t)/W(t)`, translation by rational `v` gives `(N(t)+v*W(t))/W(t)`. The coordinate's already certified algebraic value can therefore use the existing exact affine polynomial transform, while its private rational chart retains the same source parameter and denominator with the shifted numerator. This avoids recomputing a resultant to recover a coordinate value that is already known. No arbitrary external coordinate is registered: the branch uses only the original factory rational chart. Regression checks shifted coordinate equality, degree preservation, the original source identity, polynomial predicates and inverse translation.


Owned SSI branch membership now uses its existing private family/base/branch certificate before endpoint coordinate equality. The exact same-family path already existed; moving it earlier avoids solving independent coordinate comparisons for points with a known parameter and sheet. A different or unknown family still uses the complete endpoint/support checks. It does not accept public flags or change the bounded angular/branch condition.


## Reuse of exact open-arc witnesses

An owned immutable circular arc's open-arc witness is computed once by the existing exact dyadic-slope construction and retained in a private weak map. The first computation retains all quadrant overlap and strict interior checks. Structural caller arcs are snapshotted and validated afresh; mutation cannot reuse another arc's witness. Full-circle seam behavior and point-arc rejection remain unchanged. A regression checks repeat identity, reverse traversal, changed caller endpoints, complementary arcs and degenerate rejection. The still-running preceding integration snapshot does not contain this additional cache.

## Current validation and incomplete integration gate

- Current source compiled successfully into an isolated output directory.
- All 739 tests outside `oblique-cylinder-expression3.test.ts` passed against that compiled source. Test imports and the existing root-fixture URL were redirected to isolated paths; test assertions were unchanged.
- `node formal/scripts/verify.mjs --partial` passed the existing 133-declaration Lean audit. This is scoped verification, not a proof of the new TypeScript optimizations or full-program execution.
- A historical document from `83d6bb1` restored with 74 faces and three shells and passed ordered semantic replay on the current corrected numerical source.
- The unchanged two-test oblique integration file remains a required gate. Two unchanged integration runs are active: the earlier baseline and the current corrected numerical source. Neither has passed or been replaced with easier geometry. Common Body adoption and its material grid remain unverified for this hard case.

This change remains work in progress. Broad passing tests do not certify the unfinished oblique case, arbitrary NURBS Booleans, general curved import or the complete SolidCraft reimplementation.

## Local isolation of sums and products

Generic algebraic addition/multiplication retain their square-free elimination polynomial and exact rational special cases. The actual sum or product is enclosed using the two operands' certified intervals. Pad that enclosure by its width plus both operand-interval widths, giving a strictly interior represented root. Nonroot endpoints and exactly one Sturm-counted root certify the returned algebraic value; a zero count rejects an invariant violation. Other conjugates are not globally isolated.

Sum and product are continuous even for dependent operands. Refining the wider operand interval forces both widths to zero unless an exact rational shortcut applies. The padded image enclosure therefore converges to the actual value. Distinct roots of the nonzero square-free elimination polynomial have positive separation, so the local isolator eventually certifies exactly the represented root. This is the same root-certificate contract as the rational-function local isolator. Regression cases include dependent cancellation to a rational value, 10^-40 translated conjugates, all signs of independent quadratic fields and explicit unique-root/sign-change certificates. The preceding long-running integration process remains intact while this numerical change is tested separately.

The subsequent local sum/product isolation change passed 41 numeric/system/ellipse tests and the existing 133-declaration scoped Lean audit. It also restored the archived `83d6bb1` document with all 74 faces, three shells, unchanged region declarations and exact material queries, passing the internal ordered semantic replay. Its first broad/integration runs were later terminated after the canonical-zero representation regression below was diagnosed; they are not counted as passing. The original integration process was retained.

## Reuse of immutable root refinements

A genuine immutable algebraic certificate's deterministic next dyadic refinement is retained in a private weak map. The same polynomial and interval yield the same midpoint sign and next interval; reuse changes no root selection or stopping condition. Rational certificates remain fixed points. Structural receivers are not recorded, so caller mutation cannot reuse stale refinement. The retained chain exists only while its source certificates remain reachable. Regression checks exact root counts, nested intervals, original-certificate immutability, rational/hidden-zero results and a mutated structural receiver.

A broad-suite performance regression exposed a necessary representation detail: a local isolator may certify a root equal to zero while retaining a nonminimal interval certificate. On an arbitrary-axis cylinder section the exact height was zero but its degree-seven certificate had no rational-point representation, causing unnecessary general coordinate elimination. After certifying exactly one root in the padded interval, a zero constant coefficient with zero strictly inside proves that the represented value is zero. Return canonical rational zero in that case. This is exact recognition, not a tolerance. A dedicated regression requires canonical zero for dependent affine cancellation and subsequent coordinate arithmetic; the unchanged arbitrary-axis trimmed-cylinder regression is also retained.

After canonical-zero recognition and immutable refinement reuse, 55 targeted numeric/system/ellipse/trimmed-cylinder tests passed, including the previously slow arbitrary-axis cylinder case. The corrected source subsequently passed all 739 broad tests, the existing 133-declaration scoped Lean audit and archived-document replay with 74 faces and three shells. The oblique integration runs remain in progress; no integration success is claimed.

### Sewing-local exact witnesses

Profiling the unchanged oblique expression during 113-cell wall refinement reached mixed-boundary sewing and repeated elliptic-arc witness construction inside edge equality. The sewing call now retains each computed exact witness by prepared/split curve identity. Those curves are factory snapshots; the map is local to one synchronous sewing operation, and no mutable caller support or arbitrary point gains ownership. Equality still requires endpoint correspondence, whole-support compatibility and both directed witness-membership tests. The first matching edge's already computed direction is retained rather than executing the identical equality test a second time. Edge search order, edge representatives and source-use provenance remain unchanged. No geometric checks are omitted and no tolerance is introduced.

This is deterministic-result reuse, not a new geometric theorem or a full-program verification claim. The source-33 hard integration is kept running independently; this later change is not claimed to have passed that integration until separately verified.

The source-34 sewing change passed its connected 29-test sewing, mixed BRep, wall-refinement and boundary-binding group and the existing 133-declaration scoped Lean audit. The broader 764-test suite is still running. Separately, the unchanged hard fixture on source 33 passed boundary/manifold checks and independent rational material queries, entering common Body reconstruction at 412746 ms; it has not finished Body adoption. Neither the sewing change nor this partial hard-run result is a complete integration pass.

The source-34 broad suite subsequently terminated successfully: all 764 tests outside the unchanged two-test hard oblique file passed in one invocation (168857 ms). The fixture directory was included from the start. This complements the 29-test connected group and scoped audit; it still does not substitute for the separate hard Body integration.
