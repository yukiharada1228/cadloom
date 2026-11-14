import {point2,circle2,line2,intersectLineCircle2,intersectCircles2,classifyAlgebraicPointToCircle2} from '../dist/index.js';
import type {AlgebraicReal} from '../dist/index.js';
const describe=(value:AlgebraicReal)=>value.rational?.toString()??{
  polynomial:value.polynomial.coefficients.map(c=>c.toString()),
  interval:[value.lower.toString(),value.upper.toString()],
};
const show=(value:unknown)=>console.log(JSON.stringify(value,null,2));
const circle=circle2(point2(0n,0n),2n); // radius √2, squared radius 2
show(intersectLineCircle2(line2(point2(0n,0n),point2(1n,0n)),circle).map(hit=>({
  x:describe(hit.point.x),y:describe(hit.point.y),onCircle:classifyAlgebraicPointToCircle2(hit.point,circle)===0,
})));
const common=intersectCircles2(circle,circle2(point2(1n,0n),2n));
show(common.kind==='points'?common.points.map(p=>({x:describe(p.x),y:describe(p.y)})):common);
