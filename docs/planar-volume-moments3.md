# Exact rational planar volume moments

`planarVolumeMoments3` integrates an actual owned `PreparedPlanarSolid3`.
`planarBodyVolumeMoments3` accepts an actual owned Body with a rational,
straight-edged planar representation, including native Box, straight-profile
Extrude, native/consolidated planar and suitable wrapped material boundaries.
Known prepared sources are reused; other Body boundaries are converted exactly
and revalidated. Curved supports/edges and nonrational vertices fail explicitly.
A planar support alone does not certify that its bounded edges are straight.

The immutable result contains volume, geometric centroid, and inertia tensors
about the world origin and centroid. Matrix row/column order is x,y,z. Entries
are exact `Rational` values. The inertia convention is the integral of
`|x|² Id - x xᵀ`, so off-diagonal entries are negative products of coordinates.
Density is one: volume has length³ units and tensors length⁵ units. For constant
physical density ρ, mass is ρ times volume and physical inertia is ρ times the
returned tensor. Empty material returns zero volume/tensors and a null centroid.
Surface area and general curved-body mass properties are not implemented here.

```ts
const m = planarBodyVolumeMoments3(createBoxBody3(point3(0n, 0n), 2n, 3n, 4n));
m.volume.toString(); // '24'
// centroid: (1, 3/2, 2)
m.inertiaAtCentroid.map(row => row.map(v => v.toString()));
// [['50','0','0'], ['0','40','0'], ['0','0','26']]
```

## Integration argument

Choose any rational reference r near the boundary. For each oriented boundary
triangle, let a,b,c be its vertices relative to r and let v=det(a,b,c)/6 be the
signed tetrahedron volume. With s=a+b+c, the tetrahedron's first moment is
v s/4, and its second moment matrix is

M_ij = v (s_i s_j + a_i a_j + b_i b_j + c_i c_j) / 20.

These follow from the simplex barycentric integrals E[λ_i]=1/4,
E[λ_i²]=1/10 and E[λ_i λ_j]=1/20 for i≠j. The oriented cone chain over the
closed material boundary integrates the material. Therefore signed contributions
sum linearly even when r lies outside a component or on the boundary. Cavity
orientation subtracts its contribution; islands and disconnected components add
theirs. Zero-volume tetrahedra contribute zero. The owned source supplies the
embedding, orientation and nesting preconditions; arbitrary caller triangles or
incidence flags are not accepted as such a certificate.

Sum signed v, first moments f and second matrices M over all triangles. For
nonempty material, c=r+f/V. The centroid-relative second matrix is
C=M-f fᵀ/V. The world second matrix is
W=M+r fᵀ+f rᵀ+V r rᵀ. Inertias are trace(C) Id-C and trace(W) Id-W.
Reference-relative accumulation avoids carrying large translation terms through
every tetrahedron; all operations remain exact rational arithmetic. The computed
volume must agree with the actual prepared source's volume certificate.

This derivation is not a Lean verification of the new integrator or a proof of
TypeScript execution. The existing scoped arithmetic/geometry audit retains its
133 declarations and its original scope.

## Validation

Nine distinct new moment cases passed across the initial six cases and three
added targeted integrations/scale checks. Independent expectations include:

- Analytic cuboid volume, centroid, central and origin inertia.
- Standard simplex monomial integrals and translations by 10^60.
- Reflected/sheared simplex covariance under a determinant -6 transform.
- Analytic signed cuboids for a cavity, material island and disconnected solid.
- Exact surface subdivision invariance, native/consolidated/replayed Bodies,
  native Box and a wrapped mixed-material Box boundary.
- Empty material and explicit curved-body rejection.
- A replayed concave Boolean union versus two analytic nonoverlapping cuboids.
- A native straight-profile through-hole extrusion versus outer-minus-inner boxes.
- Dimensions 10^-40, 10^-50 and 10^-60 at coordinates of order 10^80, retaining
  volume 10^-150 and nonzero exact central inertia.

The existing constructed/planar Body regression invocation passed all 22 cases.
Build, standalone strict typing and the existing scoped audit passed. The prior
native-pair kernel snapshot passed 854 non-hard tests; that predates this module
and the wrapped-curve conversion extension, so it is not a full pass for this
new source. A complete non-hard snapshot including the new moment cases is now running;
its result remains a separate requirement.
