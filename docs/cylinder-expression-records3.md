# Cylinder expression boundary records

`bodyRecordFromFiniteCylinderExpression3` accepts a factory-owned finite-cylinder expression boundary and exports its selected wall/cap faces through common BodyRecord tables. Source provenance chooses the actual owned partition and cell: wall cells use ordered cylinder-refinement records; planar cells use complete multi-cylinder planar arrangement records. Selection orientation is preserved in both the face sense and bounded-domain definition.

The existing mixed face importer recomputes each arrangement, validates strict cell witnesses and binds the whole reconstructed oriented loop to the recorded edge uses. Definition caches are local to one restore batch; each face retains its own selector and orientation checks. Empty expressions contribute no invented faces or shells.

Region records are caller declarations. This converter does not infer shell containment or material/void roles, does not adopt an owned Body3, and does not save an editable construction tree. Those require constructive expression-region certification and an expression recipe/replay path. A round-tripped boundary alone is not a solid validity certificate.
