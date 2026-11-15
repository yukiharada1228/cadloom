# Planar material from physical-plane chambers

Status: implemented as the separate `compilePlanarChambers3` API; the existing
parity compiler and public boundary wrapper are unchanged.

The current cone-parity compiler adds internal tetrahedron carriers. For the
extruded L fixture it produces 21 carriers, and the existing exact material
backend constructs 275 manifold face fragments. A physical-plane chamber
experiment uses eight carriers, four full-dimensional chambers (three material)
and 18 candidate arrangement vertices. It constructed 14 manifold face fragments.
All face supports coincide with original physical supports, and all rational
face-interior witnesses lie on the independent prepared source boundary.
The expression agreed with the independent L inequality oracle and source
classifier at 1,331 rational points away from every carrier.

The experiment used the unchanged exact material backend from the isolated
planar-boundary API build. Compilation took 26 ms and the experiment through
boundary/sample checks took 1,850 ms in one invocation. These are observations,
not a controlled speedup benchmark. Common Body replay, cavity/disconnected
boundary reconstruction and general degeneracy coverage have not been checked
for this new expression builder. The older retained-Body replay subsequently passed on combined runtime f4f4eee
in 1,593,584 ms. It used the 21-plane expression and is separate from this
experiment; no attribution to the new chamber compiler is appropriate.

## Construction and correctness obligations

1. Snapshot an actual owned prepared planar material source. Deduplicate its
   physical supporting planes by exact signed normalization; no fitted planes.
2. Include the six rational vertex-box bounds. The actual material is contained
   in that closed box. A cylinder guard remains strictly inactive on the box.
3. Enumerate independent triples of these planes with exact Cramer determinants.
   Retain their intersections in the closed box, deduplicated by rational values.
4. Recursively partition candidate points by each carrier. Zero points belong
   to both sides when both strict signs exist. If only one strict sign occurs,
   continue that side without emitting a spurious zero-volume chamber.
5. At each full-dimensional leaf, average its retained points and classify that
   exact rational witness with the actual prepared source. A boundary answer is
   an invariant failure, never resolved with epsilon or an arbitrary side.
6. Emit a bounded Boolean decision expression for material leaves. Regularized
   closure supplies seams and boundaries; strict-leaf predicates alone are not
   a point-on-boundary classifier. Feed the expression to complete partitioning,
   two-sided selection and sewing, then require its material certificates.

Every bounded full-dimensional chamber has vertices at independent triples of
active planes, including the box bounds. Thus the candidate set contains all
its vertices. Retained candidates can also include nonvertex points, which do
not harm containment. Their average is strictly on the required side of each
carrier: all terms have the same weak sign and at least one has the strict sign.
This is the key invariant to verify through recursion. A cell split by a plane
having both strict signs has two full-dimensional children. A plane with only
one strict sign contributes no other full-dimensional child.

The source boundary lies in the physical carrier union, so membership is
constant on each open convex chamber. The witness therefore determines its
material label. Box restriction and the inactive guard then recover the same
regularized material. This is a mathematical design argument, not a Lean proof
or a verification of the TypeScript implementation.

## Before production integration

Implement immutable ownership checks and an explicit empty-material path.
Validate rank/degeneracy invariants, coincident carriers, very thin rational
cells, skew transforms, concavity, cavities, material islands and disconnected
shells against independent exact membership and the existing compiler. Check
actual boundary supports, local manifold incidence, Body adoption and retained
serialization/replay, preserving the historical 21-plane document reader test.
Do not change the old stored expressions or their replay ordering. Measure
candidate/chamber growth for many physical planes; triple enumeration and
recursive incidence work can still be expensive. Keep existing general
algebraic/cylinder boundary processing complete.

## Initial implementation validation

The separate immutable compiler passed its build and five focused tests: L
chambers, nested cavity/island/disconnected strict predicates, an affine skew
with thickness 10^-40, the empty path, and L boundary/Body/replay with the original
Body observable after replay. The L replay test checks all bounded-face samples,
64 independent strict points and nine seam/boundary cases. Total focused run:
7,706 ms under concurrent work; no timing threshold is asserted. The separate actual cavity-boundary replay test passed (18,802 ms): two
cooriented shells, void and material membership, bounded face witnesses and
post-replay original Body queries. The scoped source/Lean audit passed its
existing 133 declarations; this is not a proof of the new chamber algorithm or
of full TypeScript execution. The tests also passed standalone strict typing.
