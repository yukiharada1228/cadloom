# Mixed box/cylinder Body operations

`booleanMixedBodies3(first,second,operation)` accepts actual factory-owned native Box Bodies and existing cylinder-family Bodies, including restored and previously clipped/material-expression results. Each native box is lowered to the exact six-plane bounded material bridge. Cylinder operands retain all operand-local constraints. Results use the existing `cylinder-material-expression` recipe, full oriented face-domain persistence and derived manifold region adoption.

The entry point checks Body ownership and operation before constructing material. A copied object cannot supply a trusted box recipe. Native Box parameters come from the immutable construction attached to its actual owned Body; no public record alone bypasses reconstruction. Ordinary document restoration still reconstructs and checks the native box before it can enter this path.

The existing cylinder-specific entry point keeps its cylinder-family contract and directs native box callers to the mixed entry point. General extrusions, arbitrary polyhedra, transformed boxes and NURBS Bodies are not yet accepted. Common Body adoption still rejects balanced nonmanifold material, including overlapping XOR; the lower-level material backend retains it. No mesh approximation or tolerance snapping is used.

Validation covers all four operations on disjoint native/restored Box and cylinder operands, empty/disconnected results, overlapping union/intersection/difference, planar and curved membership, full record replay, subsequent cutting and reuse with another native Box, input immutability, copied ownership, invalid operations and nonmanifold XOR rejection.

```ts
const block = createBoxBody3(point3(0n, -2n, -2n), 2n, 4n, 4n);
const tool = createCylinderBody3(
  cylinder3(line3(point3(0n, 0n), point3(0n, 0n, 1n)), 1n), -1n, 1n,
);
const cut = booleanMixedBodies3(block, tool, 'difference');
const restored = restoreBody3(serializeBody3(cut));
```

The cylinder parameter above is radius squared. The example uses only rational inputs; curved edges and vertices retain the existing exact algebraic representations.

Native uncut cylinder operands use their actual finite-cylinder support directly. The two native axial cap conditions are already encoded by the finite interval, so they are not duplicated as additional plane predicates. Actual clipped-cylinder operands retain every supplied plane; no clipping condition is removed.

Both connected end-to-end tests passed (about 362 seconds under concurrent load), and the full non-hard suite passed all 817 tests (about 332 seconds). The unchanged slow two-test oblique integration file was excluded. The existing 133-declaration scoped Lean audit and source correspondence checks passed; no full TypeScript execution verification is claimed. These timings are validation observations, not controlled performance benchmarks.
