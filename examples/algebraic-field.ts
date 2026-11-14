import {AlgebraicReal,Polynomial,isolateRealRoots,algebraicCoordinates2,orientAlgebraicPoints2} from '../dist/index.js';
const sqrt2=isolateRealRoots(new Polynomial([-2n,0n,1n]))[1]!;
const sqrt3=isolateRealRoots(new Polynomial([-3n,0n,1n]))[1]!;
const sum=sqrt2.add(sqrt3),difference=sqrt2.sub(sqrt3),ratio=sqrt2.div(sqrt3);
console.log(JSON.stringify({
  sumPolynomial:sum.polynomial.coefficients.map(c=>c.toString()),
  productIdentity:sum.mul(difference).equals(AlgebraicReal.fromRational(-1n)),
  ratioSquaredMinusTwoThirds:ratio.signOf(new Polynomial(['-2/3',0n,1n])),
  orientation:orientAlgebraicPoints2(algebraicCoordinates2(0n,0n),algebraicCoordinates2(sqrt2,sqrt3),algebraicCoordinates2(sqrt2.affine(1n,1n),sqrt3.affine(1n,1n))),
},null,2));
