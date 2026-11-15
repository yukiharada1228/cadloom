# Cylinder SSI intersected with a third cylinder

`intersectCylinderIntersectionArcCylinder3` returns all distinct intersections of an owned bounded SSI arc with a rational circular cylinder, or whole-arc overlap. `splitCylinderIntersectionArcByCylinder3` subdivides at all finite intersections and gives each open piece's exact target-cylinder sign. Tangent contacts are retained even if adjacent signs agree. Resultant root multiplicities are not advertised as geometric intersection multiplicities.

## Height elimination

Use a rational orthogonal basis U,V of the first cylinder's normal section and write p=o+U*x+V*y+d*h. Its base circle is y²=R(x), with R a positive constant minus a positive multiple of x². The second cylinder is F=a*h²+2*b*h+c=0, with a>0, b affine and c quadratic in x,y. The target is G=A*h²+2*B*h+C.

Their difference a*G-A*F=L*h+M has affine L=2(a*B-A*b) and quadratic M=a*C-A*c. If L is nonzero at a base point, h=-M/L, and substitution in F gives H=a*M²-2*b*M*L+c*L²=0. Reducing H modulo y²=R gives E(x)+D(x)*y. Thus the projection polynomial is P=E²-D²*R, of degree at most eight.

A root with R>=0 and D!=0 recovers y=-E/D. The reduced L and M then recover h as a rational function of the same selected algebraic x. All three world coordinates are reconstructed with one common polynomial denominator, retaining rational-univariate correlation. Exact source-arc branch/range and target-support checks filter candidate points. If L=M=0, both real source heights satisfy G; the owned arc's verified base interval and selected branch supply its point without dividing by zero. L=0,M!=0 cannot supply a solution.

## Exceptional projection fibers

A common polynomial factor of E and D signals a projection that does not distinguish all circle solutions, including possible points on a projection tangent. The solver replaces U by U0+k*V0 and V by d×U, for exact integer k, and recomputes elimination. It never drops such fibers, perturbs coordinates numerically or assumes a nonzero denominator.

For a nonzero restriction H on the complex circle, its zero set is finite. Each distinct pair of points excludes at most one projection direction; each solution on a projection tangent excludes finitely many more. Infinitely many distinct rational directions in this chart family therefore include a separating direction with gcd(E,D)=1. Multiplicity at one point does not invalidate this argument. R is not a square in Q(x), so a nonzero remainder cannot have identically zero norm P.

## Shared loci

Whole-arc support is checked by the existing polynomial-identity containment routine, not finite sampling. If H vanishes identically on the base circle while the selected arc is not wholly contained, only exceptional L=M=0 fibers and shared critical endpoints can meet the target. The L=0 circle/plane intersections and verified target-containing endpoints give those candidates. Factory arc intervals have no unpartitioned interior source critical points.

This supplies a necessary intersection/event operation for cutting existing SSI-bounded faces by another cylinder. It does not yet refine those face arrangements, assemble multi-cylinder material Booleans or make a previous curved Body a new Boolean operand. Generic NURBS cutters are outside this API. All arithmetic is pure TypeScript exact rational/algebraic computation; the construction and termination arguments are documented mathematics, not a machine-checked TypeScript refinement proof.

Tests cover the independently known eight perpendicular-cylinder points, tangent/empty cases, parallel target axes and whole height fibers, coincident supports, exact signed subdivision, genuine unequal-radius quartic SSI, shifted/signed/nonunit oblique target frames with known rational points, 10^-30 tangency offsets and trimmed owned interval coverage.
