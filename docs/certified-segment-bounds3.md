# Exact bounds before certified segment membership

The actual generator/axial line certificate still proves the line support. Before using that certificate for a candidate point, all three coordinate intervals between the closed segment endpoints are checked. Any point on the segment must satisfy every such interval, regardless of direction or parameterization. A failed interval therefore proves non-membership without comparing unrelated algebraic line fields. Passing the intervals does not establish membership: the existing exact line predicate and final injective-axis interval check remain mandatory.

This also handles fixed coordinates, reversed endpoints and collapsed restrictions. Candidate endpoint identity remains a valid fast path. No tolerance, approximate distance or caller-provided provenance flag is introduced.

The ten existing axial/generator and algebraic-segment/plane tests pass, including independent algebraic fields, off-line points, reverse/negative directions, degenerate restrictions and copied provenance rejection. The source correspondence checks and existing 133-declaration scoped audit pass. The full non-hard regression run is still pending at this commit; no controlled speedup or whole-program verification is claimed.
