import {point2,segment2,circle2,fullCircleArc2,splitCurves2} from '../dist/index.js';
const result=splitCurves2([
  {kind:'arc',arc:fullCircleArc2(circle2(point2(0n,0n),2n))},
  {kind:'segment',segment:segment2(point2(0n,-3n),point2(0n,3n))},
]);
console.log(JSON.stringify({
  vertices:result.vertices.length,
  edges:result.edges.length,
  sharedCrossings:result.vertices.filter(v=>v.sources.length===2).map(v=>({
    x:v.point.x.rational?.toString()??v.point.x.polynomial.coefficients.map(c=>c.toString()),
    y:v.point.y.rational?.toString()??{polynomial:v.point.y.polynomial.coefficients.map(c=>c.toString()),interval:[v.point.y.lower.toString(),v.point.y.upper.toString()]},
    sources:v.sources,
  })),
  edgeCountStableOnReinput:splitCurves2(result.edges).edges.length===result.edges.length,
},null,2));
