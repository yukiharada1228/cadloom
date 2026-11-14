# Exact matching on retained NURBS patch seams

`analyzeNurbsTrimSeams3(surface, domain)` partitions each interior knot seam
against a revalidated trim domain and reports position, C1 and cooriented
nondegenerate tangent-plane matching. It examines all adjacent closed patch
sides at retained points, including boundary-only contacts. These are seam
conditions, not rank regularity of patch interiors or a face embedding proof.

## Complete seam partition

Reuse the same conforming rectangular adjacency as the supporting-surface
analyzer. On a u seam the coordinate varying along the seam is v; on a v seam
it is u. Its endpoints are the adjacent patches' common transverse bounds.

For each trim curve span, solve U-kW=0 or V-kW=0 at the seam's fixed knot k.
Isolate every real root in the closed span, evaluate its transverse coordinate,
and keep it inside the seam interval. Tangencies count as events even when
neither neighboring interval is retained. If the equation vanishes identically,
the span lies along the seam; retain both endpoint images. Validated boundary
spans are simple, so a seam-coincident span covers the interval between its
endpoint images without retracing. These events completely partition changes
of domain location, including partial boundary overlaps and hole boundaries.

Also add all real roots of every polynomial used by the matching predicates.
On each complementary open interval, both domain location and all matching
predicates are constant. One rational interior evaluation classifies that
entire interval. Evaluate every cut point separately; matching at an isolated
point must not be confused with matching on an interval. Exclude hole interiors
and all exterior intervals, but retain outer and hole boundary contacts.

## Position and C1

Restrict homogeneous positions (N_A,W_A) and (N_B,W_B) to the same knot seam.
Position matching requires the three polynomial differences

```
N_A W_B − N_B W_A = 0.
```

For each parameter direction q=u,v write J_q=W N_q-N W_q. The true partial
is J_q/W², so C1 additionally requires all six restricted differences

```
J_q,A W_B² − J_q,B W_A² = 0.
```

These use the original shared parameter coordinates. A change in parameter
speed can preserve geometry while deliberately failing C1. Positive weights
make clearing denominators valid throughout the closed seam. Common factors
or different positive homogeneous scales do not change the predicates.

## Cooriented tangent planes

Let H_A=J_u,A×J_v,A and H_B=J_u,B×J_v,B. Their true normal denominators W_A^4
and W_B^4 are positive. The reported G1 predicate requires position matching,

```
H_A×H_B = 0,    H_A·H_B > 0.
```

The strict dot condition excludes either zero normal as well as opposite
orientations. Roots of the cross-product coordinates and the dot product are
part of the event partition, so sign reversals and isolated degeneracies are
not sampled away. C1 may hold for degenerate derivatives while G1 fails.

At isolated trim contacts these fields describe equality of the two one-sided
jets/tangent planes at that point. They are not an assertion of smoothness on
an open neighborhood outside the domain. Across a retained interval of regular
patches, positional identity also identifies the shared tangent direction.

## Scope and evidence

Boundary geometry is revalidated, ignoring forged location methods and cached
metadata. The exact boundary lift verifies the entire domain boundary lies in
the active surface rectangle. Empty retained seams pass the aggregate seam
conditions vacuously: these flags do not test patch interiors. Use the separate
trim regularity analyzer for rank loss. No global injectivity, periodic seam
quotient, self-intersection exclusion, spatial face or solid certification is
provided by this analyzer.

Tests cover smooth and speed-changing seams, folds and opposite orientations,
zero normals, an isolated double-root agreement, isolated trim contact, holes,
boundary overlap, irrational cuts, both seam directions, rational weights with
different homogeneous scales, and a tangent-plane orientation change through a
zero normal. They also check forged metadata and domain excursions. These are
exact construction checks with documented arguments, not machine verification
of TypeScript execution.
