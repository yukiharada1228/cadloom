# Exact one-sided NURBS surface singularities

`analyzeNurbsSurfaceRegularity3` returns all singular parameter loci on each
closed knot rectangle, together with positional continuity of every interior
patch seam. This is a differential diagnostic for future trimmed-face
validation, not a global surface-embedding certificate.

## Differential equations

Write the homogeneous position vector N=(X,Y,Z) and positive weight W.
The partial derivatives are

```
S_u = (W N_u − N W_u)/W² = J_u/W²
S_v = (W N_v − N W_v)/W² = J_v/W².
```

Every coordinate of J_u×J_v has a polynomial factor W, since

```
J_u×J_v = W (W N_u×N_v − W_v N_u×N − W_u N×N_v).
```

Exact polynomial division removes this factor. The report's three normal
polynomials K therefore satisfy S_u×S_v=K/W³. Since W>0 over the closed patch,
K_x=K_y=K_z=0 is equivalent to rank less than two, including at patch boundaries.
No normalization, tolerance, sampled mesh or unit normal is needed. Rank loss
is a singularity of this parameterization; the spatial image might admit a
different regular chart. It is not an impossibility proof for the image.

## Complete parameter loci

Use the existing multiple-equation solver on all three K coordinates. It
returns isolated real solutions outside the common polynomial locus and a
common factor whose entire real zero set satisfies the equations. Filter the
finite solutions to the closed patch rectangle and lift their actual points
using that patch's rational functions.

Trace the shared factor on the same closed rectangle. A common polynomial
factor need not give a real curve: it can have no real zeros, a single
isolated real point, multiple branches, or the whole rectangle if all
normal equations vanish identically. Preserve this distinction. A patch is
regular exactly if its finite list is empty and its traced locus is absent
or a curve graph with no vertices. The tracing representation includes
vertices on every nonempty bounded real component, including isolated points
and positive-length closed components.

Separate patch provenance preserves one-sided values at discontinuous seams.
Critical points shared between adjacent patches are deliberately not welded
into one spatial topology. Algebraic curves are represented implicitly, not
as straight segments. The result describes the whole supporting parameter
rectangle, including portions which a future trim could remove.

## Positional seam continuity

For each pair of adjacent rectangles with the same transverse interval,
restrict X,Y,Z,W to the common rational knot. Cross-multiply homogeneous
coordinates and require the three resulting univariate polynomial identities
to vanish. This checks every point of the common boundary, not only its
endpoints. Positive weights justify the equivalence with rational position
equality. Tensor-product patches have a conforming rectangular partition, so
these are all interior seams. The full patch adjacency checks corner limits
through the incident common edges.

`continuous` reports position continuity. `everyPatchRegular` reports nonzero
one-sided differentials over every closed patch. Neither boolean asserts C1
or G1 matching across seams. A continuous fold can have two regular patches
with different normals. Even a globally regular parameterization can map
different parameters to the same point, as the full cylinder example shows.

## Evidence and remaining obligations

Tests use independent power-to-Bernstein fixtures for polynomial maps with an
irrational singular line, isolated rank loss, isolated real zeros of a shared
factor, a factor with no real zeros, and wholly singular patches. Weighted
normal polynomials are compared with the existing exact differential evaluator.
Further cases cover boundary singularities, refinement/reversal, interior seam
gaps with matching endpoints, folded seams, and a regular noninjective cylinder.

These documented arguments and tests do not constitute machine verification
of TypeScript execution. Trim restriction is supplied by `analyzeNurbsTrimRegularity3`
([construction](nurbs-trim-regularity3.md)), and retained seam matching by
`analyzeNurbsTrimSeams3` ([construction](nurbs-trim-seams3.md)). Identifying
periodic seams, proving global injectivity or an appropriate quotient embedding,
and constructing a valid spatial face remain separate tasks. Exact polynomial elimination can be expensive at high degree.
In particular, a singularity outside a desired trim is still
reported here and does not by itself invalidate that future trimmed face.
