import {AlgebraicReal,Polynomial,isolateRealRoots} from '../dist/index.js';
const equation=new Polynomial([-2n,0n,1n]); // x² - 2
const sqrt2=isolateRealRoots(equation)[1]!;
let certificate=sqrt2;
for(let i=0;i<8;i++)certificate=certificate.refine();
console.log({
  polynomial:certificate.polynomial.coefficients.map(c=>c.toString()),
  interval:[certificate.lower.toString(),certificate.upper.toString()],
  relationToSevenFifths:sqrt2.compare(AlgebraicReal.fromRational('7/5')),
  equationSign:sqrt2.signOf(equation),
  squareMinusThreeSign:sqrt2.signOf(new Polynomial([-3n,0n,1n])),
});
