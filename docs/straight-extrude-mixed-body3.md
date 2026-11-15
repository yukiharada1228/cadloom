# Straight-profile product Extrude mixed Body operands

`booleanMixedBodies3` now accepts actual owned/restored product Extrude Bodies
whose supports are all planar and whose boundaries convert to rational straight
polygons. This is the native `extrudeBody3` product backend, not only a manually
created planar Body made from an extrusion mesh.

Selection uses actual Body ownership, construction provenance and support
objects. The existing exact converter then checks straight edges, rational
vertices, planar domains, embedding and material shell orientation. Supporting
planes alone are not treated as a complete geometry certificate. Conversion
uses exact decomposition of nonconvex cap faces and holes without tessellation
error or a caller-provided success flag.

Two accepted native planar/straight-Extrude operands use the existing planar
Boolean kernel and preserve a replayable native planar result. Other supported
pairs use the material boundary compiler and preserve their complete local
formulas in the mixed recipe. Existing Box/cylinder/material routes remain.
Curved-profile product Extrude still fails explicitly; no equivalent finite
cylinder representation is inferred from an arbitrary curved extrusion.

Four distinct new cases passed as three initial cases plus one targeted reverse
operation. They cover restored concave Extrude pairs (union/intersection/
difference, regularized opposed-plane seams, replay, immutable inputs and exact
union volume), a through-hole Extrude intersected with a real cylinder,
explicit curved-profile rejection, and reversed cylinder-minus-Extrude replay.
The reversed result is the square tunnel [1,3]² × [0,2]: exact volume 8, centroid
(2,2,1) and central unit-density inertia diag(16/3,16/3,16/3) all agree.
An irrelevant outer cylinder-wall point remains outside that planar result.

Build, standalone strict typing and the existing scoped 133-declaration audit
passed. The 13 existing related mixed-Body/contact regression cases are still
running. The parent moment snapshot passed all 863 non-hard tests; that predates
this later dispatch change. This is focused coverage, not full curved-product
lowering, complete contact coverage or TypeScript execution verification.
