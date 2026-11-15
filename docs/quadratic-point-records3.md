# Shared quadratic point records and verified SSI recovery

`quadratic-map` extends `ExactPointRecord3` with an exact source-root record, three numerator polynomials, a rational coefficient vector, a radicand polynomial and a denominator polynomial. It defines `(N_i(t)+c_i*sqrt(K(t)))/D(t)`. The strict reader snapshots every field and applies existing item/numeric-character budgets. Decoding constructs actual coordinates with `algebraicQuadraticPoint3`: zero denominators and negative radicands are rejected, and only constructed points obtain a private source chart. It does not give a point unchecked SSI, face or solid ownership.

The version-1 envelope and existing point variants remain accepted. Readers predating the new point tag reject it; backward reading of older documents does not imply that older readers understand new definitions. SSI curve-record fields are unchanged.

## Restoring a real root without global conjugate isolation

`AlgebraicReal.fromIsolatingInterval(P, lo, hi)` checks positive polynomial degree, strict bounds, nonroot endpoints and exactly one Sturm-counted root in the open interval. It retains the square-free certificate and supplied bounds rather than isolating unrelated conjugates. Linear roots and a uniquely represented zero are normalized to exact rationals. Invalid, absent, multiple and endpoint roots are rejected. `decodeExactReal3` uses this checked constructor after the strict record reader.

Separately decoded source roots need not have the same object identity. Shared-source comparisons now accept them only after exact real-root equality is proved; differing roots and incompatible radicands keep the complete existing comparison. This is mathematical root equality, not equality of polynomial text or an unchecked shared ID.

## Endpoint candidates do not define the curve

An SSI record still defines two supporting cylinders, a bounded base interval, a sheet and traversal direction. The decoder reconstructs the owned support graph and validates that both base endpoints lie in one forward factory interval before using any endpoint candidate.

Body geometry decoding groups its already decoded vertex points by referenced curve. For each SSI base endpoint, a candidate may recover the represented fiber only after exact projection equality, base-arc membership and membership on both cylinders. A point on the other sheet can construct the selected root by the existing verified affine reflection. A nonmatching candidate is ignored and the complete original lift remains the fallback. Whole-interval reconstruction and the later independent edge/vertex, face-domain and shell checks remain in place. Invalid hints cannot repair an invalid base interval or choose another sheet. Incorrect declared body vertices still fail geometric binding; geometry-table decoding alone does not certify a solid.

This avoids recreating a new nested radical from a base point when a certified 3D root of the same fiber was already serialized. The candidate is a computational input, not trusted curve provenance, and is not an added serialized curve flag.

## Generator identities after decoding

A constructed quadratic point has the actual line decomposition `p=(N/D)+c*(sqrt(K)/D)`. For nonzero rational `c`, internal axial queries derive that line identity from the private chart and construct its rational-univariate base. No line flag is read from a record. Segment membership and whole-cylinder support still validate the geometric line, bounds and cylinder anchor using the existing checks.

## Validation scope

A 42-test codec/root group passed before adding SSI recovery. The connected recovery/decomposition group passed 43 tests, including a reversed-support SSI whose base endpoint is explicitly a `quadratic-map`, wrong-sheet/off-support hints, immutable JSON round trips, malformed definitions, read budgets, ordered equivalence with legacy coordinates, unique-root restoration and generator recovery. Existing mixed-boundary tests retain independent vertex/edge binding checks. The hard oblique integration remains a separate required gate; completed broader checks are recorded below. No new Lean refinement theorem or full TypeScript execution proof is claimed.

The current source subsequently passed all 762 tests outside the unchanged two-test hard oblique file, the existing 133-declaration scoped Lean audit, and archived `83d6bb1` document replay with all 74 faces, three shells, unchanged region declarations and material queries. The restored-source SSI fixture explicitly exercises a `quadratic-map` base in the reversed supporting frame and the Body geometry-table path. These results do not establish completion of the still-running full oblique expression/Body integration.
