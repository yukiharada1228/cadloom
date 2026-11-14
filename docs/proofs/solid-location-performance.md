# Cached exact solid point location

The public solid and Boolean APIs are unchanged. Their internal locator groups
coincident supporting planes, caches oriented edge halfplanes, and rejects
triangle membership outside exact closed axis-aligned bounds. It continues to
use rational generic rays, with the existing finite 8F+1 retry bound.

## Equivalence of the cached calculations

1. Divide every plane coefficient by the first nonzero normal component c. This
   identifies the same plane, including when original face windings are opposite.
   A ray's plane value v and slope s are both divided by c. For s!=0 and c!=0,
   `-(v/c)/(s/c) = -v/s`. The Lean theorem `Cadloom.ray_parameter_rescale` proves this
   identity over mathematical rationals. Parallelism and zero plane membership are
   unchanged as well. The set of rejected parallel ray directions is identical.
2. With edge vector e=b-a and original triangle normal n,
   `(e × (p-a))·n = (n × e)·p - (n × e)·a`. The Lean theorem
   `Cadloom.cached_edge_halfplane` proves this polynomial identity. Thus a cached
   coefficient vector n×e and offset -(n×e)·a give exactly the original edge sign.
   The original face normal is used here, even when grouping reversed faces under
   one canonical plane, so closed triangle membership retains the original signs.
3. A point of a closed triangle is a convex combination of its vertices. Each
   coordinate therefore lies between the coordinate minimum and maximum. Rejecting
   only strict violations of those bounds cannot discard a triangle point. Equality
   is retained, including zero-thickness axis ranges, edges and vertices.
4. Compute a ray intersection once per supporting plane. Test that intersection
   against every face in the plane using the cached edge equations and bounds. An
   edge/vertex hit still rejects the direction; every proper interior hit is counted.
   The same admissible ray family and crossing parity are preserved. Grouping may
   change traversal order, but not whether a direction is rejected or its count.

These lemmas verify the changed arithmetic, not the complete TypeScript cache,
Map operations or point-location program. Existing geometric separation assumptions
and source/runtime limitations remain as documented in [solid3.md](solid3.md).

## Independent regressions

All previous box/tetrahedron membership, cavity, contact-complex and Boolean tests
remain active. New tests compare nonconvex L-prism operations against independent
union-of-boxes membership and interval volumes; overlapping/separated faces at
rational distance 10^-80; and orientation-reversing affine maps with corrected
face winding. They exercise canonical plane signs, inward/outward faces, bounding
limits and enormous rational denominators without a floating-point tolerance.

## Reproducible measurement

Run after building:

```sh
node benchmarks/solid-location.ts
```

The benchmark validates a subdivided cube (256 triangles), then queries all 1,331
points on a rational grid. The timed query loop includes independent box-oracle
checking; construction/validation is outside the timed interval. Expected counts
are 343 inside, 386 boundary and 602 outside. Timing uses floating point only for
wall-clock measurement; all geometry and the oracle use Rational/BigInt values.

A single local before/after run with Node v26.12.0 measured 1513.21 ms and 49.24 ms respectively for
the same loop and counts (about 31x for this particular coplanar-heavy fixture).
This is not an industrial model benchmark or a general speedup guarantee. Results
vary by machine, JIT state and model. Cached preparation takes extra work and memory;
models with few shared supporting planes benefit less. Worst-case ray retries and
face membership checks remain quadratic in F, excluding rational bit complexity.
The surrounding Boolean arrangement and sewing stages still need scalability work.
