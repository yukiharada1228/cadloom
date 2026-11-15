# Circular-loop product Extrude mixed Body operands

The mixed Body API now lowers actual product extrusions whose normalized
boundary loops each cover a complete circle. This includes circular disks,
annuli, material islands and disconnected circular components. Centers and
squared radii remain rational; radii and trim points may be irrational.
Negative heights, nonzero bases and fractional bounds use the actual product's
normalized world z interval.

The Body model retains its actual factory-owned `ExtrudedBRep3` behind a private
WeakMap. This is not serialized or selected by a caller-provided success flag.
The adapter reads geometry from that retained source, not dimensions from the
public reconstruction recipe. The existing planar product path remains; native
Box and cylinder paths retain their existing selection behavior.

Each ring must have positive-radius arcs on one identical rational circle.
The exact 2D regularized XOR of that ring and a full disk must be empty. Merely
seeing arc edges or a cylindrical supporting surface is not accepted as proof
of full-circle coverage. The extrusion constructor has already normalized the
material boundary and rejected pinches/multiple boundary uses. Its rings, rather
than the original user's potentially redundant winding loops, are compiled.

## Material correspondence

Let h mean zMin < z < zMax and d_i mean membership in the i-th full disk.
Across each normalized material boundary the planar membership toggles, starting
from false outside all boundaries. Thus open profile material is XOR_i(d_i).
The actual vertical product is h AND XOR_i(d_i). Each prepared finite cylinder
has open material h AND d_i, and XOR_i(h AND d_i) equals that product predicate.
A balanced XOR tree therefore represents the same open material, with holes,
islands and disconnected regions preserved. Complete finite-cylinder partition,
two-sided selection, sewing and regularized closure supply the bounded boundary;
common Body adoption still requires manifold material and checked regions.
This is a derivation, not a new Lean or whole-TypeScript execution proof.

## Validation and remaining scope

Seven new circular cases passed as five initial cases plus two targeted cases.
The same initial invocation passed all four straight-product cases, including
the updated general arc/line rejection fixture. Coverage includes independent
rational cylinder inequalities for union/intersection/difference, negative height
with a shifted base, through-hole preservation, islands/disconnected regions,
nonzero fill normalization, replayed face/material witnesses and unchanged inputs.
A perpendicular non-unit-axis real cylinder passed exact spatial SSI replay and
96 independent strict points plus boundary queries. A translated radius-sqrt(2)
product with fractional heights passed strict and exact boundary checks.

All 35 existing constructed/planar/mixed/contact Body cases passed in a separate
invocation. Build, standalone strict typing and the existing scoped 133-declaration
audit passed. General arc-line loops and loops switching between different circle
supports remain explicitly unsupported: they are not replaced with whole disks.
General curved mass/area, general analytic/NURBS Booleans and complete contact
coverage remain incomplete. The parent straight-product snapshot passed 867
non-hard cases. A complete non-hard snapshot including all seven new circular
cases is now running and remains a separate gate for this adapter.
