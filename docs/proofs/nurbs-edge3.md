# Validated NURBS edges and shared BRep incidence

`analyzeNurbsCurve3` checks continuity, stationary parameters, oriented
geometric tangent germs and distinct-parameter repetitions. `prepareNurbsEdge3`
accepts a continuous simple interval or closed loop with G1 geometric
interior, returning an immutable factory-owned edge. These are exact
construction checks, not machine-verified TypeScript execution.

## Stationary points and finite jets

On a positive-weight span C=N/W, stationary parameters are common zeros of
J_i=N_i'W-N_iW' for x,y,z. The gcd enumerates all such real roots in the
closed span. If all J_i are identically zero, the span is constant and is
reported as a whole stationary interval.

For an exact parameter a, consider

```
N_i(t)W(a) − N_i(a)W(t).
```

This polynomial vanishes at a and has degree at most the span degree p.
If the span is nonconstant, some coordinate has a first nonzero derivative
of finite order k≤p. Its vector is evaluated using the one-source rational
images of N_i^(k)W-N_iW^(k). When all lower coordinate derivatives vanish,
this vector divided by the positive W(a)^2 is C^(k)(a).

The forward right tangent ray is the first jet's ray. The forward left ray
is multiplied by (-1)^(k-1). At an interior stationary parameter the two
rays agree exactly when k is odd. Projection onto the leading jet is then
locally monotone, and the other components have limiting derivatives in
that coordinate, giving a regular G1 image reparameterization. Even k has
both sides on the same tangent half-line and is an interior cusp/fold.

At rational knot joins compare positions and the two one-sided rays, using
zero cross product and positive dot product. Actual derivative equality
is reported separately as C1; zero derivatives on both sides do not by
themselves establish regular geometry. Endpoints permit any finite jet
order. Thus t² at an endpoint and t³ in an interval are not rejected merely
because parameter speed vanishes. Corners and cusps can be split into
separate edges whose one-sided endpoint germs remain valid.

## Global simplicity

First try an exact strict-monotonicity certificate on each spatial coordinate.
On every span, isolate all interior roots of its derivative numerator and
evaluate its sign in every complementary interval. A coordinate certifies
injectivity when no span is constant in that coordinate and every sign is
the same across the continuous curve. Positive denominators and finitely
many derivative zeros imply strict monotonicity, including stationary
points of odd jet order. This is exhaustive root isolation, not sampling
without a root bound. Closed curves cannot use this certificate.

Otherwise, for every pair of closed spans use the three homogeneous position-equality
equations from spatial curve intersection. On a same-span pair each is
divisible by u-v; divide this factor before solving. On the diagonal the
quotient equals N_i'W-N_iW'. If a nonconstant span's three quotients shared
another diagonal factor, all three derivatives would vanish identically,
a contradiction. The remaining diagonal solutions are ignored because
equal parameters are not repetitions.

The multiple-equation solver and bounded relation graphs enumerate every
possible distinct-parameter match. A positive-length relation edge has an
off-diagonal point: within one span, choose a rational coordinate avoiding
the finite roots of the relation polynomial on u=v; different spans have
disjoint open parameter intervals. Vertical edges and area relations have
the analogous direct witnesses. This avoids missing a fold whose sample
happens to be on the diagonal and whose endpoints are just loop closure.

The only permitted distinct-parameter equality for a simple closed edge
is the global start/end pair. All other repetitions, isolated or continuous,
invalidate simplicity. A concrete non-endpoint witness suffices to stop
the search; returned witnesses are not the complete self-intersection set.
Positive results require either the strict-monotonicity certificate or all
span pairs to be checked. By compactness and
the Hausdorff property, a continuous injective interval map, or a map
injective modulo endpoint closure, embeds the interval or circle in its
image. Discontinuous curves are rejected independently of repetition flags.

Interior G1 excludes the global endpoints. A closed edge has a BRep vertex
at its seam, where the two endpoint rays may differ; this is reported as
`closureTangentsAligned`, not silently assumed periodic smoothness.

## Membership and supporting surfaces

For point membership choose a nonconstant span coordinate N_i/W. If the
queried coordinate has algebraic certificate P, substitute N_i/W and
multiply by W^deg(P), giving a rational polynomial in the curve parameter.
It is nonzero because a nonconstant rational function cannot take only a
finite set of values on an interval. Isolate its real roots, filter to the
closed span and compare all three actual spatial coordinates exactly.
This rejects conjugate candidates and tests the whole point, not a projection.

Whole-edge planar support is the identity n·N+dW=0 on every span. For a
cylinder with rational axis (o,d), squared radius R and D=d·d, set Q=N-oW:

```
|d×Q|² − R D W² = 0.
```

Positive weights make these identities equivalent to supporting-surface
membership. Endpoint membership alone is insufficient.

## BRep bridge and limits

`buildNurbsBRepTopology3` feeds owned edges to the same generic incidence
engine as `buildBRepTopology3`. Its result is
`BRepTopology3<PreparedNurbsEdge3>`; the native default type is unchanged.
Closed edges retain separate start/end ports even at one geometric vertex.
Native `Curve3` variants and their other operations are not extended here.

This validates each NURBS edge and its whole support on rational planes or
cylinders. It does not discover crossings between different edges, certify
face interiors or geometric loop orientation, validate NURBS face supports,
or infer a solid from closed incidence. General trimming, face embedding
and mixed-family sewing remain future work. Exact elimination can be costly.

Tests cover finite-jet parity, endpoint zero speed, cusp/corner splitting,
G1 speed changes, closed circles and angular seams, overlap witnesses,
cubic self-crossing, constants/jumps, algebraic point membership, whole
plane/cylinder identities and native/NURBS coedge/link agreement. Closed
two-face incidence fixtures explicitly do not claim an embedded solid.
