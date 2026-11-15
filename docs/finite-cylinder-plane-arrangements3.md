# Additional plane events in finite-cylinder arrangements

`partitionCylinderFaceByFiniteCylinders3` and `partitionPlanarFaceByFiniteCylinders3` accept an optional third argument of oriented rational planes. These are full supporting plane cuts: they subdivide existing face cells and preserve signs on both sides, rather than silently selecting a halfspace.

All finite-cylinder radial and axial cuts still run first, in the original order. Existing material-location rows retain the same operand-column meaning. Additional plane side columns follow the two cap-plane columns for every finite cylinder. For wall arrangements they are in `partition.planeSides[row]`; for planar arrangements they are in `partition.cells[row].planeSides`. Their input order and orientation are retained, including coincident or reversed planes. Existing refinement constructors snapshot and validate the planes.

The wall path uses the existing complete plane refinement of native/SSI-bounded cells, retaining immediate source-cell IDs and every prior cylinder/plane sign. The planar path includes the extra planes in the same complete native planar arrangement. Therefore every new open cell lies within an old material-labelled cell. Reading the original radial/cap columns classifies the unchanged finite cylinder, while the additional columns describe the new support partitions. These are surface-domain operations, not complete clipped-solid Booleans: cut caps, material selection, closed-shell assembly and construction recipes for plane-clipped expression leaves still need integration.

The existing refined-cylinder and planar multi-cell domain codecs already persist the complete plane list and replay the selected strict witness. No new ownership or schema flag is introduced. Calls with no additional planes execute the original geometric cut sequence.

## Validation

Three new tests passed: rational-grid coverage/material truth with oblique/reversed wall planes; independent planar grid and plane-side truth; and a height strip of width `10^-40` with exact domain replay and invalid-plane rejection. Cylinder angular seams are checked as covered cell boundaries rather than mislabelled as open interiors. The first exploratory run exposed that test assumption and a mistaken planar side-table access; both were corrected before the three-test run passed. The original 14 connected regression cases passed in the initial group run. The broader suite and final scoped audit are recorded separately. No full clipped-Body support or new Lean proof is claimed.

The complete source-36 broad suite passed all 770 tests outside the unchanged two-test hard oblique file in one invocation (66616 ms). The final reviewed-source scoped audit passed all 133 existing declarations. The hard no-extra-plane fixture had passed on source 35; it was not rerun for this optional-argument addition, and no source-36 hard result is claimed. Full plane-clipped expression construction remains future integration work.
