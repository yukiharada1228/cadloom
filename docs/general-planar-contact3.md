# Regularized contact between concave planar operands

Status: four new execution cases are running; standalone strict typing passed.
No kernel source changes are included in this fixture milestone.

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

These are requirements for the currently running fixtures, not completed
verification results or a general proof of all contact configurations. Broader
mixed contacts and analytic/NURBS Booleans remain incomplete.
