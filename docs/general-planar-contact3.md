# Regularized contact between concave planar operands

Status: the initial four mixed-material contact fixtures passed. Native planar
pair dispatch is now implemented; five targeted dispatch/reuse cases, build,
standalone strict typing and the existing scoped 133-declaration audit passed.

Use the closed extruded L material A with z in [0,2] and planar footprint
([0,2] × [0,1]) ∪ ([0,1] × [1,2]). Let B be A translated by (1,0,0).
Both operands are actual owned prepared sources; the native Boolean cases use
serialized/restored planar Bodies, not caller-supplied material certificates.

The expected regularized material sections are:

| Operation | Planar material section, extruded through z in [0,2] |
| --- | --- |
| Union | ([0,3] × [0,1]) ∪ ([0,2] × [1,2]) |
| Intersection | [1,2] × [0,1] |
| A minus B | [0,1] × [0,2] |
| XOR | ([0,1] × [0,2]) ∪ ([1,2] × [1,2]) ∪ ([2,3] × [0,1]) |

On x=1 above y=1 the original sources have opposed bounded faces. Their union
fills a neighborhood across that face, so (1,3/2,1) must be inside. Their closed
set intersection also contains a zero-thickness strip there; regularization
removes it, so that same point must be outside the solid intersection. The
regularized difference keeps it on the surviving material boundary. The three
native cases check these classifications, 80 independent strict rational points
each, replay equality, every bounded-face witness, material samples and unchanged
input records.

The XOR section has two material sectors touching along the vertical edge
x=2,y=1. Four face uses meet there, so the raw exact boundary must retain a
nonmanifold-edge diagnosis. The lower material layer remains queryable (80
strict points and a point on that contact edge). Common Body ownership requires
manifold material and must reject this result; the test does not repair or drop
a sector to obtain a manifold shape. This is an explicit lower-layer versus
Body contract, not a claim that all Boolean results must be manifold.

The original four mixed-material cases passed in one invocation (533,247 ms
under concurrent work). They establish the regularized geometry and lower raw
nonmanifold contract on the original path.

The common Boolean API now delegates pairs of actual owned planar sources to
`booleanPlanarBodies3`, preserving native planar construction and replay. Other
supported operand pairs retain the mixed-material path. The same union,
intersection and difference geometry fixtures passed through this dispatch,
alongside native XOR rejection/unchanged inputs and a replayed native result
subsequently intersected with a real cylinder. Those five cases passed in one
invocation (30,187 ms), with build, strict typing and the existing scoped audit.
The raw mixed-material XOR fixture was not rerun in that targeted invocation;
its implementation is unchanged. These elapsed times are observations from
different concurrent workloads, not a controlled speedup benchmark.

The direct dispatch selects an existing checked planar algorithm rather than
introducing auxiliary cylinder intersections for two planar operands. The
Body construction recipe for that pair is now `planar`; consumers should use
the checked Body interface and its actual construction variant. The reuse test
verifies the native result can still enter the real cylinder/material backend.

This is focused verification, not a proof of all contact configurations or of
TypeScript execution. The previously launched broad/resource jobs use earlier
isolated builds and retain their original scope. Broader mixed contacts and
analytic/NURBS Booleans remain incomplete.
