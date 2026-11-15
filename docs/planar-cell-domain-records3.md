# Persistent planar cylinder-cut cells and complete Boolean face tables

`planar-partition-cell` extends the common face-domain schema with a native planar base, supporting cutter cylinder, ordered refining planes, exact strict interior witness and orientation multiplier. `encodePlanarCellDomain3` requires an owned planar-cylinder partition and valid actual cell. No serialized cell number is trusted.

The mixed decoder rebuilds the validated planar base and complete conic/line arrangement, then requires exactly one open cell to contain the witness. Returned native boundaries are wrapped in the common mixed edge interface. Physical orientation reversal reverses the boundary as well; closed-domain point membership is unchanged. The existing mixed face binder checks whole oriented boundaries against common edge uses.

`bodyRecordFromFiniteCylinderBoolean3` now exports all selected wall and cap cells of an owned finite-cylinder Boolean with their domain definitions in the existing BodyRecord tables. It follows each selected face's immediate operand/primitive face/cell/orientation provenance. Shell-region declarations must still be supplied by the caller; their truth is not inferred. Empty results retain empty boundaries. Nonmanifold balanced contacts remain explicit topology issues and are not promoted to valid manifold solids.

This completes persistence of individual bounded face domains for these two-primitive cylinder Booleans, including reversed cut faces. It does not establish global shell embedding, cavity nesting, material-region certification, owned Body3 adoption or use previous curved Boolean results as new operands. Reconstruction currently replays partitions per face and may be expensive. Native-only face decoding rejects the added planar domain tag.

Tests cover an oblique conic/plane partition, exact whole-boundary agreement and reversed orientation, invalid ownership/indices/witnesses, common JSON face-domain reconstruction for all four cylinder Boolean operations and the empty case. Runtime checks are not a new machine-checked refinement proof.
