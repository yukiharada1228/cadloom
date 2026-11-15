# Archived concave planar material Body

- Generator source: `af34fb32fa3963230a5dd5a71151496cc1d3c84b`.
- Data SHA-256: `ee1a2ff6945a62190d9d8ea0d9db35a3527ef1acd9f9aa7c65aa686f020a6903`.
- Size: 680,720 bytes; 275 faces; 21 canonical program planes.
- Recipe kind: `cylinder-material-expression`, version-1 Body document.

This is the actual `serializeBody3(body)` output from the preceding runtime, captured after exact boundary construction and common Body adoption succeeded. It was read from that runtime's original module binding via its own random-port inspector, followed by debugger resume. The capture did not manufacture or rewrite any record field. At capture time that runtime's own complete restoration was still running; historical restoration success is not claimed.

The input is the exact polygon `(0,0),(2,0),(2,1),(1,1),(1,2),(0,2)` extruded from z=0 to z=2. Its exact extrusion triangles prepare a planar solid, `compilePlanarMaterial3` produces a 28-tetrahedron/21-carrier bounded parity program, and `boundaryCylinderMaterialExpression3` constructs its complete material boundary. The generator checked manifold incidence, original physical supporting planes and strict face samples against the independent prepared planar source before Body adoption.

The archived bytes are immutable test input. Do not regenerate them using the current compiler to make a compatibility test pass. The hash establishes artifact identity only; correctness requires the full geometry/material reader and independent rational L-shape and bounded-face assertions in the accompanying test. A cold-process restoration using runtime `c95d946` passed in 802,826 ms, including all 275 face samples, shell/material checks, 64 independent strict L-shape points and nine seam/bounded-boundary cases. Retaining the original Body while restoring a new copy exhausted the default heap in the generator and `c95d946` runtimes; cold restoration success does not establish that retained-Body resource gate. The follow-up runtime resource experiment and broad regression remain separate validation gates.
