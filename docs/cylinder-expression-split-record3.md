# Persistent face domains for plane-cut expression boundaries

`bodyRecordFromCylinderExpressionSplit3(split, side, regions)` exports one child of an actual owned expression split as a common `BodyRecord3`. It rejects copied split claims and invalid side values. Regions remain explicit caller declarations; this exporter does not infer nesting, void containment or solid validity.

The topology exporter preserves the child's exact curves, vertices, edges, loops, face senses and shell connectivity. Every face also receives the full bounded domain definition needed for independent geometric restoration:

- A wall face encodes the retained refined cylinder partition, selected new cell and its original expression orientation.
- A primitive cap encodes the new planar multi-cylinder/plane partition and its original expression orientation.
- A new cut cap encodes the common section partition and selected section cell. Negative/positive children use opposite domain orientations.

This uses the existing strict refined-cylinder and planar multi-cell schemas; no new record tag or unchecked ownership field is needed. The final record goes through `readBodyRecord3`, and external restoration still performs geometry decoding, actual endpoint/vertex correspondence, whole-curve support, shell connectivity, domain support/coorientation and complete boundary-set binding. No validation cache is granted by serialized provenance.

## Validation

The connected twelve-test group passed, including three new codec cases. Both oblique cavity children round trip through JSON with reversed inner walls and opposite section caps. Perpendicular-cylinder SSI child records retain mixed algebraic edges. Every restored face accepts its original strict domain sample and has its original physical sense. Altered section-domain orientation and changed vertex coordinates are rejected. Empty and balanced nonmanifold children retain their incidence; nonmanifold boundaries do not gain solid certification. Copied split ownership and invalid side arguments reject.

Regions used by these boundary-codec tests are syntactically valid explicit declarations, not computed material regions. Common Body construction, derived region roles/strict material witnesses, replay-checked clipped recipes, repeated operations and full contact classification remain further integration work. The existing scoped Lean declarations do not prove this runtime codec.

The full source-39 suite passed all 782 tests outside the unchanged two-test hard oblique no-cut fixture in one invocation (87910 ms). The existing scoped audit passed 133 declarations after adding the codec source to its reviewed inventory. The old no-cut hard fixture was not rerun for this independent exporter; no source-39 hard result is claimed.
