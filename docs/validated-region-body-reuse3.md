# Reusing fully bound cylinder faces after region analysis

Binary and expression cylinder Body adoption used to restore the same serialized mixed faces twice: once to derive shell nesting and strict material samples, then again to construct the Body. The second call rebuilt every geometric definition and face arrangement even though only the region table had changed.

## Preserved invariants

`replaceMixedBRepRegions3` requires an actual result registered by `restoreMixedBRepFaces3` (private WeakSet ownership). Its only replacement input is the region array. It copies the original record's geometry, vertices, edge uses, loops, bounded face domains, shell directions, units and coordinate convention, then uses the full `readBodyRecord3` schema/reference checks on the record with the replacement regions. This read snapshots and freezes the region input. It cannot replace a support, endpoint, trim, face orientation or shell use.

The returned runtime object shares the previously decoded curves/surfaces/vertices, bound faces, topology and vertex map. The topology builder and bounded-face binding do not depend on region labels; they depend on the unchanged boundary tables and shell face-use directions. Reusing those objects therefore retains the exact boundary checks already performed. Region replacement alone is not a material-nesting certificate.

Constructive finite-cylinder region analysis still performs the complete initial restoration, closed-manifold checks, line-crossing probes, strict containment forest validation, coorientation/material-side checks and strict witness selection. Only after these succeed is its region-only-bound face object associated with the actual immutable analysis result through a private WeakMap. Body adoption obtains that object using the real analysis-result identity; structural copies and user-provided records are rejected. Existing Body manifold, sample-count, sample-membership and construction-document checks remain in place. Normal external record restoration still performs the complete geometric and face-domain reconstruction.

## Validation

The connected 25-test group passed against an isolated source-35 build, including old-document replay, binary/expression cavities, face binding, strict region references, rejected copied ownership and actual reuse of geometry/topology/faces. Mutation of caller region arrays does not affect the result. The historical 74-face fixture also confirms that replacement preserves all non-region tables. Broader regression and the unchanged oblique integration are separate gates. No new Lean theorem or full TypeScript execution proof is claimed.

The existing scoped Lean audit passed all 133 declared theorems after updating the reviewed source manifest. These declarations do not prove this new runtime reuse path.

The full source-35 broad suite subsequently passed all 767 tests outside the unchanged two-test hard oblique file in one isolated invocation (103913 ms). This includes the historical fixture and both new certificate/reuse tests. That broad suite alone did not establish the hard result; the subsequent complete integration is recorded below.

The preceding source-34 sewing snapshot completed its unchanged hard oblique run successfully with status 0: both tests passed, Body ended at 807441 ms and total duration was 807495 ms. Together with its 764-test broad run and separately passing historical fixture, this establishes the scoped source-34 integration before region reuse. The source-35 reuse run is separate; elapsed durations are not controlled comparisons.

## Completed source-35 integration

The retained source-35 hard process completed with status 0 and both unchanged tests passed. Boundary ended at 289469 ms, independent material-grid checks ended at 289478 ms, Body ended at 530091 ms and total reported duration was 530173 ms. Assertions retain manifold/closed boundary, a selected third-operand SSI face, more than 100 strict independent rational material queries, common Body adoption and location of all interior samples. The isolated test differs only in compiled import path and phase logging; no shape or assertion was weakened.

Together with the 767-test non-hard suite, all 769 distinct current tests have passing evidence across these two runs. The existing 133-declaration scoped audit also passed; it is not a proof of the new execution path. Source runtime corresponds to `8bd335f`; subsequent commits only document results.

The roughly 8 minute 50 second total and the preceding snapshot's timing are diagnostic observations under different concurrent/debugger conditions, not a controlled speedup benchmark. Correctness and removal of the duplicate restoration are established here; interactive performance, general curved/contact/NURBS Booleans and full SolidCraft parity remain incomplete.
