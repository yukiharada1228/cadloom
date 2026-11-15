# Native / cylinder-SSI mixed B-rep edges

This layer connects owned algebraic cylinder intersection arcs to the existing generic B-rep incidence engine. It is an independent pure TypeScript implementation; it does not certify general curved solids or claim SolidCore API parity.

## Whole-edge support

`cylinderIntersectionArcOnSurface3` checks the complete arc, not a finite collection of points. Plane support uses the existing complete plane-intersection/overlap algorithm. Coincident source cylinder supports are recognized geometrically, including shifted origins and rescaled axes.

For another cylinder write the lifted point as `p = O + U*x + V*y + d*h`. On the base circle, `y² = R(x)`. The source and target cylinder equations have the form `a*h² + 2*b(x,y)*h + c(x,y) = 0`. Eliminating the quadratic height term gives `L*h + M = 0`, where `L = 2*(a_source*b_target - a_target*b_source)` and `M = a_source*c_target - a_target*c_source`.

Polynomial remainders modulo `y²-R(x)` decide identities on the nondegenerate base circle. If L vanishes identically, membership is exactly the identity M=0. Otherwise substitute h=-M/L into the source equation: `H = a_source*M² - 2*b_source*M*L + c_source*L²`. A nonzero remainder rejects containment. An identity proves one height sheet satisfies the target. Only then is an interior witness away from L=0 used to select the owned sheet. The source arc has positive discriminant in its interior; the two height sheets cannot exchange there. L is affine and has at most two base-circle zeros, so strict subdivision finds a witness away from them.

The tests include a different cylinder with radius squared 37/46 passing through both endpoints and the stored sample of an SSI arc while missing another interior point. Whole-support checking rejects it.

## Sewing and provenance

`BRepCurve3` distinguishes native bounded curves and owned SSI arcs; a direction wrapper reverses traversal without changing the owned branch. `buildMixedBRepTopology3` reuses the generic incidence engine and whole-edge support checks.

`sewMixedBRepFaces3` canonicalizes native curves, partitions native ellipses into chart pieces, and nodes every supplied endpoint on every containing curve. It retains ordered source-curve-to-edge uses. Matching pieces require equal or reversed endpoints, whole common support, and mutual interior membership. Source SSI critical endpoints already partition branches; native chart pieces and regular SSI pieces are injective. After endpoint noding, the common regular path cannot change branch without an intervening source critical endpoint. Endpoint equality alone is insufficient: the four distinct paths between the same singular vertices of equal perpendicular cylinders remain separate edges.

Tests also exchange the source cylinder parameterizations, split arcs asymmetrically, and sew native ellipse uses to SSI representations. A true quartic intersection boundary of unequal perpendicular cylinders has three faces (one annulus and two disks), four shared edges and four vertices. Its Euler characteristic accounts for the annular face: V-E+sum(2-numberOfFaceLoops)=2.

## Explicit limits

`closedOrientedIncidence` and `requireClosed` concern combinatorial incidence. They do not prove bounded face domains, geometric face orientation, global embedding, absence of self-intersection, or material validity. Sewing does not discover missing interior/interior intersections. All required intersection events must already be supplied. These mixed curves are not yet accepted by native Body record codecs. Pcurve/domain correspondence, persistence, general curved face splitting and curved solid Booleans remain required work.

These arguments and executable regression tests are not new Lean theorems or whole-program TypeScript verification.
